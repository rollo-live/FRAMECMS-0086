import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { z } from "zod/v4";

const ChannelSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Solo lettere minuscole, numeri e trattini"),
  notifyEmail: z.string().email().optional().nullable(),
  replyToEmail: z.string().email().optional().nullable(),
  // accept both naming variants from frontend
  replyEmail: z.string().email().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  primaryColor: z.string().max(20).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
});

const ChannelUpdateSchema = ChannelSchema.partial();

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const bookingChannels = new Hono()

  // GET /api/booking-channels — lista tutti i canali del tenant
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ channels: [] }, 200);
    const rows = await db.select().from(schema.bookingChannels)
      .where(eq(schema.bookingChannels.tenantId, tenantId));
    // Normalize to frontend field names
    const channels = rows.map((r) => ({
      ...r,
      color: r.primaryColor,
      logoUrl: r.logo,
      replyToEmail: r.replyEmail,
      isActive: r.active,
    }));
    return c.json({ channels }, 200);
  })

  // POST /api/booking-channels — crea canale
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "Body mancante" }, 400);
    const parsed = ChannelSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Dati non validi", issues: parsed.error.issues }, 400);
    const d = parsed.data;

    // Slug univoco
    const existing = await db.select().from(schema.bookingChannels)
      .where(eq(schema.bookingChannels.slug, d.slug)).get();
    if (existing) return c.json({ error: "Slug già in uso" }, 409);

    const [ch] = await db.insert(schema.bookingChannels).values({
      id: nanoid(),
      tenantId,
      name: d.name,
      slug: d.slug,
      notifyEmail: d.notifyEmail ?? null,
      replyEmail: d.replyToEmail ?? d.replyEmail ?? null,
      logo: d.logoUrl ?? d.logo ?? null,
      primaryColor: d.color ?? d.primaryColor ?? "#F5A623",
      description: d.description ?? null,
      active: d.isActive ?? d.active ?? true,
    }).returning();
    return c.json({ channel: ch }, 201);
  })

  // PUT /api/booking-channels/:id — aggiorna canale
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "Body mancante" }, 400);
    const parsed = ChannelUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Dati non validi", issues: parsed.error.issues }, 400);
    const d = parsed.data;

    // Se cambia slug controlla unicità
    if (d.slug) {
      const existing = await db.select().from(schema.bookingChannels)
        .where(eq(schema.bookingChannels.slug, d.slug)).get();
      if (existing && existing.id !== c.req.param("id")) return c.json({ error: "Slug già in uso" }, 409);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (d.name !== undefined) updateData.name = d.name;
    if (d.slug !== undefined) updateData.slug = d.slug;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.notifyEmail !== undefined) updateData.notifyEmail = d.notifyEmail;
    if (d.replyToEmail !== undefined) updateData.replyEmail = d.replyToEmail;
    else if (d.replyEmail !== undefined) updateData.replyEmail = d.replyEmail;
    if (d.logoUrl !== undefined) updateData.logo = d.logoUrl;
    else if (d.logo !== undefined) updateData.logo = d.logo;
    if (d.color !== undefined) updateData.primaryColor = d.color;
    else if (d.primaryColor !== undefined) updateData.primaryColor = d.primaryColor;
    if (d.isActive !== undefined) updateData.active = d.isActive;
    else if (d.active !== undefined) updateData.active = d.active;

    const [ch] = await db.update(schema.bookingChannels).set(updateData).where(and(
      eq(schema.bookingChannels.id, c.req.param("id")),
      eq(schema.bookingChannels.tenantId, tenantId)
    )).returning();
    return c.json({ channel: ch }, 200);
  })

  // PATCH /api/booking-channels/:id — alias di PUT
  .patch("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "Body mancante" }, 400);
    const parsed = ChannelUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Dati non validi", issues: parsed.error.issues }, 400);
    const d = parsed.data;

    if (d.slug) {
      const existing = await db.select().from(schema.bookingChannels)
        .where(eq(schema.bookingChannels.slug, d.slug)).get();
      if (existing && existing.id !== c.req.param("id")) return c.json({ error: "Slug già in uso" }, 409);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (d.name !== undefined) updateData.name = d.name;
    if (d.slug !== undefined) updateData.slug = d.slug;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.notifyEmail !== undefined) updateData.notifyEmail = d.notifyEmail;
    if (d.replyToEmail !== undefined) updateData.replyEmail = d.replyToEmail;
    else if (d.replyEmail !== undefined) updateData.replyEmail = d.replyEmail;
    if (d.logoUrl !== undefined) updateData.logo = d.logoUrl;
    else if (d.logo !== undefined) updateData.logo = d.logo;
    if (d.color !== undefined) updateData.primaryColor = d.color;
    else if (d.primaryColor !== undefined) updateData.primaryColor = d.primaryColor;
    if (d.isActive !== undefined) updateData.active = d.isActive;
    else if (d.active !== undefined) updateData.active = d.active;

    const [ch] = await db.update(schema.bookingChannels).set(updateData).where(and(
      eq(schema.bookingChannels.id, c.req.param("id")),
      eq(schema.bookingChannels.tenantId, tenantId)
    )).returning();
    return c.json({ channel: ch }, 200);
  })

  // DELETE /api/booking-channels/:id
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.bookingChannels).where(and(
      eq(schema.bookingChannels.id, c.req.param("id")),
      eq(schema.bookingChannels.tenantId, tenantId)
    ));
    return c.json({ ok: true }, 200);
  });
