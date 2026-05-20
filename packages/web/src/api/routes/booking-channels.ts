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
  notifyEmail: z.string().email(),
  replyEmail: z.string().email(),
  logo: z.string().optional().nullable(),
  primaryColor: z.string().max(20).optional(),
  description: z.string().max(1000).optional().nullable(),
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
    const channels = await db.select().from(schema.bookingChannels)
      .where(eq(schema.bookingChannels.tenantId, tenantId));
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
      notifyEmail: d.notifyEmail,
      replyEmail: d.replyEmail,
      logo: d.logo ?? null,
      primaryColor: d.primaryColor ?? "#F5A623",
      description: d.description ?? null,
      active: d.active ?? true,
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

    const [ch] = await db.update(schema.bookingChannels).set({
      ...d,
      updatedAt: new Date(),
    }).where(and(
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
