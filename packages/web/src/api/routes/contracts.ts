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

export const contracts = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ contracts: [] }, 200);
    const all = await db.select().from(schema.contracts)
      .where(eq(schema.contracts.tenantId, tenantId))
      .orderBy(desc(schema.contracts.createdAt));
    return c.json({ contracts: all }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const shareToken = nanoid(32);
    const [contract] = await db.insert(schema.contracts).values({
      id: nanoid(),
      tenantId,
      clientId: body.clientId,
      quoteId: body.quoteId,
      title: body.title,
      content: body.content ?? "",
      shareToken,
      status: "draft",
    }).returning();
    return c.json({ contract }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const contract = await db.select().from(schema.contracts)
      .where(and(eq(schema.contracts.id, c.req.param("id")), eq(schema.contracts.tenantId, tenantId))).get();
    if (!contract) return c.json({ error: "Non trovato" }, 404);
    return c.json({ contract }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [contract] = await db.update(schema.contracts).set({
      title: body.title,
      content: body.content,
      status: body.status,
      updatedAt: new Date(),
    }).where(and(eq(schema.contracts.id, c.req.param("id")), eq(schema.contracts.tenantId, tenantId))).returning();
    return c.json({ contract }, 200);
  })
  // Public: get contract by share token
  .get("/sign/:token", async (c) => {
    const contract = await db.select().from(schema.contracts)
      .where(eq(schema.contracts.shareToken, c.req.param("token"))).get();
    if (!contract) return c.json({ error: "Non trovato" }, 404);
    return c.json({ contract }, 200);
  })
  // Public: sign contract
  .post("/sign/:token", async (c) => {
    const contract = await db.select().from(schema.contracts)
      .where(eq(schema.contracts.shareToken, c.req.param("token"))).get();
    if (!contract) return c.json({ error: "Non trovato" }, 404);
    if (contract.status === "signed") return c.json({ error: "Già firmato" }, 400);
    const body = await c.req.json();
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "unknown";
    const [updated] = await db.update(schema.contracts).set({
      status: "signed",
      signedAt: new Date(),
      signerIp: ip,
      signerName: body.signerName,
      signerEmail: body.signerEmail,
      updatedAt: new Date(),
    }).where(eq(schema.contracts.id, contract.id)).returning();
    return c.json({ contract: updated }, 200);
  });
