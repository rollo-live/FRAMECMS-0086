import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc, asc, count, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { galleryAccessRateLimit } from "../middleware/rate-limit";
import { nanoid } from "../lib/id";
import { getPresignedUploadUrl, getPresignedGetUrl, deleteObject } from "../lib/s3";
import { detectFaces, cosineSimilarity, averageEmbeddings, FACE_MATCH_THRESHOLD } from "../lib/face-detection";

// Cache tenantId per userId (valore stabile, TTL 5min)
const tenantIdCache = new Map<string, { id: string; exp: number }>();
async function getTenantId(userId: string) {
  const cached = tenantIdCache.get(userId);
  if (cached && cached.exp > Date.now()) return cached.id;
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  const id = p?.tenantId ?? null;
  if (id) tenantIdCache.set(userId, { id, exp: Date.now() + 5 * 60 * 1000 });
  return id;
}

async function getTenantInfo(tenantId: string) {
  return db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
}

export const galleries = new Hono()
  // ── PUBLIC: gallery by share token (MUST be before /:id) ─────────────────
  .get("/shared/:token", async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Non trovata" }, 404);

    const tenant = await getTenantInfo(gallery.tenantId);

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
      .where(eq(schema.photos.galleryId, gallery.id)).orderBy(asc(schema.photos.order));

    const visitorId = accessEntry?.id ?? null;

    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => {
      const likes: string[] = JSON.parse(p.likes || "[]");
      try {
        return {
          ...p,
          url: await getPresignedGetUrl(p.r2Key),
          thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey) : null,
          likeCount: likes.length,
          likedByMe: visitorId ? likes.includes(visitorId) : false,
        };
      } catch (e) {
        console.error("Presign error", p.id, e);
        return { ...p, url: "", thumbnailUrl: null, likeCount: likes.length, likedByMe: false };
      }
    }));

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

  // ── PUBLIC: request access ────────────────────────────────────────────────
  .post("/shared/:token/access", galleryAccessRateLimit, async (c) => {
    const gallery = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.shareToken, c.req.param("token"))).get();
    if (!gallery) return c.json({ error: "Gallery non trovata" }, 404);
    if (!gallery.accessGate) return c.json({ error: "Accesso libero" }, 400);

    const body = await c.req.json();
    const { firstName, lastName, email } = body;
    if (!firstName || !lastName || !email) return c.json({ error: "Dati mancanti" }, 400);

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

    // Wrap read-modify-write in a transaction to avoid race conditions
    type LikeResult = { liked: boolean; likeCount: number; updated: typeof photo };
    const result = await db.transaction(async (tx) => {
      // Re-read inside transaction for freshest state
      const freshPhoto = await tx.select().from(schema.photos)
        .where(eq(schema.photos.id, photo.id)).get();
      if (!freshPhoto) throw new Error("Foto non trovata");

      const likes: string[] = JSON.parse(freshPhoto.likes || "[]");
      const idx = likes.indexOf(visitorId);

      if (idx === -1 && gallery.likeLimit > 0) {
        const allPhotos = await tx.select().from(schema.photos)
          .where(eq(schema.photos.galleryId, gallery.id)).all();
        const totalLikes = allPhotos.reduce((n, p) => {
          const pl: string[] = JSON.parse(p.likes || "[]");
          return n + (pl.includes(visitorId) ? 1 : 0);
        }, 0);
        if (totalLikes >= gallery.likeLimit) {
          throw Object.assign(new Error("Limite like raggiunto"), { limitReached: true, status: 400 });
        }
      }

      if (idx === -1) likes.push(visitorId);
      else likes.splice(idx, 1);

      const [updated] = await tx.update(schema.photos)
        .set({ likes: JSON.stringify(likes) })
        .where(eq(schema.photos.id, freshPhoto.id)).returning();

      return { liked: idx === -1, likeCount: likes.length, updated } as LikeResult;
    }).catch((err: any) => {
      if (err?.limitReached) return { limitReached: true, error: err.message } as any;
      throw err;
    });

    if ((result as any).limitReached) {
      return c.json({ error: (result as any).error, limitReached: true }, 400);
    }
    const { liked, likeCount, updated } = result as LikeResult;
    return c.json({
      liked,
      likeCount,
      photo: { ...updated, likeCount, likedByMe: liked },
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
  })

  // ── Photo comments admin (MUST be before /:id) ───────────────────────────
  .get("/photos/:photoId/comments", requireAuth, async (c) => {
    const comments = await db.select().from(schema.photoComments)
      .where(eq(schema.photoComments.photoId, c.req.param("photoId")))
      .orderBy(asc(schema.photoComments.createdAt));
    return c.json({ comments }, 200);
  })
  .post("/photos/:photoId/comments", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const [comment] = await db.insert(schema.photoComments).values({
      id: nanoid(),
      photoId: c.req.param("photoId"),
      authorName: user.name,
      text: body.text ?? body.content,
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

  // ── Admin: list ──────────────────────────────────────────────────────────
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ galleries: [] }, 200);
    const all = await db.select().from(schema.galleries)
      .where(eq(schema.galleries.tenantId, tenantId))
      .orderBy(desc(schema.galleries.createdAt));

    if (all.length === 0) return c.json({ galleries: [] }, 200);

    const galleryIds = all.map(g => g.id);

    // Batch: count + first photo per gallery in 2 queries totali invece di N*2
    const [counts, firstPhotos] = await Promise.all([
      db.select({ galleryId: schema.photos.galleryId, value: count() })
        .from(schema.photos)
        .where(inArray(schema.photos.galleryId, galleryIds))
        .groupBy(schema.photos.galleryId),
      db.select().from(schema.photos)
        .where(inArray(schema.photos.galleryId, galleryIds))
        .orderBy(asc(schema.photos.order)),
    ]);

    const countMap = new Map(counts.map(c => [c.galleryId, c.value]));
    // Prima foto per gallery (già ordinate per order)
    const firstPhotoMap = new Map<string, typeof schema.photos.$inferSelect>();
    for (const p of firstPhotos) {
      if (!firstPhotoMap.has(p.galleryId)) firstPhotoMap.set(p.galleryId, p);
    }

    const withMeta = await Promise.all(all.map(async (g) => {
      const firstPhoto = firstPhotoMap.get(g.id);
      const photoCount = countMap.get(g.id) ?? 0;
      let coverUrl: string | null = null;
      if (firstPhoto) {
        try { coverUrl = await getPresignedGetUrl(firstPhoto.r2Key, 3600); } catch { /* ignore */ }
      }
      return { ...g, photoCount, coverUrl };
    }));

    return c.json({ galleries: withMeta }, 200);
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
      .orderBy(asc(schema.photos.order));
    const photosWithUrls = await Promise.all(galleryPhotos.map(async (p) => {
      try {
        return {
          ...p,
          url: await getPresignedGetUrl(p.r2Key),
          thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey) : null,
          likeCount: JSON.parse(p.likes || "[]").length,
        };
      } catch (e) {
        console.error("Presign error for photo", p.id, e);
        return { ...p, url: "", thumbnailUrl: null, likeCount: 0 };
      }
    }));
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

  // ── Delete gallery (+ all photos from R2) ────────────────────────────────
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Non trovato" }, 404);

    // Delete all photos from R2
    const photos = await db.select().from(schema.photos).where(eq(schema.photos.galleryId, gallery.id)).all();
    await Promise.allSettled(photos.map((p) => deleteObject(p.r2Key)));

    // Delete DB records (photos, comments, access requests, gallery)
    await db.delete(schema.photoComments).where(
      eq(schema.photoComments.photoId, photos[0]?.id ?? "") // covered via cascade or manual
    );
    for (const p of photos) {
      await db.delete(schema.photoComments).where(eq(schema.photoComments.photoId, p.id));
    }
    await db.delete(schema.photos).where(eq(schema.photos.galleryId, gallery.id));
    await db.delete(schema.galleryAccess).where(eq(schema.galleryAccess.galleryId, gallery.id));
    await db.delete(schema.galleries).where(eq(schema.galleries.id, gallery.id));

    return c.json({ ok: true }, 200);
  })

  // ── Delete single photo from gallery (+ R2) ──────────────────────────────
  .delete("/:id/photos/:photoId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);
    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Gallery non trovata" }, 404);
    const photo = await db.select().from(schema.photos)
      .where(and(eq(schema.photos.id, c.req.param("photoId")), eq(schema.photos.galleryId, gallery.id))).get();
    if (!photo) return c.json({ error: "Foto non trovata" }, 404);

    await deleteObject(photo.r2Key);
    await db.delete(schema.photoComments).where(eq(schema.photoComments.photoId, photo.id));
    await db.delete(schema.photos).where(eq(schema.photos.id, photo.id));

    return c.json({ ok: true }, 200);
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

  // ── Face recognition: analyze photos in gallery ───────────────────────────
  // Called after upload to detect faces and cluster into persone
  .post("/:id/photos/analyze", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);

    const gallery = await db.select().from(schema.galleries)
      .where(and(eq(schema.galleries.id, c.req.param("id")), eq(schema.galleries.tenantId, tenantId))).get();
    if (!gallery) return c.json({ error: "Gallery non trovata" }, 404);

    // Get photos that haven't been analyzed yet (no entry in foto_persone)
    const body = await c.req.json().catch(() => ({})) as { photoIds?: string[] };
    let photos: typeof schema.photos.$inferSelect[] = [];

    if (body.photoIds && body.photoIds.length > 0) {
      photos = await db.select().from(schema.photos)
        .where(and(
          eq(schema.photos.galleryId, gallery.id),
          inArray(schema.photos.id, body.photoIds)
        )).all();
    } else {
      photos = await db.select().from(schema.photos)
        .where(eq(schema.photos.galleryId, gallery.id)).all();
    }

    // Load existing persone for this tenant
    let persone = await db.select().from(schema.facePersone)
      .where(eq(schema.facePersone.tenantId, tenantId)).all();

    let newFaces = 0;
    let newPersone = 0;

    for (const photo of photos) {
      try {
        // Skip photos already analyzed
        const existing = await db.select().from(schema.fotoPersone)
          .where(eq(schema.fotoPersone.photoId, photo.id)).all();
        if (existing.length > 0) continue;

        // Download photo from R2
        const photoUrl = await getPresignedGetUrl(photo.r2Key, 60);
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) continue;
        const buffer = Buffer.from(await imgRes.arrayBuffer());

        // Detect faces
        const faces = await detectFaces(buffer);
        newFaces += faces.length;

        for (const face of faces) {
          // Try to match with existing person
          let matchedPersona: typeof schema.facePersone.$inferSelect | null = null;
          let bestSim = 0;

          for (const persona of persone) {
            if (!persona.embeddingMedio) continue;
            const mean: number[] = JSON.parse(persona.embeddingMedio);
            const sim = cosineSimilarity(face.embedding, mean);
            if (sim > FACE_MATCH_THRESHOLD && sim > bestSim) {
              bestSim = sim;
              matchedPersona = persona;
            }
          }

          if (matchedPersona) {
            // Add this face to existing person + update mean embedding
            await db.insert(schema.fotoPersone).values({
              id: nanoid(),
              photoId: photo.id,
              personaId: matchedPersona.id,
              embedding: JSON.stringify(face.embedding),
              faceBox: JSON.stringify(face.box),
            });

            // Recompute mean embedding
            const allFotoPersona = await db.select().from(schema.fotoPersone)
              .where(eq(schema.fotoPersone.personaId, matchedPersona.id)).all();
            const embeddings = allFotoPersona
              .filter((fp) => fp.embedding)
              .map((fp) => JSON.parse(fp.embedding!) as number[]);
            embeddings.push(face.embedding);
            const newMean = averageEmbeddings(embeddings);

            await db.update(schema.facePersone)
              .set({ embeddingMedio: JSON.stringify(newMean) })
              .where(eq(schema.facePersone.id, matchedPersona.id));

            // Update local cache
            matchedPersona.embeddingMedio = JSON.stringify(newMean);
          } else {
            // Create new person
            const personaId = nanoid();
            newPersone++;
            const [nuovaPersona] = await db.insert(schema.facePersone).values({
              id: personaId,
              tenantId,
              nome: `Persona ${persone.length + 1}`,
              embeddingMedio: JSON.stringify(face.embedding),
              coverPhotoId: photo.id,
            }).returning();

            await db.insert(schema.fotoPersone).values({
              id: nanoid(),
              photoId: photo.id,
              personaId,
              embedding: JSON.stringify(face.embedding),
              faceBox: JSON.stringify(face.box),
            });

            persone.push(nuovaPersona);
          }
        }
      } catch (e) {
        console.error("[analyze] error on photo", photo.id, e);
      }
    }

    return c.json({ analyzed: photos.length, newFaces, newPersone }, 200);
  })

  // ── Face recognition: list persone ───────────────────────────────────────
  .get("/persone", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ persone: [] }, 200);

    const persone = await db.select().from(schema.facePersone)
      .where(eq(schema.facePersone.tenantId, tenantId))
      .orderBy(asc(schema.facePersone.createdAt));

    if (persone.length === 0) return c.json({ persone: [] }, 200);

    const personaIds = persone.map(p => p.id);

    // Batch: count foto per persona + recupera cover photos in 3 query totali
    const [fotoCounts, fotoLinks] = await Promise.all([
      db.select({ personaId: schema.fotoPersone.personaId, value: count() })
        .from(schema.fotoPersone)
        .where(inArray(schema.fotoPersone.personaId, personaIds))
        .groupBy(schema.fotoPersone.personaId),
      db.select().from(schema.fotoPersone)
        .where(inArray(schema.fotoPersone.personaId, personaIds)),
    ]);

    const countMap = new Map(fotoCounts.map(f => [f.personaId, f.value]));
    // Prima foto per persona
    const firstFotoMap = new Map<string, string>(); // personaId -> photoId
    for (const f of fotoLinks) {
      if (!firstFotoMap.has(f.personaId)) firstFotoMap.set(f.personaId, f.photoId);
    }

    // Recupera le cover photos in batch
    const coverPhotoIds = persone.map(p => p.coverPhotoId ?? firstFotoMap.get(p.id)).filter(Boolean) as string[];
    const coverPhotos = coverPhotoIds.length > 0
      ? await db.select().from(schema.photos).where(inArray(schema.photos.id, coverPhotoIds))
      : [];
    const coverPhotoMap = new Map(coverPhotos.map(p => [p.id, p]));

    const result = await Promise.all(persone.map(async (p) => {
      const photoCount = countMap.get(p.id) ?? 0;
      let coverUrl: string | null = null;
      const coverPhotoId = p.coverPhotoId ?? firstFotoMap.get(p.id);
      const coverPhoto = coverPhotoId ? coverPhotoMap.get(coverPhotoId) : undefined;
      if (coverPhoto) {
        try { coverUrl = await getPresignedGetUrl(coverPhoto.r2Key, 3600); } catch { /* ignore */ }
      }
      return {
        id: p.id,
        nome: p.nome,
        photoCount,
        coverUrl,
        visibileASoci: p.visibileASoci,
        createdAt: p.createdAt,
      };
    }));

    return c.json({ persone: result }, 200);
  })

  // ── Face recognition: rinomina persona ───────────────────────────────────
  .put("/persone/:personaId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);

    const body = await c.req.json();
    const [updated] = await db.update(schema.facePersone)
      .set({
        nome: body.nome,
        visibileASoci: body.visibileASoci ?? undefined,
      })
      .where(and(
        eq(schema.facePersone.id, c.req.param("personaId")),
        eq(schema.facePersone.tenantId, tenantId)
      ))
      .returning();

    return c.json({ persona: updated }, 200);
  })

  // ── Face recognition: elimina persona ────────────────────────────────────
  .delete("/persone/:personaId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);

    const persona = await db.select().from(schema.facePersone)
      .where(and(
        eq(schema.facePersone.id, c.req.param("personaId")),
        eq(schema.facePersone.tenantId, tenantId)
      )).get();
    if (!persona) return c.json({ error: "Non trovata" }, 404);

    await db.delete(schema.fotoPersone).where(eq(schema.fotoPersone.personaId, persona.id));
    await db.delete(schema.facePersone).where(eq(schema.facePersone.id, persona.id));

    return c.json({ ok: true }, 200);
  })

  // ── Face recognition: foto di una persona ────────────────────────────────
  .get("/persone/:personaId/foto", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);

    const persona = await db.select().from(schema.facePersone)
      .where(and(
        eq(schema.facePersone.id, c.req.param("personaId")),
        eq(schema.facePersone.tenantId, tenantId)
      )).get();
    if (!persona) return c.json({ error: "Non trovata" }, 404);

    const fotoLinks = await db.select().from(schema.fotoPersone)
      .where(eq(schema.fotoPersone.personaId, persona.id)).all();

    const photoIds = fotoLinks.map((fl) => fl.photoId);
    if (photoIds.length === 0) return c.json({ persona, foto: [] }, 200);

    const photos = await db.select().from(schema.photos)
      .where(inArray(schema.photos.id, photoIds)).all();

    const fotosWithUrls = await Promise.all(photos.map(async (p) => {
      const link = fotoLinks.find((fl) => fl.photoId === p.id);
      try {
        return {
          ...p,
          url: await getPresignedGetUrl(p.r2Key, 3600),
          thumbnailUrl: p.thumbnailKey ? await getPresignedGetUrl(p.thumbnailKey, 3600) : null,
          faceBox: link?.faceBox ? JSON.parse(link.faceBox) : null,
          likeCount: JSON.parse(p.likes || "[]").length,
        };
      } catch {
        return { ...p, url: "", thumbnailUrl: null, faceBox: null, likeCount: 0 };
      }
    }));

    return c.json({ persona: { id: persona.id, nome: persona.nome }, foto: fotosWithUrls }, 200);
  })

  // ── Face recognition: tag persone per una foto ───────────────────────────
  .get("/photos/:photoId/persone", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ persone: [] }, 200);

    const links = await db.select().from(schema.fotoPersone)
      .where(eq(schema.fotoPersone.photoId, c.req.param("photoId"))).all();

    if (links.length === 0) return c.json({ persone: [] }, 200);

    const personaIds = links.map((l) => l.personaId);
    const persone = await db.select().from(schema.facePersone)
      .where(and(
        inArray(schema.facePersone.id, personaIds),
        eq(schema.facePersone.tenantId, tenantId)
      )).all();

    return c.json({ persone: persone.map((p) => ({ id: p.id, nome: p.nome })) }, 200);
  })

  // ── Face recognition: rimuovi tag foto-persona ────────────────────────────
  .delete("/photos/:photoId/persone/:personaId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non autorizzato" }, 401);

    await db.delete(schema.fotoPersone).where(
      and(
        eq(schema.fotoPersone.photoId, c.req.param("photoId")),
        eq(schema.fotoPersone.personaId, c.req.param("personaId"))
      )
    );

    return c.json({ ok: true }, 200);
  })

;
