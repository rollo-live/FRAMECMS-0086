import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import {
  getAuthUrl,
  exchangeCode,
  getBusySlots,
  createCalendarEvent,
  deleteCalendarEvent,
  isCalendarConnected,
} from "../lib/gcal";
import {
  sendOwnerNotification,
  sendBookingConfirmation,
  sendBookingRejection,
} from "../lib/email";

// ─── Duration map (hours) ────────────────────────────────────────────────────
const EVENT_DURATION: Record<string, number> = {
  matrimonio: 11,      // 09:00–20:00
  battesimo: 4,
  compleanno: 3,
  shooting_aziendale: 2,
  conferenza: 3,
  altro: 2,
};

// ─── Event labels ────────────────────────────────────────────────────────────
const EVENT_TYPE_LABELS: Record<string, string> = {
  battesimo: "Battesimo",
  compleanno: "Compleanno",
  matrimonio: "Matrimonio",
  shooting_aziendale: "Shooting Aziendale",
  conferenza: "Conferenza",
  altro: "Altro",
};

async function getTenantIdForUser(userId: string) {
  const p = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .get();
  return p?.tenantId ?? null;
}

async function getOwnerEmail(tenantId: string): Promise<string | null> {
  const tenant = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();
  if (!tenant?.ownerId) return null;
  const user = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, tenant.ownerId))
    .get();
  return user?.email ?? null;
}

function getEventEnd(eventDate: Date, eventType: string): Date {
  const hours = EVENT_DURATION[eventType] ?? 2;
  const end = new Date(eventDate);
  end.setHours(end.getHours() + hours);
  return end;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:4200";

export const bookings = new Hono()

  // ─── PUBLIC: Get busy slots for a tenant ─────────────────────────────────
  .get("/public/:tenantSlug/busy", async (c) => {
    const { tenantSlug } = c.req.param();
    const { from, to } = c.req.query();

    const tenant = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, tenantSlug))
      .get();
    if (!tenant) return c.json({ error: "Tenant non trovato" }, 404);

    const timeMin = from ? new Date(from) : new Date();
    const timeMax = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 3600 * 1000);

    const busy = await getBusySlots(tenant.id, timeMin, timeMax);

    // Also add approved appointments as busy
    const approved = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, tenant.id),
          eq(schema.appointments.status, "approved")
        )
      );

    const approvedBusy = approved.map((a) => ({
      start: a.eventDate.toISOString(),
      end: getEventEnd(a.eventDate, a.eventType).toISOString(),
    }));

    return c.json({ busy: [...busy, ...approvedBusy] }, 200);
  })

  // ─── PUBLIC: Submit booking request ──────────────────────────────────────
  .post("/public/:tenantSlug/request", async (c) => {
    const { tenantSlug } = c.req.param();

    const tenant = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, tenantSlug))
      .get();
    if (!tenant) return c.json({ error: "Tenant non trovato" }, 404);

    const body = await c.req.json();

    if (!body.clientName || !body.clientEmail || !body.eventType || !body.eventDate) {
      return c.json({ error: "Campi obbligatori mancanti" }, 400);
    }

    const bookingToken = nanoid(32);
    const id = nanoid();
    const eventDate = new Date(body.eventDate);

    await db.insert(schema.appointments).values({
      id,
      tenantId: tenant.id,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientPhone: body.clientPhone ?? null,
      eventType: body.eventType,
      eventTypeCustom: body.eventTypeCustom ?? null,
      services: JSON.stringify(body.services ?? []),
      eventDate,
      eventLocation: body.eventLocation ?? null,
      notes: body.notes ?? null,
      bookingToken,
    });

    // Notify owner via email
    const ownerEmail = await getOwnerEmail(tenant.id);
    if (ownerEmail) {
      await sendOwnerNotification({
        ownerEmail,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone ?? null,
        eventType: body.eventType,
        eventTypeCustom: body.eventTypeCustom ?? null,
        services: body.services ?? [],
        eventDate,
        eventLocation: body.eventLocation ?? null,
        notes: body.notes ?? null,
        approveUrl: `${APP_URL}/api/bookings/${id}/approve?token=${bookingToken}`,
        rejectUrl: `${APP_URL}/api/bookings/${id}/reject?token=${bookingToken}`,
      }).catch(console.error);
    }

    return c.json({ success: true, bookingToken }, 201);
  })

  // ─── PRIVATE: List appointments ───────────────────────────────────────────
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ appointments: [], pendingCount: 0 }, 200);

    const status = c.req.query("status"); // optional filter

    let query = db
      .select()
      .from(schema.appointments)
      .where(
        status
          ? and(
              eq(schema.appointments.tenantId, tenantId),
              eq(schema.appointments.status, status)
            )
          : eq(schema.appointments.tenantId, tenantId)
      )
      .orderBy(desc(schema.appointments.createdAt));

    const all = await query;

    const pendingCount = all.filter((a) => a.status === "pending").length;

    return c.json({
      appointments: all.map((a) => ({
        ...a,
        services: JSON.parse(a.services ?? "[]"),
      })),
      pendingCount,
    }, 200);
  })

  // ─── PRIVATE: Pending count (for badge) ──────────────────────────────────
  .get("/pending-count", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ count: 0 }, 200);

    const rows = await db
      .select({ count: count() })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, tenantId),
          eq(schema.appointments.status, "pending")
        )
      );

    return c.json({ count: rows[0]?.count ?? 0 }, 200);
  })

  // ─── PRIVATE: Single appointment ─────────────────────────────────────────
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);

    const appt = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.id, c.req.param("id")),
          eq(schema.appointments.tenantId, tenantId)
        )
      )
      .get();

    if (!appt) return c.json({ error: "Non trovato" }, 404);
    return c.json({ appointment: { ...appt, services: JSON.parse(appt.services ?? "[]") } }, 200);
  })

  // ─── PRIVATE: Approve ─────────────────────────────────────────────────────
  .post("/:id/approve", async (c) => {
    const { id } = c.req.param();

    // Allow both authenticated (dashboard) and token-based (email link)
    const user = c.get("user");
    const queryToken = c.req.query("token");

    const appt = await db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .get();

    if (!appt) return c.json({ error: "Non trovato" }, 404);

    // Auth check: either logged-in owner or valid token
    if (!user && appt.bookingToken !== queryToken) {
      return c.json({ error: "Non autorizzato" }, 401);
    }
    if (user) {
      const tenantId = await getTenantIdForUser(user.id);
      if (tenantId !== appt.tenantId) return c.json({ error: "Non autorizzato" }, 403);
    }

    if (appt.status !== "pending") {
      return c.json({ error: "Questa prenotazione non è più in attesa" }, 400);
    }

    const eventEnd = getEventEnd(appt.eventDate, appt.eventType);
    const services: string[] = JSON.parse(appt.services ?? "[]");
    const eventLabel =
      appt.eventType === "altro" && appt.eventTypeCustom
        ? appt.eventTypeCustom
        : EVENT_TYPE_LABELS[appt.eventType] ?? appt.eventType;

    // Try to create Google Calendar event
    let gcalEventId: string | null = null;
    let calendarLink: string | undefined;
    try {
      const connected = await isCalendarConnected(appt.tenantId);
      if (connected) {
        gcalEventId = await createCalendarEvent(appt.tenantId, {
          summary: `${eventLabel} — ${appt.clientName}`,
          description: `Prenotazione FRAME\nCliente: ${appt.clientName} (${appt.clientEmail})\nServizi: ${services.join(", ")}${appt.notes ? `\nNote: ${appt.notes}` : ""}`,
          location: appt.eventLocation ?? undefined,
          start: appt.eventDate,
          end: eventEnd,
          attendeeEmail: appt.clientEmail,
          attendeeName: appt.clientName,
        });

        // Build Google Calendar link for client
        const startStr = appt.eventDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        const endStr = eventEnd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        calendarLink = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(eventLabel)}&dates=${startStr}/${endStr}&location=${encodeURIComponent(appt.eventLocation ?? "")}`;
      }
    } catch (err) {
      console.error("GCal create failed:", err);
    }

    // Update DB
    await db
      .update(schema.appointments)
      .set({
        status: "approved",
        googleCalendarEventId: gcalEventId,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, id));

    // Get tenant name
    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, appt.tenantId)).get();

    // Send confirmation email to client
    await sendBookingConfirmation({
      clientEmail: appt.clientEmail,
      clientName: appt.clientName,
      eventType: appt.eventType,
      eventTypeCustom: appt.eventTypeCustom,
      services,
      eventDate: appt.eventDate,
      eventEnd,
      eventLocation: appt.eventLocation,
      calendarLink,
      tenantName: tenant?.name ?? "FRAME",
    }).catch(console.error);

    // If called from email link (no user), redirect to dashboard
    if (!user && queryToken) {
      return c.redirect(`${APP_URL}/prenotazioni?approved=1`);
    }

    return c.json({ success: true }, 200);
  })

  // ─── PRIVATE: Reject ──────────────────────────────────────────────────────
  .post("/:id/reject", async (c) => {
    const { id } = c.req.param();

    const user = c.get("user");
    const queryToken = c.req.query("token");

    const appt = await db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .get();

    if (!appt) return c.json({ error: "Non trovato" }, 404);

    if (!user && appt.bookingToken !== queryToken) {
      return c.json({ error: "Non autorizzato" }, 401);
    }
    if (user) {
      const tenantId = await getTenantIdForUser(user.id);
      if (tenantId !== appt.tenantId) return c.json({ error: "Non autorizzato" }, 403);
    }

    if (appt.status !== "pending") {
      return c.json({ error: "Questa prenotazione non è più in attesa" }, 400);
    }

    await db
      .update(schema.appointments)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(schema.appointments.id, id));

    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, appt.tenantId)).get();

    await sendBookingRejection({
      clientEmail: appt.clientEmail,
      clientName: appt.clientName,
      eventType: appt.eventType,
      eventTypeCustom: appt.eventTypeCustom,
      eventDate: appt.eventDate,
      tenantName: tenant?.name ?? "FRAME",
    }).catch(console.error);

    if (!user && queryToken) {
      return c.redirect(`${APP_URL}/prenotazioni?rejected=1`);
    }

    return c.json({ success: true }, 200);
  })

  // ─── PRIVATE: Delete ──────────────────────────────────────────────────────
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);

    const appt = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.id, c.req.param("id")),
          eq(schema.appointments.tenantId, tenantId)
        )
      )
      .get();
    if (!appt) return c.json({ error: "Non trovato" }, 404);

    // Delete GCal event if present
    if (appt.googleCalendarEventId) {
      await deleteCalendarEvent(tenantId, appt.googleCalendarEventId).catch(console.error);
    }

    await db.delete(schema.appointments).where(eq(schema.appointments.id, appt.id));
    return c.json({ success: true }, 200);
  })

  // ─── PRIVATE: Google OAuth — start ───────────────────────────────────────
  .get("/oauth/connect", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ error: "Tenant non trovato" }, 400);

    const url = getAuthUrl(tenantId);
    return c.json({ url }, 200);
  })

  // ─── PUBLIC: Google OAuth — callback ─────────────────────────────────────
  .get("/oauth/callback", async (c) => {
    const { code, state: tenantId, error } = c.req.query();

    if (error) {
      return c.redirect(`${APP_URL}/impostazioni?gcal_error=${encodeURIComponent(error)}`);
    }

    if (!code || !tenantId) {
      return c.redirect(`${APP_URL}/impostazioni?gcal_error=missing_params`);
    }

    try {
      await exchangeCode(code, tenantId);
      return c.redirect(`${APP_URL}/impostazioni?gcal_success=1`);
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      return c.redirect(`${APP_URL}/impostazioni?gcal_error=${encodeURIComponent(err.message)}`);
    }
  })

  // ─── PRIVATE: Google Calendar status ─────────────────────────────────────
  .get("/oauth/status", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ connected: false }, 200);

    const connected = await isCalendarConnected(tenantId);
    return c.json({ connected }, 200);
  })

  // ─── PRIVATE: Google Calendar disconnect ─────────────────────────────────
  .delete("/oauth/disconnect", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantIdForUser(user.id);
    if (!tenantId) return c.json({ error: "Tenant non trovato" }, 400);

    await db
      .delete(schema.googleCalendarTokens)
      .where(eq(schema.googleCalendarTokens.tenantId, tenantId));

    return c.json({ success: true }, 200);
  });
