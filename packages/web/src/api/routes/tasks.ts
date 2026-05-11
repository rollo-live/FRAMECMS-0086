import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const tasks = new Hono()
  // GET /api/tasks — tutti i task del tenant (esclusi "done"), con nome progetto
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ tasks: [] }, 200);

    const allTasks = await db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.tenantId, tenantId), ne(schema.tasks.status, "done")));

    // Fetch project names
    const projectIds = [...new Set(allTasks.map((t) => t.projectId))];
    const projectMap: Record<string, string> = {};
    for (const pid of projectIds) {
      const proj = await db.select({ id: schema.projects.id, name: schema.projects.name })
        .from(schema.projects).where(eq(schema.projects.id, pid)).get();
      if (proj) projectMap[proj.id] = proj.name;
    }

    const enriched = allTasks.map((t) => ({ ...t, projectName: projectMap[t.projectId] ?? null }));
    return c.json({ tasks: enriched }, 200);
  });
