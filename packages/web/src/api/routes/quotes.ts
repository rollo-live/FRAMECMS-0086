import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { sendQuoteEmail } from "../lib/email";
import { generateQuotePdf } from "../lib/pdf";
import { validateBody, QuoteSchema, QuoteUpdateSchema } from "../lib/validate";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

function calcTotals(items: any[], taxRate: number) {
  const subtotal = items.reduce((s: number, i: any) => s + (Number(i.qty) * Number(i.price)), 0);
  const total = subtotal * (1 + taxRate / 100);
  return { subtotal, total };
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
    const body = await validateBody(c, QuoteSchema);
    if (!body) return c.res;
    const count = await db.select().from(schema.quotes).where(eq(schema.quotes.tenantId, tenantId)).all();
    const number = `PRV-${new Date().getFullYear()}-${String(count.length + 1).padStart(3, "0")}`;
    const items = body.items ?? [];
    const taxRate = body.taxRate ?? 22;
    const { subtotal, total } = calcTotals(items, taxRate);
    const [quote] = await db.insert(schema.quotes).values({
      id: nanoid(),
      tenantId,
      clientId: body.clientId,
      number,
      title: body.title,
      introText: body.introText ?? null,
      closingText: body.closingText ?? null,
      items: JSON.stringify(items),
      subtotal,
      taxRate,
      total,
      notes: body.notes ?? null,
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
    const body = await validateBody(c, QuoteUpdateSchema);
    if (!body) return c.res;
    const items = body.items ?? [];
    const taxRate = body.taxRate ?? 22;
    const { subtotal, total } = calcTotals(items, taxRate);

    const oldQuote = await db.select().from(schema.quotes)
      .where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId))).get();
    if (!oldQuote) return c.json({ error: "Non trovato" }, 404);

    const [quote] = await db.update(schema.quotes).set({
      title: body.title,
      introText: body.introText ?? null,
      closingText: body.closingText ?? null,
      items: JSON.stringify(items),
      subtotal,
      taxRate,
      total,
      notes: body.notes ?? null,
      status: body.status ?? oldQuote.status,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      updatedAt: new Date(),
    }).where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId))).returning();

    // Email on first "sent"
    if (body.status === "sent" && oldQuote.status !== "sent") {
      const client = await db.select().from(schema.clients).where(eq(schema.clients.id, quote.clientId)).get();
      const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
      const ct = await db.select().from(schema.clientTokens).where(eq(schema.clientTokens.clientId, quote.clientId)).get();
      const portalUrl = ct ? `${process.env.WEBSITE_URL}portale/${ct.token}` : null;
      if (client?.email && tenant) {
        sendQuoteEmail({
          clientEmail: client.email,
          clientName: client.name,
          tenantName: tenant.name,
          quoteNumber: quote.number,
          quoteTitle: quote.title,
          total: quote.total,
          validUntil: quote.validUntil,
          portalUrl,
        }).catch(console.error);
      }
    }

    return c.json({ quote }, 200);
  })

  // ─── PDF ────────────────────────────────────────────────────────────────────
  .get("/:id/pdf", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);

    const quote = await db.select().from(schema.quotes)
      .where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId))).get();
    if (!quote) return c.json({ error: "Non trovato" }, 404);

    const client = await db.select().from(schema.clients).where(eq(schema.clients.id, quote.clientId)).get();
    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();

    const pdfBuffer = await generateQuotePdf({ quote, client, tenant });

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="preventivo-${quote.number}.pdf"`);
    return c.body(pdfBuffer as any);
  })

  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.quotes)
      .where(and(eq(schema.quotes.id, c.req.param("id")), eq(schema.quotes.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  });
