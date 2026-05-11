import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { getPresignedUploadUrl, getPresignedGetUrl } from "../lib/s3";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const videos = new Hono()
  // ─── Public routes (must be before /:id) ───────────────────────────────────
  .get("/shared/:token", async (c) => {
    const video = await db.select().from(schema.videos)
      .where(eq(schema.videos.shareToken, c.req.param("token"))).get();
    if (!video) return c.json({ error: "Non trovato" }, 404);
    const url = video.r2Key ? await getPresignedGetUrl(video.r2Key, 7200) : null;
    const comments = await db.select().from(schema.videoComments)
      .where(eq(schema.videoComments.videoId, video.id))
      .orderBy(asc(schema.videoComments.timecodeMs));
    return c.json({ video: { ...video, url }, comments }, 200);
  })
  .post("/shared/:token/comments", async (c) => {
    const video = await db.select().from(schema.videos)
      .where(eq(schema.videos.shareToken, c.req.param("token"))).get();
    if (!video) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const ct = body.clientToken
      ? await db.select().from(schema.clientTokens).where(eq(schema.clientTokens.token, body.clientToken)).get()
      : null;
    const client = ct ? await db.select().from(schema.clients).where(eq(schema.clients.id, ct.clientId)).get() : null;
    const [comment] = await db.insert(schema.videoComments).values({
      id: nanoid(),
      videoId: video.id,
      clientId: ct?.clientId,
      authorName: client?.name ?? body.authorName ?? "Cliente",
      timecodeMs: body.timecodeMs,
      text: body.content ?? body.text,
    }).returning();
    return c.json({ comment }, 201);
  })

  // ─── Authenticated routes ───────────────────────────────────────────────────
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ videos: [] }, 200);
    const all = await db.select().from(schema.videos)
      .where(eq(schema.videos.tenantId, tenantId))
      .orderBy(desc(schema.videos.createdAt));
    return c.json({ videos: all }, 200);
  })
  .post("/presign", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const body = await c.req.json();
    const key = `videos/${tenantId}/${nanoid()}-${body.filename}`;
    const url = await getPresignedUploadUrl(key, body.contentType ?? "video/mp4", 3600);
    return c.json({ url, key }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const shareToken = nanoid(32);
    const [video] = await db.insert(schema.videos).values({
      id: nanoid(),
      projectId: body.projectId || null,
      tenantId,
      title: body.title,
      version: body.version ?? "v1",
      r2Key: body.r2Key ?? "",
      duration: body.duration,
      shareToken,
    }).returning();
    return c.json({ video }, 201);
  })
  .post("/share", requireAuth, async (c) => {
    // fallback share endpoint (not used but kept for safety)
    return c.json({ error: "Usa /api/videos/:id/share" }, 400);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const video = await db.select().from(schema.videos)
      .where(and(eq(schema.videos.id, c.req.param("id")), eq(schema.videos.tenantId, tenantId))).get();
    if (!video) return c.json({ error: "Non trovato" }, 404);
    const url = video.r2Key ? await getPresignedGetUrl(video.r2Key, 7200) : null;
    const comments = await db.select().from(schema.videoComments)
      .where(eq(schema.videoComments.videoId, video.id))
      .orderBy(asc(schema.videoComments.timecodeMs));
    return c.json({ video: { ...video, url }, comments }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [video] = await db.update(schema.videos).set({
      title: body.title,
      version: body.version,
      allowDownload: body.allowDownload ?? true,
      watermarkEnabled: body.watermarkEnabled ?? false,
      watermarkText: body.watermarkText ?? null,
    }).where(and(eq(schema.videos.id, c.req.param("id")), eq(schema.videos.tenantId, tenantId))).returning();
    return c.json({ video }, 200);
  })
  .post("/:id/share", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const video = await db.select().from(schema.videos)
      .where(and(eq(schema.videos.id, c.req.param("id")), eq(schema.videos.tenantId, tenantId))).get();
    if (!video) return c.json({ error: "Non trovato" }, 404);
    // Return existing token or generate new one
    const token = video.shareToken ?? nanoid(32);
    if (!video.shareToken) {
      await db.update(schema.videos).set({ shareToken: token })
        .where(eq(schema.videos.id, video.id));
    }
    return c.json({ shareToken: token }, 200);
  })
  // Comments (authenticated - pro side)
  .get("/:id/comments", requireAuth, async (c) => {
    const comments = await db.select().from(schema.videoComments)
      .where(eq(schema.videoComments.videoId, c.req.param("id")))
      .orderBy(asc(schema.videoComments.timecodeMs));
    return c.json({ comments }, 200);
  })
  .post("/:id/comments", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const [comment] = await db.insert(schema.videoComments).values({
      id: nanoid(),
      videoId: c.req.param("id"),
      authorName: body.authorName ?? user.name,
      timecodeMs: body.timecodeMs,
      text: body.content ?? body.text,
    }).returning();
    return c.json({ comment }, 201);
  })
  // PATCH /:id/comments/:commentId — resolve (matches frontend call)
  .patch("/:id/comments/:commentId", requireAuth, async (c) => {
    const body = await c.req.json();
    const [comment] = await db.update(schema.videoComments)
      .set({ resolved: body.resolved ?? true })
      .where(eq(schema.videoComments.id, c.req.param("commentId")))
      .returning();
    return c.json({ comment }, 200);
  });
