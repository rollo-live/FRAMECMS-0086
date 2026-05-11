import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const quotes = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ quotes: [] }, 200);
    const all = await db.select().from(schema.quotes)
      .where(eq(schema.quotes.tenantId, tenantId))
      .orderBy(desc(schema.quotes.createdAt));
    return c.json({ quotes: all }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    // Auto-generate quote number
    const count = await db.select().from(schema.quotes).where(eq(schema.quotes.tenantId, tenantId)).all();
    const number = `PRV-${new Date().getFullYear()}-${String(count.length + 1).padStart(3, "0")}`;
    const items = body.items ?? [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.qty * i.price), 0);
    const taxRate = body.taxRate ?? 22;
    const total = subtotal * (1 + taxRate / 100);
    const [quote] = await db.insert(schema.quotes).values({
      id: nanoid(),
      tenantId,
      clientId: body.clientId,
      number,
      title: body.title,
      items: JSON.stringify(items),
      subtotal,
      taxRate,
      total,
      notes: body.notes,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      status: "draft",
    }).returning();
    return c.json({ quote }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const quote = await db.select().from(schema.quotes)
      .where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId))).get();
    if (!quote) return c.json({ error: "Non trovato" }, 404);
    return c.json({ quote }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const items = body.items ?? [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.qty * i.price), 0);
    const taxRate = body.taxRate ?? 22;
    const total = subtotal * (1 + taxRate / 100);
    const [quote] = await db.update(schema.quotes).set({
      title: body.title,
      items: JSON.stringify(items),
      subtotal,
      taxRate,
      total,
      notes: body.notes,
      status: body.status,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      updatedAt: new Date(),
    }).where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId))).returning();
    return c.json({ quote }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.quotes)
      .where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  });
