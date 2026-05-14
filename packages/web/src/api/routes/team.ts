import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { nanoid } from "../lib/id";
import { sendEmail } from "../lib/email";
import { validateBody, InviteSchema } from "../lib/validate";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

async function sendInviteEmail(email: string, inviterName: string, tenantName: string, token: string) {
  const link = `${process.env.APP_URL ?? "http://localhost:4200"}/accept-invite?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0a0a;color:#f5f5f5;border-radius:12px">
      <h2 style="color:#F5A623;margin-bottom:8px">Sei stato invitato!</h2>
      <p style="color:#a0a0a0">${inviterName} ti ha invitato a far parte del team <strong style="color:#f5f5f5">${tenantName}</strong> su Frame.</p>
      <a href="${link}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#F5A623;color:#000;font-weight:700;border-radius:8px;text-decoration:none">Iscriviti al portale Frame</a>
      <p style="margin-top:16px;font-size:12px;color:#777">Oppure copia questo link nel browser:<br/><span style="color:#a0a0a0">${link}</span></p>
      <p style="margin-top:16px;font-size:12px;color:#555">Il link scade tra 7 giorni.</p>
    </div>`;
  try {
    await sendEmail({ to: email, subject: "Iscriviti al portale Frame", html });
  } catch (e) {
    console.error("sendInviteEmail failed", e);
  }
}

export const team = new Hono()
  // GET /api/team — lista membri + inviti pendenti
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ members: [], invites: [] }, 200);

    // Tutti gli userProfiles con questo tenantId
    const profiles = await db.select().from(schema.userProfiles)
      .where(eq(schema.userProfiles.tenantId, tenantId));

    // Leggi i dati utente per ciascun profilo
    const members = await Promise.all(
      profiles.map(async (p) => {
        const u = await db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, image: schema.user.image })
          .from(schema.user).where(eq(schema.user.id, p.userId)).get();
        return u ? {
          ...u,
          role: p.role,
          permissions: p.permissions ? JSON.parse(p.permissions) : null,
        } : null;
      })
    );

    const invites = await db.select().from(schema.teamInvites)
      .where(and(eq(schema.teamInvites.tenantId, tenantId), eq(schema.teamInvites.status, "pending")));

    return c.json({ members: members.filter(Boolean), invites }, 200);
  })

  // POST /api/team/invite — invia invito
  .post("/invite", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);

    const body = await validateBody(c, InviteSchema);
    if (!body) return c.res;
    const { email, role = "staff" } = body;

    // Controlla se già membro
    const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).get();
    if (existing) {
      const alreadyMember = await db.select().from(schema.userProfiles)
        .where(and(eq(schema.userProfiles.userId, existing.id), eq(schema.userProfiles.tenantId, tenantId))).get();
      if (alreadyMember) return c.json({ error: "Utente già nel team" }, 400);
    }

    // Cancella inviti precedenti per la stessa email
    await db.delete(schema.teamInvites)
      .where(and(eq(schema.teamInvites.tenantId, tenantId), eq(schema.teamInvites.email, email)));

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { permissions } = body; // optional: array of section keys or null

    const [invite] = await db.insert(schema.teamInvites).values({
      id: nanoid(),
      tenantId,
      email,
      role,
      permissions: permissions ? JSON.stringify(permissions) : null,
      token,
      invitedBy: user.id,
      status: "pending",
      expiresAt,
    }).returning();

    // Carica tenant name
    const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get();
    const inviterUser = await db.select().from(schema.user).where(eq(schema.user.id, user.id)).get();

    // Invia email in background (non bloccare la risposta)
    sendInviteEmail(
      email,
      inviterUser?.name ?? "Il tuo collega",
      tenant?.name ?? "FRAME",
      token
    ).catch((e) => console.error("sendInviteEmail background error", e));

    return c.json({ invite }, 201);
  })

  // DELETE /api/team/invite/:id — revoca invito
  .delete("/invite/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    await db.delete(schema.teamInvites)
      .where(and(eq(schema.teamInvites.id, c.req.param("id")), eq(schema.teamInvites.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  })

  // DELETE /api/team/member/:userId — rimuovi membro
  .delete("/member/:userId", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);
    const targetId = c.req.param("userId");
    if (targetId === user.id) return c.json({ error: "Non puoi rimuovere te stesso" }, 400);
    await db.delete(schema.userProfiles)
      .where(and(eq(schema.userProfiles.userId, targetId), eq(schema.userProfiles.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  })

  // PATCH /api/team/member/:userId/permissions — aggiorna permessi membro
  .patch("/member/:userId/permissions", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Non trovato" }, 404);

    // Solo owner può modificare i permessi
    const myProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id)).get();
    if (myProfile?.role !== "owner") return c.json({ error: "Solo gli owner possono modificare i permessi" }, 403);

    const targetId = c.req.param("userId");
    const { permissions, role } = await c.req.json() as { permissions: string[] | null; role?: string };

    const updateData: any = {
      permissions: permissions === null ? null : JSON.stringify(permissions),
      updatedAt: new Date(),
    };
    if (role) updateData.role = role;

    await db.update(schema.userProfiles).set(updateData)
      .where(and(eq(schema.userProfiles.userId, targetId), eq(schema.userProfiles.tenantId, tenantId)));

    return c.json({ ok: true });
  })

  // GET /api/team/my-permissions — permessi dell'utente corrente
  .get("/my-permissions", requireAuth, async (c) => {
    const user = c.get("user")!;
    const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id)).get();
    if (!profile) return c.json({ role: null, permissions: null });
    return c.json({
      role: profile.role,
      permissions: profile.permissions ? JSON.parse(profile.permissions) : null,
    });
  })

  // POST /api/team/accept — accetta invito (usato dal frontend dopo registrazione)
  .post("/accept", async (c) => {
    const { token } = await c.req.json();
    if (!token) return c.json({ error: "Token mancante" }, 400);

    const invite = await db.select().from(schema.teamInvites)
      .where(and(eq(schema.teamInvites.token, token), eq(schema.teamInvites.status, "pending"))).get();

    if (!invite) return c.json({ error: "Invito non valido o scaduto" }, 404);
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await db.update(schema.teamInvites).set({ status: "expired" }).where(eq(schema.teamInvites.id, invite.id));
      return c.json({ error: "Invito scaduto" }, 410);
    }

    // Trova l'utente con questa email
    const u = await db.select().from(schema.user).where(eq(schema.user.email, invite.email)).get();
    if (!u) return c.json({ needsRegister: true, email: invite.email, token }, 200);

    // Collega al tenant con permessi
    const existing = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, u.id)).get();
    if (existing) {
      await db.update(schema.userProfiles).set({
        tenantId: invite.tenantId,
        role: invite.role,
        permissions: invite.permissions ?? null,
      }).where(eq(schema.userProfiles.userId, u.id));
    } else {
      await db.insert(schema.userProfiles).values({
        userId: u.id,
        tenantId: invite.tenantId,
        role: invite.role,
        permissions: invite.permissions ?? null,
      });
    }

    await db.update(schema.teamInvites).set({ status: "accepted" }).where(eq(schema.teamInvites.id, invite.id));
    return c.json({ ok: true, tenantId: invite.tenantId }, 200);
  });
