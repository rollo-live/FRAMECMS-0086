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

export const projects = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ projects: [] }, 200);
    const all = await db.select().from(schema.projects)
      .where(eq(schema.projects.tenantId, tenantId))
      .orderBy(desc(schema.projects.createdAt));
    return c.json({ projects: all }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const [project] = await db.insert(schema.projects).values({
      id: nanoid(),
      tenantId,
      clientId: body.clientId,
      contractId: body.contractId,
      name: body.name,
      type: body.type ?? "photo",
      status: "planning",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      location: body.location,
      notes: body.notes,
    }).returning();
    // Auto-create tasks if contract provided (automation)
    if (body.contractId) {
      await db.insert(schema.tasks).values([
        { id: nanoid(), projectId: project.id, tenantId, title: "📷 Shooting", status: "todo", priority: "high", order: 0 },
        { id: nanoid(), projectId: project.id, tenantId, title: "🎬 Post-produzione", status: "todo", priority: "medium", order: 1 },
        { id: nanoid(), projectId: project.id, tenantId, title: "✅ Consegna al cliente", status: "todo", priority: "medium", order: 2 },
      ]);
    }
    return c.json({ project }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const project = await db.select().from(schema.projects)
      .where(and(eq(schema.projects.id, c.req.param("id")), eq(schema.projects.tenantId, tenantId))).get();
    if (!project) return c.json({ error: "Non trovato" }, 404);
    const projectTasks = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.projectId, project.id))
      .orderBy(schema.tasks.order);
    const projectGalleries = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.projectId, project.id));
    const projectVideos = await db.select().from(schema.videos)
      .where(eq(schema.videos.projectId, project.id));
    return c.json({ project, tasks: projectTasks, galleries: projectGalleries, videos: projectVideos }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [project] = await db.update(schema.projects).set({
      name: body.name,
      type: body.type,
      status: body.status,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      location: body.location,
      notes: body.notes,
      updatedAt: new Date(),
    }).where(and(eq(schema.projects.id, c.req.param("id")), eq(schema.projects.tenantId, tenantId))).returning();
    return c.json({ project }, 200);
  })
  // Tasks sub-resource
  .get("/:id/tasks", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ tasks: [] }, 200);
    const all = await db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.projectId, c.req.param("id")), eq(schema.tasks.tenantId, tenantId)))
      .orderBy(schema.tasks.order);
    return c.json({ tasks: all }, 200);
  })
  .post("/:id/tasks", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const [task] = await db.insert(schema.tasks).values({
      id: nanoid(),
      projectId: c.req.param("id"),
      tenantId,
      title: body.title,
      description: body.description,
      status: body.status ?? "todo",
      priority: body.priority ?? "medium",
      assigneeId: body.assigneeId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      order: body.order ?? 0,
    }).returning();
    return c.json({ task }, 201);
  })
  .put("/:id/tasks/:taskId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [task] = await db.update(schema.tasks).set({
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assigneeId: body.assigneeId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      order: body.order,
      updatedAt: new Date(),
    }).where(and(eq(schema.tasks.id, c.req.param("taskId")), eq(schema.tasks.tenantId, tenantId))).returning();
    return c.json({ task }, 200);
  })
  .delete("/:id/tasks/:taskId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.tasks)
      .where(and(eq(schema.tasks.id, c.req.param("taskId")), eq(schema.tasks.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  });
