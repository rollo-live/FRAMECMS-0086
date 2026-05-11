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

async function getTenantInfo(tenantId: string) {
  return db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
}

export const galleries = new Hono()
  // ── Admin: list ──────────────────────────────────────────────────────────
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ galleries: [] }, 200);
    const all = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.tenantId, tenantId))
      .orderBy(desc(schema.galleries.createdAt));
    return c.json({ galleries: all }, 200);
  })

  // ── Admin: create ─────────────────────────────────────────────────────────
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
      accessGate: body.accessGate ?? false,
      accessApproval: body.accessApproval ?? "auto",
      likeLimit: body.likeLimit ?? 0,
      shareToken,
    }).returning();
    return c.json({ gallery }, 201);
  })

  // ── Admin: get single ─────────────────────────────────────────────────────
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
    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => ({
      ...p,
      url: await getPresignedGetUrl(p.r2Key),
      thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey) : null,
    })));
    return c.json({ gallery, photos: photosWithUrls }, 200);
  })

  // ── Admin: update ─────────────────────────────────────────────────────────
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
      accessGate: body.accessGate,
      accessApproval: body.accessApproval,
      likeLimit: body.likeLimit,
    }).where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).returning();
    return c.json({ gallery }, 200);
  })

  // ── Admin: share token ────────────────────────────────────────────────────
  .post("/:id/share", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Non trovato" }, 404);
    const shareToken = gallery.shareToken ?? nanoid(32);
    if (!gallery.shareToken) {
      await db.update(schema.galleries).set({ shareToken }).where(eq(schema.galleries.id, gallery.id));
    }
    return c.json({ shareToken }, 200);
  })

  // ── Admin: presign upload ─────────────────────────────────────────────────
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

  // ── Admin: save photos after upload ───────────────────────────────────────
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

  // ── Admin: list access requests ───────────────────────────────────────────
  .get("/:id/access", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Non trovato" }, 404);
    const requests = await db.select().from(schema.galleryAccess)
      .where(eq(schema.galleryAccess.galleryId, gallery.id))
      .orderBy(desc(schema.galleryAccess.createdAt));
    return c.json({ requests }, 200);
  })

  // ── Admin: approve/reject access ─────────────────────────────────────────
  .patch("/:id/access/:accessId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const body = await c.req.json();
    const status = body.status as "approved" | "rejected";
    if (!["approved", "rejected"].includes(status)) return c.json({ error: "Status non valido" }, 400);
    const [updated] = await db.update(schema.galleryAccess)
      .set({ status })
      .where(eq(schema.galleryAccess.id, c.req.param("accessId")))
      .returning();
    return c.json({ request: updated }, 200);
  })

  // ── Photo comments (admin) ────────────────────────────────────────────────
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

  // ── PUBLIC: gallery by share token ────────────────────────────────────────
  .get("/shared/:token", async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Non trovata" }, 404);

    const tenant = await getTenantInfo(gallery.tenantId);

    // Check access gate
    const accessToken = c.req.header("x-access-token") ?? null;
    let accessEntry: typeof schema.galleryAccess.$inferSelect | null = null;

    if (gallery.accessGate) {
      if (!accessToken) {
        return c.json({
          requiresAccess: true,
          gallery: { id: gallery.id, title: gallery.title },
          tenant: {
            brandName: tenant?.name ?? "Studio",
            primaryColor: tenant?.primaryColor ?? "#6366f1",
            logoUrl: tenant?.logo ?? null,
          },
        }, 200);
      }
      accessEntry = await db.select().from(schema.galleryAccess)
        .where(eq(schema.galleryAccess.accessToken, accessToken)).get() ?? null;
      if (!accessEntry || accessEntry.galleryId !== gallery.id) {
        return c.json({ error: "Token non valido" }, 401);
      }
      if (accessEntry.status === "pending") {
        return c.json({
          requiresApproval: true,
          gallery: { id: gallery.id, title: gallery.title },
          tenant: {
            brandName: tenant?.name ?? "Studio",
            primaryColor: tenant?.primaryColor ?? "#6366f1",
            logoUrl: tenant?.logo ?? null,
          },
        }, 200);
      }
      if (accessEntry.status === "rejected") {
        return c.json({ error: "Accesso negato" }, 403);
      }
    }

    const galleryPhotos = await db.select().from(schema.photos)
      .where(eq(schema.photos.galleryId, gallery.id)).orderBy(schema.photos.order);

    const visitorId = accessEntry?.id ?? null;

    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => {
      const likes: string[] = JSON.parse(p.likes || "[]");
      return {
        ...p,
        url: await getPresignedGetUrl(p.r2Key),
        thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey) : null,
        likeCount: likes.length,
        likedByMe: visitorId ? likes.includes(visitorId) : false,
      };
    }));

    // Count total likes by this visitor
    const myLikeCount = visitorId
      ? photosWithUrls.filter(p => p.likedByMe).length
      : 0;

    return c.json({
      gallery: {
        id: gallery.id,
        title: gallery.title,
        watermarkEnabled: gallery.watermarkEnabled,
        downloadEnabled: gallery.downloadEnabled,
        likeLimit: gallery.likeLimit,
      },
      photos: photosWithUrls,
      tenant: {
        brandName: tenant?.name ?? "Studio",
        primaryColor: tenant?.primaryColor ?? "#6366f1",
        logoUrl: tenant?.logo ?? null,
      },
      myLikeCount,
    }, 200);
  })

  // ── PUBLIC: request access (registration) ─────────────────────────────────
  .post("/shared/:token/access", async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Gallery non trovata" }, 404);
    if (!gallery.accessGate) return c.json({ error: "Accesso libero" }, 400);

    const body = await c.req.json();
    const { firstName, lastName, email } = body;
    if (!firstName || !lastName || !email) return c.json({ error: "Dati mancanti" }, 400);

    // Check existing
    const existing = await db.select().from(schema.galleryAccess)
      .where(and(
        eq(schema.galleryAccess.galleryId, gallery.id),
        eq(schema.galleryAccess.email, email.toLowerCase())
      )).get();

    if (existing) {
      return c.json({
        accessToken: existing.status === "approved" ? existing.accessToken : null,
        status: existing.status,
      }, 200);
    }

    const accessToken = nanoid(32);
    const status = gallery.accessApproval === "auto" ? "approved" : "pending";

    await db.insert(schema.galleryAccess).values({
      id: nanoid(),
      galleryId: gallery.id,
      firstName,
      lastName,
      email: email.toLowerCase(),
      status,
      accessToken,
    });

    return c.json({
      accessToken: status === "approved" ? accessToken : null,
      status,
    }, 201);
  })

  // ── PUBLIC: like toggle ───────────────────────────────────────────────────
  .post("/shared/:token/photos/:photoId/like", async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Non trovata" }, 404);

    const photo = await db.select().from(schema.photos).where(eq(schema.photos.id, c.req.param("photoId"))).get();
    if (!photo || photo.galleryId !== gallery.id) return c.json({ error: "Foto non trovata" }, 404);

    // Determine visitor identity
    let visitorId: string;
    if (gallery.accessGate) {
      const body = await c.req.json().catch(() => ({})) as Record<string, string>;
      const accessToken = body.accessToken ?? c.req.header("x-access-token");
      if (!accessToken) return c.json({ error: "Access token richiesto" }, 401);
      const entry = await db.select().from(schema.galleryAccess)
        .where(eq(schema.galleryAccess.accessToken, accessToken)).get();
      if (!entry || entry.galleryId !== gallery.id || entry.status !== "approved")
        return c.json({ error: "Accesso non autorizzato" }, 401);
      visitorId = entry.id;
    } else {
      const body = await c.req.json().catch(() => ({})) as Record<string, string>;
      visitorId = body.visitorId ?? c.req.header("x-visitor-id") ?? "anon";
    }

    const likes: string[] = JSON.parse(photo.likes || "[]");
    const idx = likes.indexOf(visitorId);

    // Like limit check (only when adding a like)
    if (idx === -1 && gallery.likeLimit > 0) {
      // Count all likes by this visitor in this gallery
      const allPhotos = await db.select().from(schema.photos)
        .where(eq(schema.photos.galleryId, gallery.id)).all();
      const totalLikes = allPhotos.reduce((count, p) => {
        const pl: string[] = JSON.parse(p.likes || "[]");
        return count + (pl.includes(visitorId) ? 1 : 0);
      }, 0);
      if (totalLikes >= gallery.likeLimit) {
        return c.json({ error: "Limite like raggiunto", limitReached: true }, 400);
      }
    }

    if (idx === -1) likes.push(visitorId);
    else likes.splice(idx, 1);

    const [updated] = await db.update(schema.photos)
      .set({ likes: JSON.stringify(likes) })
      .where(eq(schema.photos.id, photo.id)).returning();

    return c.json({
      liked: idx === -1,
      likeCount: likes.length,
      photo: { ...updated, likeCount: likes.length, likedByMe: idx === -1 },
    }, 200);
  })

  // ── PUBLIC: comment on photo ──────────────────────────────────────────────
  .post("/photos/:photoId/public-comment", async (c) => {
    const body = await c.req.json();
    const accessToken = body.accessToken ?? body.clientToken;
    const entry = accessToken
      ? await db.select().from(schema.galleryAccess).where(eq(schema.galleryAccess.accessToken, accessToken)).get()
      : null;
    const authorName = entry ? `${entry.firstName} ${entry.lastName}` : (body.authorName ?? "Visitatore");
    const [comment] = await db.insert(schema.photoComments).values({
      id: nanoid(),
      photoId: c.req.param("photoId"),
      authorName,
      text: body.text ?? body.content,
    }).returning();
    return c.json({ comment }, 201);
  });
