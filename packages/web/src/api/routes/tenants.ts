import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";

export const tenants = new Hono()
  .get("/me", requireAuth, async (c) => {
    const user = c.get("user")!;
    const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id)).get();
    if (!profile?.tenantId) return c.json({ tenant: null }, 200);
    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, profile.tenantId)).get();
    return c.json({ tenant: tenant ?? null }, 200);
  })
  .post("/setup", requireAuth, async (c) => {
    const user = c.get("user")!;
    const existing = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id)).get();
    if (existing?.tenantId) {
      const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, existing.tenantId)).get();
      return c.json({ tenant }, 200);
    }
    const body = await c.req.json();
    const slug = (body.name as string).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + nanoid(6);
    const [tenant] = await db.insert(schema.tenants).values({
      id: nanoid(),
      ownerId: user.id,
      name: body.name,
      slug,
      primaryColor: "#F5A623",
    }).returning();
    await db.insert(schema.userProfiles).values({ userId: user.id, tenantId: tenant.id, role: "owner" });
    return c.json({ tenant }, 201);
  })
  .put("/me", requireAuth, async (c) => {
    const user = c.get("user")!;
    const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id)).get();
    if (!profile?.tenantId) return c.json({ error: "Nessun tenant" }, 404);
    const body = await c.req.json();
    const [tenant] = await db.update(schema.tenants).set({
      name: body.name,
      logo: body.logo,
      primaryColor: body.primaryColor,
    }).where(eq(schema.tenants.id, profile.tenantId)).returning();
    return c.json({ tenant }, 200);
  });
