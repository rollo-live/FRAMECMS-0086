import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";

// Versione formato backup — incrementare se cambia struttura
const BACKUP_VERSION = 1;

async function getTenantId(userId: string): Promise<string | null> {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const backup = new Hono()

  // ─── EXPORT ───────────────────────────────────────────────────────────────
  .get("/export", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Tenant non trovato" }, 404);

    const [
      tenant,
      clientsList,
      quotesList,
      contractsList,
      projectsList,
      tasksList,
      galleriesList,
      photosList,
      photoCommentsList,
      videosList,
      videoCommentsList,
      appointmentsList,
      contabSettings,
      entrateList,
      usciteList,
      pareggiList,
      facePersoneList,
      fotoPersoneList,
    ] = await Promise.all([
      db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get(),
      db.select().from(schema.clients).where(eq(schema.clients.tenantId, tenantId)).all(),
      db.select().from(schema.quotes).where(eq(schema.quotes.tenantId, tenantId)).all(),
      db.select().from(schema.contracts).where(eq(schema.contracts.tenantId, tenantId)).all(),
      db.select().from(schema.projects).where(eq(schema.projects.tenantId, tenantId)).all(),
      db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, tenantId)).all(),
      db.select().from(schema.galleries).where(eq(schema.galleries.tenantId, tenantId)).all(),
      db.select().from(schema.photos)
        .innerJoin(schema.galleries, eq(schema.photos.galleryId, schema.galleries.id))
        .where(eq(schema.galleries.tenantId, tenantId)).all(),
      db.select().from(schema.photoComments)
        .innerJoin(schema.photos, eq(schema.photoComments.photoId, schema.photos.id))
        .innerJoin(schema.galleries, eq(schema.photos.galleryId, schema.galleries.id))
        .where(eq(schema.galleries.tenantId, tenantId)).all(),
      db.select().from(schema.videos).where(eq(schema.videos.tenantId, tenantId)).all(),
      db.select().from(schema.videoComments)
        .innerJoin(schema.videos, eq(schema.videoComments.videoId, schema.videos.id))
        .where(eq(schema.videos.tenantId, tenantId)).all(),
      db.select().from(schema.appointments).where(eq(schema.appointments.tenantId, tenantId)).all(),
      db.select().from(schema.contabilitaSettings).where(eq(schema.contabilitaSettings.tenantId, tenantId)).get(),
      db.select().from(schema.entrate).where(eq(schema.entrate.tenantId, tenantId)).all(),
      db.select().from(schema.uscite).where(eq(schema.uscite.tenantId, tenantId)).all(),
      db.select().from(schema.pareggi).where(eq(schema.pareggi.tenantId, tenantId)).all(),
      db.select().from(schema.facePersone).where(eq(schema.facePersone.tenantId, tenantId)).all(),
      db.select().from(schema.fotoPersone)
        .innerJoin(schema.facePersone, eq(schema.fotoPersone.personaId, schema.facePersone.id))
        .where(eq(schema.facePersone.tenantId, tenantId)).all(),
    ]);

    const payload = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tenantId,
      data: {
        tenant,
        clients: clientsList,
        quotes: quotesList,
        contracts: contractsList,
        projects: projectsList,
        tasks: tasksList,
        galleries: galleriesList,
        photos: photosList.map((r) => r.photos),
        photoComments: photoCommentsList.map((r) => r.photo_comments),
        videos: videosList,
        videoComments: videoCommentsList.map((r) => r.video_comments),
        appointments: appointmentsList,
        contabilitaSettings: contabSettings ?? null,
        entrate: entrateList,
        uscite: usciteList,
        pareggi: pareggiList,
        facePersone: facePersoneList,
        fotoPersone: fotoPersoneList.map((r) => r.foto_persone),
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const filename = `frame-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  })

  // ─── IMPORT ───────────────────────────────────────────────────────────────
  .post("/import", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Tenant non trovato" }, 404);

    let payload: any;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "JSON non valido" }, 400);
    }

    if (payload.version !== BACKUP_VERSION) {
      return c.json({ error: `Versione backup non supportata (attesa: ${BACKUP_VERSION}, ricevuta: ${payload.version})` }, 400);
    }

    const d = payload.data;
    if (!d) return c.json({ error: "Dati backup mancanti" }, 400);

    // Mappa vecchi ID → nuovi ID per risolvere le FK
    const clientMap = new Map<string, string>();
    const quoteMap = new Map<string, string>();
    const contractMap = new Map<string, string>();
    const projectMap = new Map<string, string>();
    const galleryMap = new Map<string, string>();
    const photoMap = new Map<string, string>();
    const videoMap = new Map<string, string>();
    const personaMap = new Map<string, string>();

    const stats = {
      clients: 0, quotes: 0, contracts: 0, projects: 0, tasks: 0,
      galleries: 0, photos: 0, photoComments: 0, videos: 0, videoComments: 0,
      appointments: 0, entrate: 0, uscite: 0, pareggi: 0,
      facePersone: 0, fotoPersone: 0,
    };

    // ── Clients ──
    if (Array.isArray(d.clients)) {
      for (const c_ of d.clients) {
        const newId = nanoid();
        clientMap.set(c_.id, newId);
        await db.insert(schema.clients).values({ ...c_, id: newId, tenantId }).onConflictDoNothing();
        stats.clients++;
      }
    }

    // ── Quotes ──
    if (Array.isArray(d.quotes)) {
      for (const q of d.quotes) {
        const newId = nanoid();
        quoteMap.set(q.id, newId);
        await db.insert(schema.quotes).values({
          ...q, id: newId, tenantId,
          clientId: clientMap.get(q.clientId) ?? q.clientId,
        }).onConflictDoNothing();
        stats.quotes++;
      }
    }

    // ── Contracts ──
    if (Array.isArray(d.contracts)) {
      for (const ct of d.contracts) {
        const newId = nanoid();
        contractMap.set(ct.id, newId);
        // Nuovo share token per evitare conflitti unique
        await db.insert(schema.contracts).values({
          ...ct, id: newId, tenantId,
          clientId: clientMap.get(ct.clientId) ?? ct.clientId,
          quoteId: ct.quoteId ? (quoteMap.get(ct.quoteId) ?? ct.quoteId) : null,
          shareToken: ct.shareToken ? nanoid(12) : null,
        }).onConflictDoNothing();
        stats.contracts++;
      }
    }

    // ── Projects ──
    if (Array.isArray(d.projects)) {
      for (const p of d.projects) {
        const newId = nanoid();
        projectMap.set(p.id, newId);
        await db.insert(schema.projects).values({
          ...p, id: newId, tenantId,
          clientId: p.clientId ? (clientMap.get(p.clientId) ?? p.clientId) : null,
          contractId: p.contractId ? (contractMap.get(p.contractId) ?? p.contractId) : null,
        }).onConflictDoNothing();
        stats.projects++;
      }
    }

    // ── Tasks ──
    if (Array.isArray(d.tasks)) {
      for (const t of d.tasks) {
        await db.insert(schema.tasks).values({
          ...t, id: nanoid(), tenantId,
          projectId: projectMap.get(t.projectId) ?? t.projectId,
        }).onConflictDoNothing();
        stats.tasks++;
      }
    }

    // ── Galleries ──
    if (Array.isArray(d.galleries)) {
      for (const g of d.galleries) {
        const newId = nanoid();
        galleryMap.set(g.id, newId);
        await db.insert(schema.galleries).values({
          ...g, id: newId, tenantId,
          projectId: g.projectId ? (projectMap.get(g.projectId) ?? g.projectId) : null,
          shareToken: g.shareToken ? nanoid(12) : null,
        }).onConflictDoNothing();
        stats.galleries++;
      }
    }

    // ── Photos (solo metadati — file R2 non inclusi nel backup) ──
    if (Array.isArray(d.photos)) {
      for (const ph of d.photos) {
        const newId = nanoid();
        photoMap.set(ph.id, newId);
        await db.insert(schema.photos).values({
          ...ph, id: newId,
          galleryId: galleryMap.get(ph.galleryId) ?? ph.galleryId,
        }).onConflictDoNothing();
        stats.photos++;
      }
    }

    // ── Photo comments ──
    if (Array.isArray(d.photoComments)) {
      for (const pc of d.photoComments) {
        await db.insert(schema.photoComments).values({
          ...pc, id: nanoid(),
          photoId: photoMap.get(pc.photoId) ?? pc.photoId,
          clientId: pc.clientId ? (clientMap.get(pc.clientId) ?? pc.clientId) : null,
        }).onConflictDoNothing();
        stats.photoComments++;
      }
    }

    // ── Videos ──
    if (Array.isArray(d.videos)) {
      for (const v of d.videos) {
        const newId = nanoid();
        videoMap.set(v.id, newId);
        await db.insert(schema.videos).values({
          ...v, id: newId, tenantId,
          projectId: v.projectId ? (projectMap.get(v.projectId) ?? v.projectId) : null,
          shareToken: v.shareToken ? nanoid(12) : null,
        }).onConflictDoNothing();
        stats.videos++;
      }
    }

    // ── Video comments ──
    if (Array.isArray(d.videoComments)) {
      for (const vc of d.videoComments) {
        await db.insert(schema.videoComments).values({
          ...vc, id: nanoid(),
          videoId: videoMap.get(vc.videoId) ?? vc.videoId,
          clientId: vc.clientId ? (clientMap.get(vc.clientId) ?? vc.clientId) : null,
        }).onConflictDoNothing();
        stats.videoComments++;
      }
    }

    // ── Appointments ──
    if (Array.isArray(d.appointments)) {
      for (const ap of d.appointments) {
        await db.insert(schema.appointments).values({
          ...ap, id: nanoid(), tenantId,
          bookingToken: nanoid(16),
          googleCalendarEventId: null,
        }).onConflictDoNothing();
        stats.appointments++;
      }
    }

    // ── Contabilità settings (upsert) ──
    if (d.contabilitaSettings) {
      const cs = d.contabilitaSettings;
      await db.insert(schema.contabilitaSettings).values({ ...cs, id: nanoid(), tenantId })
        .onConflictDoUpdate({ target: schema.contabilitaSettings.tenantId, set: { socioAName: cs.socioAName, socioBName: cs.socioBName, accAntonamentoRate: cs.accAntonamentoRate, forfettarioBase: cs.forfettarioBase } });
    }

    // ── Entrate ──
    if (Array.isArray(d.entrate)) {
      for (const e of d.entrate) {
        await db.insert(schema.entrate).values({ ...e, id: nanoid(), tenantId }).onConflictDoNothing();
        stats.entrate++;
      }
    }

    // ── Uscite ──
    if (Array.isArray(d.uscite)) {
      for (const u of d.uscite) {
        await db.insert(schema.uscite).values({ ...u, id: nanoid(), tenantId }).onConflictDoNothing();
        stats.uscite++;
      }
    }

    // ── Pareggi ──
    if (Array.isArray(d.pareggi)) {
      for (const pg of d.pareggi) {
        await db.insert(schema.pareggi).values({
          ...pg, id: nanoid(), tenantId,
          entrataId: pg.entrataId ? nanoid() : null, // entrataId non mappabile con certezza
        }).onConflictDoNothing();
        stats.pareggi++;
      }
    }

    // ── Face persone ──
    if (Array.isArray(d.facePersone)) {
      for (const fp of d.facePersone) {
        const newId = nanoid();
        personaMap.set(fp.id, newId);
        await db.insert(schema.facePersone).values({
          ...fp, id: newId, tenantId,
          coverPhotoId: null, // remap non possibile senza conoscere il nuovo photoId a priori
        }).onConflictDoNothing();
        stats.facePersone++;
      }
    }

    // ── Foto persone ──
    if (Array.isArray(d.fotoPersone)) {
      for (const fp of d.fotoPersone) {
        await db.insert(schema.fotoPersone).values({
          ...fp, id: nanoid(),
          photoId: photoMap.get(fp.photoId) ?? fp.photoId,
          personaId: personaMap.get(fp.personaId) ?? fp.personaId,
        }).onConflictDoNothing();
        stats.fotoPersone++;
      }
    }

    return c.json({ ok: true, stats });
  });
