import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { getPresignedUploadUrl, getPresignedGetUrl } from "../lib/s3";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const galleries = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ galleries: [] }, 200);
    const all = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.tenantId, tenantId))
      .orderBy(desc(schema.galleries.createdAt));
    return c.json({ galleries: all }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const shareToken = nanoid(32);
    const [gallery] = await db.insert(schema.galleries).values({
      id: nanoid(),
      projectId: body.projectId || null,
      tenantId,
      title: body.name ?? body.title,
      watermarkEnabled: body.watermarkEnabled ?? true,
      downloadEnabled: body.downloadEnabled ?? false,
      downloadWithWatermark: body.downloadWithWatermark ?? true,
      shareToken,
    }).returning();
    return c.json({ gallery }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Non trovato" }, 404);
    const galleryPhotos = await db.select().from(schema.photos)
      .where(eq(schema.photos.galleryId, gallery.id))
      .orderBy(schema.photos.order);
    // Get presigned URLs for each photo
    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => ({
      ...p,
      url: await getPresignedGetUrl(p.r2Key),
      thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey) : null,
    })));
    return c.json({ gallery, photos: photosWithUrls }, 200);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const body = await c.req.json();
    const [gallery] = await db.update(schema.galleries).set({
      title: body.title,
      watermarkEnabled: body.watermarkEnabled,
      downloadEnabled: body.downloadEnabled,
      downloadWithWatermark: body.downloadWithWatermark,
    }).where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).returning();
    return c.json({ gallery }, 200);
  })
  // Presign upload
  .post("/:id/presign", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const body = await c.req.json();
    const files: { filename: string; contentType: string }[] = body.files;
    const urls = await Promise.all(files.map(async (f) => {
      const key = `galleries/${c.req.param("id")}/${nanoid()}-${f.filename}`;
      const url = await getPresignedUploadUrl(key, f.contentType);
      return { key, url, filename: f.filename };
    }));
    return c.json({ urls }, 200);
  })
  // Save photo after upload
  .post("/:id/photos", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const body = await c.req.json();
    const photos: { filename: string; r2Key: string; width?: number; height?: number }[] = body.photos;
    const existing = await db.select().from(schema.photos).where(eq(schema.photos.galleryId, c.req.param("id"))).all();
    const inserted = await db.insert(schema.photos).values(
      photos.map((p, i) => ({
        id: nanoid(),
        galleryId: c.req.param("id"),
        filename: p.filename,
        r2Key: p.r2Key,
        width: p.width,
        height: p.height,
        order: existing.length + i,
      }))
    ).returning();
    return c.json({ photos: inserted }, 201);
  })
  // Photo comments
  .get("/photos/:photoId/comments", requireAuth, async (c) => {
    const comments = await db.select().from(schema.photoComments)
      .where(eq(schema.photoComments.photoId, c.req.param("photoId")))
      .orderBy(desc(schema.photoComments.createdAt));
    return c.json({ comments }, 200);
  })
  .post("/photos/:photoId/comments", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const [comment] = await db.insert(schema.photoComments).values({
      id: nanoid(),
      photoId: c.req.param("photoId"),
      authorName: user.name,
      text: body.text,
    }).returning();
    return c.json({ comment }, 201);
  })
  .put("/comments/:commentId/resolve", requireAuth, async (c) => {
    const [comment] = await db.update(schema.photoComments)
      .set({ resolved: true })
      .where(eq(schema.photoComments.id, c.req.param("commentId")))
      .returning();
    return c.json({ comment }, 200);
  })
  // Public: gallery by share token
  .get("/shared/:token", async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Non trovata" }, 404);
    const galleryPhotos = await db.select().from(schema.photos)
      .where(eq(schema.photos.galleryId, gallery.id)).orderBy(schema.photos.order);
    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => ({
      ...p,
      url: await getPresignedGetUrl(p.r2Key),
    })));
    return c.json({ gallery, photos: photosWithUrls }, 200);
  })
  // Public: toggle like on photo
  .post("/photos/:photoId/like", async (c) => {
    const body = await c.req.json();
    const clientToken = body.clientToken as string;
    if (!clientToken) return c.json({ error: "Token richiesto" }, 400);
    const ct = await db.select().from(schema.clientTokens).where(eq(schema.clientTokens.token, clientToken)).get();
    if (!ct) return c.json({ error: "Token non valido" }, 401);
    const photo = await db.select().from(schema.photos).where(eq(schema.photos.id, c.req.param("photoId"))).get();
    if (!photo) return c.json({ error: "Non trovata" }, 404);
    const likes: string[] = JSON.parse(photo.likes);
    const idx = likes.indexOf(ct.clientId);
    if (idx === -1) likes.push(ct.clientId);
    else likes.splice(idx, 1);
    const [updated] = await db.update(schema.photos).set({ likes: JSON.stringify(likes) })
      .where(eq(schema.photos.id, photo.id)).returning();
    return c.json({ photo: updated, liked: idx === -1 }, 200);
  })
  // Public: comment on photo
  .post("/photos/:photoId/public-comment", async (c) => {
    const body = await c.req.json();
    const ct = await db.select().from(schema.clientTokens).where(eq(schema.clientTokens.token, body.clientToken)).get();
    if (!ct) return c.json({ error: "Token non valido" }, 401);
    const client = await db.select().from(schema.clients).where(eq(schema.clients.id, ct.clientId)).get();
    const [comment] = await db.insert(schema.photoComments).values({
      id: nanoid(),
      photoId: c.req.param("photoId"),
      clientId: ct.clientId,
      authorName: client?.name ?? "Cliente",
      text: body.text,
    }).returning();
    return c.json({ comment }, 201);
  });
