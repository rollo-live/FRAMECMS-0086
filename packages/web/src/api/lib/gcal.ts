import { google } from "googleapis";
import { db } from "../database";
import { googleCalendarTokens } from "../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? "http://localhost:4200"}/api/bookings/oauth/callback`;

export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(tenantId: string): string {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    prompt: "consent",
    state: tenantId,
  });
}

export async function exchangeCode(code: string, tenantId: string): Promise<void> {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens from Google OAuth");
  }

  const expiresAt = new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000);

  const existing = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.tenantId, tenantId))
    .get();

  if (existing) {
    await db
      .update(googleCalendarTokens)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarTokens.tenantId, tenantId));
  } else {
    await db.insert(googleCalendarTokens).values({
      id: nanoid(),
      tenantId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });
  }
}

export async function getAuthedClient(tenantId: string) {
  const tokenRow = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.tenantId, tenantId))
    .get();

  if (!tokenRow) throw new Error("Google Calendar non collegato per questo tenant");

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (tokenRow.expiresAt.getTime() < Date.now() + 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000);
    await db
      .update(googleCalendarTokens)
      .set({
        accessToken: credentials.access_token ?? tokenRow.accessToken,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarTokens.tenantId, tenantId));
    oauth2Client.setCredentials(credentials);
  }

  return { oauth2Client, calendarId: tokenRow.calendarId };
}

export async function isCalendarConnected(tenantId: string): Promise<boolean> {
  const row = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.tenantId, tenantId))
    .get();
  return !!row;
}

/** Returns busy time ranges for a given date range */
export async function getBusySlots(
  tenantId: string,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ start: string; end: string }>> {
  try {
    const { oauth2Client, calendarId } = await getAuthedClient(tenantId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busy = res.data.calendars?.[calendarId]?.busy ?? [];
    return busy.map((b) => ({ start: b.start ?? "", end: b.end ?? "" }));
  } catch {
    // If not connected or error, return empty (no blocking)
    return [];
  }
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
  attendeeName: string;
}

export async function createCalendarEvent(
  tenantId: string,
  event: CalendarEventInput
): Promise<string> {
  const { oauth2Client, calendarId } = await getAuthedClient(tenantId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start.toISOString(), timeZone: "Europe/Rome" },
      end: { dateTime: event.end.toISOString(), timeZone: "Europe/Rome" },
      attendees: [{ email: event.attendeeEmail, displayName: event.attendeeName }],
    },
  });

  return res.data.id ?? "";
}

export async function deleteCalendarEvent(tenantId: string, eventId: string): Promise<void> {
  try {
    const { oauth2Client, calendarId } = await getAuthedClient(tenantId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.events.delete({ calendarId, eventId });
  } catch {
    // Ignore errors if event already deleted
  }
}
