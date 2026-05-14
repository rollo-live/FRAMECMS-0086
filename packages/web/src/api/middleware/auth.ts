import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { db } from "../database";
import { userProfiles } from "../database/schema";
import { eq } from "drizzle-orm";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  return next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ message: "Non autorizzato" }, 401);

  // Cache tenantId once per request so route handlers don't each hit the DB
  if (!c.get("tenantId" as any)) {
    const profile = await db
      .select({ tenantId: userProfiles.tenantId })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();
    (c as any).set("tenantId", profile?.tenantId ?? null);
  }

  return next();
});

/** Convenience helper — reads cached tenantId from context (set by requireAuth) */
export function getTenantIdFromCtx(c: any): string | null {
  return (c as any).get("tenantId") ?? null;
}
