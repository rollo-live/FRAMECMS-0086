import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedGetUrl } from "../lib/s3";

// Helper: resolve client from token (in path or header)
async function resolveClientToken(tokenValue: string) {
  const ct = await db.select().from(schema.clientTokens)
    .where(eq(schema.clientTokens.token, tokenValue)).get();
  if (!ct) return null;
  if (ct.expiresAt && ct.expiresAt < new Date()) return null;
  return ct;
}

// Public client portal routes — authenticated via clientToken in URL param or x-client-token header
export const portal = new Hono()
  // GET /verify/:token — verify token and return client + projects + galleries + videos
  .get("/verify/:token", async (c) => {
    const token = c.req.param("token");
    const ct = await resolveClientToken(token);
    if (!ct) return c.json({ error: "Token non valido o scaduto" }, 401);

    const client = await db.select().from(schema.clients)
      .where(eq(schema.clients.id, ct.clientId)).get();
    if (!client) return c.json({ error: "Cliente non trovato" }, 404);

    const tenant = await db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, client.tenantId)).get();

    // Get projects
    const projects = await db.select().from(schema.projects)
      .where(eq(schema.projects.clientId, ct.clientId));

    // For each project, attach galleries and videos that have a shareToken
    const projectsWithMedia = await Promise.all(projects.map(async (p) => {
      const galleries = await db.select({
        id: schema.galleries.id,
        name: schema.galleries.name,
        shareToken: schema.galleries.shareToken,
      }).from(schema.galleries)
        .where(and(eq(schema.galleries.projectId, p.id), eq(schema.galleries.isActive, true)));

      const videos = await db.select({
        id: schema.videos.id,
        title: schema.videos.title,
        version: schema.videos.version,
        shareToken: schema.videos.shareToken,
      }).from(schema.videos)
        .where(eq(schema.videos.projectId, p.id));

      return {
        ...p,
        galleries: galleries.filter((g) => !!g.shareToken),
        videos: videos.filter((v) => !!v.shareToken),
      };
    }));

    return c.json({ client, projects: projectsWithMedia, tenant }, 200);
  })
  // POST /verify (legacy)
  .post("/verify", async (c) => {
    const body = await c.req.json();
    const ct = await resolveClientToken(body.token);
    if (!ct) return c.json({ error: "Token non valido" }, 401);
    const client = await db.select().from(schema.clients)
      .where(eq(schema.clients.id, ct.clientId)).get();
    if (!client) return c.json({ error: "Cliente non trovato" }, 404);
    const tenant = await db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, client.tenantId)).get();
    return c.json({ client, tenant }, 200);
  })
  // Get projects for client (legacy)
  .post("/projects", async (c) => {
    const body = await c.req.json();
    const ct = await resolveClientToken(body.token);
    if (!ct) return c.json({ error: "Token non valido" }, 401);
    const projs = await db.select().from(schema.projects)
      .where(eq(schema.projects.clientId, ct.clientId));
    return c.json({ projects: projs }, 200);
  });
