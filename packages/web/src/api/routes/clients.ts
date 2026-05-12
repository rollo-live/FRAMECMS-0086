import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { sendPortalAccessEmail } from "../lib/email";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const clients = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ clients: [] }, 200);
    const all = await db.select().from(schema.clients)
      .where(eq(schema.clients.tenantId, tenantId))
      .orderBy(desc(schema.clients.createdAt));
    return c.json({ clients: all }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const [client] = await db.insert(schema.clients).values({
      id: nanoid(),
      tenantId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      type: body.type ?? "client",
      notes: body.notes,
      tags: body.tags ? JSON.stringify(body.tags) : "[]",
    }).returning();
    return c.json({ client }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const client = await db.select().from(schema.clients)
      .where(and(eq(schema.clients.id, c.req.param("id")), eq(schema.clients.tenantId, tenantId))).get();
    if (!client) return c.json({ error: "Non trovato" }, 404);
    return c.json({ client }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [client] = await db.update(schema.clients).set({
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      type: body.type,
      status: body.status,
      notes: body.notes,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      updatedAt: new Date(),
    }).where(and(eq(schema.clients.id, c.req.param("id")), eq(schema.clients.tenantId, tenantId))).returning();
    return c.json({ client }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.clients)
      .where(and(eq(schema.clients.id, c.req.param("id")), eq(schema.clients.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  })
  // Generate access token for client portal
  .post("/:id/token", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const token = nanoid(32);
    const [ct] = await db.insert(schema.clientTokens).values({
      id: nanoid(),
      clientId: c.req.param("id"),
      token,
      label: body.label ?? "Portale cliente",
    }).returning();
    const portalUrl = `${process.env.WEBSITE_URL}portale/${token}`;

    // Fetch client and tenant for email
    const client = await db.select().from(schema.clients).where(eq(schema.clients.id, c.req.param("id"))).get();
    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    if (client?.email && tenant) {
      sendPortalAccessEmail({
        clientEmail: client.email,
        clientName: client.name,
        tenantName: tenant.name,
        portalUrl,
      }).catch(console.error);
    }

    return c.json({ token: ct, portalUrl }, 201);
  });
