import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { nanoid } from "../lib/id";
import { requireAuth } from "../middleware/auth";
import { validateBody, EntrataSchema, EntrataUpdateSchema } from "../lib/validate";

/**
 * Ritorna il tenantId dell'utente.
 * Se l'utente non ha ancora un profilo/tenant, ne crea uno automaticamente.
 * Accetta opzionalmente nome/email per lo slug (evita query extra).
 */
async function getTenantId(userId: string, userMeta?: { name?: string; email?: string }): Promise<string> {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  if (p?.tenantId) return p.tenantId;

  // Auto-provisioning
  const baseName = userMeta?.name ?? userMeta?.email?.split("@")[0] ?? "utente";
  const slug = baseName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + nanoid(6);
  const tenantId = nanoid();

  await db.insert(schema.tenants).values({
    id: tenantId,
    ownerId: userId,
    name: baseName,
    slug,
    primaryColor: "#F5A623",
  });

  await db.insert(schema.userProfiles).values({
    userId,
    tenantId,
    role: "owner",
  });

  console.log(`[contabilita] Auto-provisioned tenant ${tenantId} for user ${userId} (${baseName})`);
  return tenantId;
}

export const contabilita = new Hono()

  // ─── SETTINGS ──────────────────────────────────────────────────────────────

  .get("/settings", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const settings = await db
        .select()
        .from(schema.contabilitaSettings)
        .where(eq(schema.contabilitaSettings.tenantId, tenantId))
        .get();
      if (!settings) {
        return c.json({
          tenantId,
          socioAName: "Alessio Rollo",
          socioBName: "Gianluca Distante",
          accAntonamentoRate: 20,
          forfettarioBase: 78,
        }, 200);
      }
      return c.json(settings, 200);
    } catch (e) {
      console.error("[contabilita/settings GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .put("/settings", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const body = await c.req.json();
      const existing = await db
        .select()
        .from(schema.contabilitaSettings)
        .where(eq(schema.contabilitaSettings.tenantId, tenantId))
        .get();
      if (existing) {
        await db
          .update(schema.contabilitaSettings)
          .set({
            socioAName: body.socioAName ?? existing.socioAName,
            socioBName: body.socioBName ?? existing.socioBName,
            accAntonamentoRate: Number(body.accAntonamentoRate ?? existing.accAntonamentoRate),
            forfettarioBase: Number(body.forfettarioBase ?? existing.forfettarioBase),
            updatedAt: new Date(),
          })
          .where(eq(schema.contabilitaSettings.tenantId, tenantId));
      } else {
        await db.insert(schema.contabilitaSettings).values({
          id: nanoid(),
          tenantId,
          socioAName: body.socioAName ?? "Alessio Rollo",
          socioBName: body.socioBName ?? "Gianluca Distante",
          accAntonamentoRate: Number(body.accAntonamentoRate ?? 20),
          forfettarioBase: Number(body.forfettarioBase ?? 78),
        });
      }
      const updated = await db.select().from(schema.contabilitaSettings).where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
      return c.json(updated, 200);
    } catch (e) {
      console.error("[contabilita/settings PUT]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  // ─── ENTRATE ───────────────────────────────────────────────────────────────

  .get("/entrate", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { month, year } = c.req.query();
      let whereClause;
      if (month && year) {
        const start = new Date(Number(year), Number(month) - 1, 1);
        const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
        whereClause = and(
          eq(schema.entrate.tenantId, tenantId),
          gte(schema.entrate.data, start),
          lte(schema.entrate.data, end)
        );
      } else {
        whereClause = eq(schema.entrate.tenantId, tenantId);
      }
      const rows = await db
        .select({
          id: schema.entrate.id,
          tenantId: schema.entrate.tenantId,
          descrizione: schema.entrate.descrizione,
          importo: schema.entrate.importo,
          acconto: schema.entrate.acconto,
          saldoRicevuto: schema.entrate.saldoRicevuto,
          clientId: schema.entrate.clientId,
          clientName: schema.clients.name,
          beneficiario: schema.entrate.beneficiario,
          fattura: schema.entrate.fattura,
          categoria: schema.entrate.categoria,
          note: schema.entrate.note,
          data: schema.entrate.data,
          createdAt: schema.entrate.createdAt,
          updatedAt: schema.entrate.updatedAt,
        })
        .from(schema.entrate)
        .leftJoin(schema.clients, eq(schema.entrate.clientId, schema.clients.id))
        .where(whereClause)
        .orderBy(desc(schema.entrate.data));
      return c.json(rows, 200);
    } catch (e) {
      console.error("[contabilita/entrate GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .post("/entrate", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const body = await validateBody(c, EntrataSchema);
      if (!body) return c.res;
      const id = nanoid();
      const dataVal = body.data ? new Date(body.data) : new Date();
      await db.insert(schema.entrate).values({
        id,
        tenantId,
        descrizione: String(body.descrizione),
        importo: Number(body.importo),
        acconto: body.acconto != null ? Number(body.acconto) : 0,
        saldoRicevuto: body.saldoRicevuto != null ? Number(body.saldoRicevuto) : 0,
        clientId: body.clientId || null,
        beneficiario: body.beneficiario ?? "split",
        fattura: body.fattura === true || body.fattura === 1,
        categoria: body.categoria ?? "Altro",
        note: body.note || null,
        data: dataVal,
      });
      const row = await db
        .select({
          id: schema.entrate.id,
          tenantId: schema.entrate.tenantId,
          descrizione: schema.entrate.descrizione,
          importo: schema.entrate.importo,
          acconto: schema.entrate.acconto,
          saldoRicevuto: schema.entrate.saldoRicevuto,
          clientId: schema.entrate.clientId,
          clientName: schema.clients.name,
          beneficiario: schema.entrate.beneficiario,
          fattura: schema.entrate.fattura,
          categoria: schema.entrate.categoria,
          note: schema.entrate.note,
          data: schema.entrate.data,
          createdAt: schema.entrate.createdAt,
          updatedAt: schema.entrate.updatedAt,
        })
        .from(schema.entrate)
        .leftJoin(schema.clients, eq(schema.entrate.clientId, schema.clients.id))
        .where(eq(schema.entrate.id, id))
        .get();
      return c.json(row, 201);
    } catch (e) {
      console.error("[contabilita/entrate POST]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .patch("/entrate/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { id } = c.req.param();
      const body = await validateBody(c, EntrataUpdateSchema);
      if (!body) return c.res;
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (body.descrizione !== undefined) updateData.descrizione = String(body.descrizione);
      if (body.importo !== undefined) updateData.importo = Number(body.importo);
      if (body.acconto !== undefined) updateData.acconto = body.acconto != null ? Number(body.acconto) : 0;
      if (body.saldoRicevuto !== undefined) updateData.saldoRicevuto = body.saldoRicevuto != null ? Number(body.saldoRicevuto) : 0;
      if (body.clientId !== undefined) updateData.clientId = body.clientId || null;
      if (body.beneficiario !== undefined) updateData.beneficiario = body.beneficiario;
      if (body.fattura !== undefined) updateData.fattura = body.fattura === true || body.fattura === 1;
      if (body.categoria !== undefined) updateData.categoria = body.categoria;
      if (body.note !== undefined) updateData.note = body.note || null;
      if (body.data !== undefined) updateData.data = new Date(body.data);
      await db.update(schema.entrate).set(updateData)
        .where(and(eq(schema.entrate.id, id), eq(schema.entrate.tenantId, tenantId)));
      const row = await db
        .select({
          id: schema.entrate.id,
          tenantId: schema.entrate.tenantId,
          descrizione: schema.entrate.descrizione,
          importo: schema.entrate.importo,
          acconto: schema.entrate.acconto,
          saldoRicevuto: schema.entrate.saldoRicevuto,
          clientId: schema.entrate.clientId,
          clientName: schema.clients.name,
          beneficiario: schema.entrate.beneficiario,
          fattura: schema.entrate.fattura,
          categoria: schema.entrate.categoria,
          note: schema.entrate.note,
          data: schema.entrate.data,
          createdAt: schema.entrate.createdAt,
          updatedAt: schema.entrate.updatedAt,
        })
        .from(schema.entrate)
        .leftJoin(schema.clients, eq(schema.entrate.clientId, schema.clients.id))
        .where(eq(schema.entrate.id, id))
        .get();
      return c.json(row, 200);
    } catch (e) {
      console.error("[contabilita/entrate PATCH]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .delete("/entrate/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { id } = c.req.param();
      await db.delete(schema.entrate)
        .where(and(eq(schema.entrate.id, id), eq(schema.entrate.tenantId, tenantId)));
      return c.json({ ok: true }, 200);
    } catch (e) {
      console.error("[contabilita/entrate DELETE]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  // ─── USCITE ────────────────────────────────────────────────────────────────

  .get("/uscite", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { month, year } = c.req.query();
      let whereClause;
      if (month && year) {
        const start = new Date(Number(year), Number(month) - 1, 1);
        const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
        whereClause = and(
          eq(schema.uscite.tenantId, tenantId),
          gte(schema.uscite.data, start),
          lte(schema.uscite.data, end)
        );
      } else {
        whereClause = eq(schema.uscite.tenantId, tenantId);
      }
      const rows = await db.select().from(schema.uscite).where(whereClause).orderBy(desc(schema.uscite.data));
      return c.json(rows, 200);
    } catch (e) {
      console.error("[contabilita/uscite GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .post("/uscite", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const body = await c.req.json();
      const id = nanoid();
      const dataVal = body.data ? new Date(body.data) : new Date();
      await db.insert(schema.uscite).values({
        id,
        tenantId,
        descrizione: String(body.descrizione),
        importo: Number(body.importo),
        categoria: body.categoria ?? "Altro",
        divisiPerMeta: body.divisiPerMeta === true || body.divisiPerMeta === 1,
        pagatoDa: body.pagatoDa ?? "studio",
        note: body.note || null,
        data: dataVal,
      });
      const row = await db.select().from(schema.uscite).where(eq(schema.uscite.id, id)).get();
      return c.json(row, 201);
    } catch (e) {
      console.error("[contabilita/uscite POST]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .patch("/uscite/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { id } = c.req.param();
      const body = await c.req.json();
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (body.descrizione !== undefined) updateData.descrizione = String(body.descrizione);
      if (body.importo !== undefined) updateData.importo = Number(body.importo);
      if (body.categoria !== undefined) updateData.categoria = body.categoria;
      if (body.divisiPerMeta !== undefined) updateData.divisiPerMeta = body.divisiPerMeta === true || body.divisiPerMeta === 1;
      if (body.pagatoDa !== undefined) updateData.pagatoDa = body.pagatoDa;
      if (body.note !== undefined) updateData.note = body.note || null;
      if (body.data !== undefined) updateData.data = new Date(body.data);
      await db.update(schema.uscite).set(updateData)
        .where(and(eq(schema.uscite.id, id), eq(schema.uscite.tenantId, tenantId)));
      const row = await db.select().from(schema.uscite).where(eq(schema.uscite.id, id)).get();
      return c.json(row, 200);
    } catch (e) {
      console.error("[contabilita/uscite PATCH]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .delete("/uscite/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { id } = c.req.param();
      await db.delete(schema.uscite)
        .where(and(eq(schema.uscite.id, id), eq(schema.uscite.tenantId, tenantId)));
      return c.json({ ok: true }, 200);
    } catch (e) {
      console.error("[contabilita/uscite DELETE]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  // ─── RIEPILOGO ─────────────────────────────────────────────────────────────

  .get("/riepilogo", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { month, year } = c.req.query();

      const settings = await db
        .select().from(schema.contabilitaSettings)
        .where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
      const accRate = (settings?.accAntonamentoRate ?? 20) / 100;
      const forfBase = (settings?.forfettarioBase ?? 78) / 100;

      let entWhereClause;
      let uscWhereClause;
      if (month && year) {
        const start = new Date(Number(year), Number(month) - 1, 1);
        const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
        entWhereClause = and(eq(schema.entrate.tenantId, tenantId), gte(schema.entrate.data, start), lte(schema.entrate.data, end));
        uscWhereClause = and(eq(schema.uscite.tenantId, tenantId), gte(schema.uscite.data, start), lte(schema.uscite.data, end));
      } else {
        entWhereClause = eq(schema.entrate.tenantId, tenantId);
        uscWhereClause = eq(schema.uscite.tenantId, tenantId);
      }

      const entRows = await db.select().from(schema.entrate).where(entWhereClause);
      const uscRows = await db.select().from(schema.uscite).where(uscWhereClause);

      const calcNetto = (importo: number, fattura: boolean) =>
        fattura ? importo - importo * forfBase * accRate : importo;
      const calcAcc = (importo: number, fattura: boolean) =>
        fattura ? importo * forfBase * accRate : 0;

      let entrateSocioA = 0, entrateSocioB = 0, entrateStudio = 0;
      let nettoSocioA = 0, nettoSocioB = 0;
      let accantonamentoA = 0, accantonamentoB = 0;
      let totaleEntrate = 0, totaleAccantonamento = 0;

      for (const e of entRows) {
        const netto = calcNetto(e.importo, e.fattura);
        const acc = calcAcc(e.importo, e.fattura);
        totaleEntrate += e.importo;
        totaleAccantonamento += acc;
        if (e.beneficiario === "socio_a") {
          entrateSocioA += e.importo; nettoSocioA += netto; accantonamentoA += acc;
        } else if (e.beneficiario === "socio_b") {
          entrateSocioB += e.importo; nettoSocioB += netto; accantonamentoB += acc;
        } else {
          entrateStudio += e.importo;
          nettoSocioA += netto / 2; nettoSocioB += netto / 2;
          accantonamentoA += acc / 2; accantonamentoB += acc / 2;
        }
      }

      let usciteSocioA = 0, usciteSocioB = 0, usciteStudio = 0;
      let usciteCondivise = 0, totaleUscite = 0;
      let pagatoASuCondivise = 0, pagatoBSuCondivise = 0;

      for (const u of uscRows) {
        totaleUscite += u.importo;
        if (u.divisiPerMeta) {
          usciteCondivise += u.importo;
          usciteSocioA += u.importo / 2;
          usciteSocioB += u.importo / 2;
          if (u.pagatoDa === "socio_a") pagatoASuCondivise += u.importo;
          else if (u.pagatoDa === "socio_b") pagatoBSuCondivise += u.importo;
        } else {
          if (u.pagatoDa === "socio_a") usciteSocioA += u.importo;
          else if (u.pagatoDa === "socio_b") usciteSocioB += u.importo;
          else usciteStudio += u.importo;
        }
      }

      const quotaCondivisa = usciteCondivise / 2;
      const saldoA = pagatoASuCondivise - quotaCondivisa;

      // Carica tutti i pareggi cumulativi (non filtrati per mese)
      const pareggiRows = await db.select().from(schema.pareggi)
        .where(eq(schema.pareggi.tenantId, tenantId));

      // Calcola quanto è già stato saldato: positivo = A ha ricevuto, negativo = B ha ricevuto
      let pareggatoAFavore = 0; // importo già saldato a favore di A
      for (const p of pareggiRows) {
        if (p.creditore === "socio_a") pareggatoAFavore += p.importo;
        else if (p.creditore === "socio_b") pareggatoAFavore -= p.importo;
      }

      // Sbilancio residuo dopo pareggi
      const saldoAResiduo = saldoA - pareggatoAFavore;

      const socioAName = settings?.socioAName ?? "Alessio";
      const socioBName = settings?.socioBName ?? "Gianluca";

      let compensazione: { debitore: string; creditore: string; importo: number; importoLordo: number; pareggiato: number; descrizione: string } =
        { debitore: "in_pari", creditore: "in_pari", importo: 0, importoLordo: Math.abs(saldoA), pareggiato: Math.abs(pareggatoAFavore), descrizione: "I soci sono in pari." };

      if (Math.abs(saldoAResiduo) > 0.01) {
        if (saldoAResiduo > 0) {
          compensazione = {
            debitore: "socio_b", creditore: "socio_a",
            importo: Math.abs(saldoAResiduo),
            importoLordo: Math.abs(saldoA),
            pareggiato: Math.abs(pareggatoAFavore),
            descrizione: `${socioBName} deve ancora a ${socioAName} €${Math.abs(saldoAResiduo).toFixed(2)}`
          };
        } else {
          compensazione = {
            debitore: "socio_a", creditore: "socio_b",
            importo: Math.abs(saldoAResiduo),
            importoLordo: Math.abs(saldoA),
            pareggiato: Math.abs(pareggatoAFavore),
            descrizione: `${socioAName} deve ancora a ${socioBName} €${Math.abs(saldoAResiduo).toFixed(2)}`
          };
        }
      }

      return c.json({
        entrate: { totale: totaleEntrate, socioA: entrateSocioA, socioB: entrateSocioB, studio: entrateStudio },
        uscite: { totale: totaleUscite, socioA: usciteSocioA, socioB: usciteSocioB, studio: usciteStudio, condivise: usciteCondivise },
        netto: { socioA: nettoSocioA, socioB: nettoSocioB, studio: nettoSocioA + nettoSocioB },
        accantonamento: { totale: totaleAccantonamento, socioA: accantonamentoA, socioB: accantonamentoB },
        saldo: { socioA: nettoSocioA - usciteSocioA, socioB: nettoSocioB - usciteSocioB },
        compensazione,
      }, 200);
    } catch (e) {
      console.error("[contabilita/riepilogo GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  // ─── TREND (6 mesi) ────────────────────────────────────────────────────────

  .get("/trend", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const now = new Date();
      const settings = await db.select().from(schema.contabilitaSettings)
        .where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
      const accRate = (settings?.accAntonamentoRate ?? 20) / 100;
      const forfBase = (settings?.forfettarioBase ?? 78) / 100;

      const trend = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          return { label: d.toLocaleString("it-IT", { month: "short" }), year: d.getFullYear(), month: d.getMonth() + 1 };
        }).map(async ({ label, year, month }) => {
          const start = new Date(year, month - 1, 1);
          const end = new Date(year, month, 0, 23, 59, 59);
          const ents = await db.select().from(schema.entrate).where(
            and(eq(schema.entrate.tenantId, tenantId), gte(schema.entrate.data, start), lte(schema.entrate.data, end))
          );
          const uscs = await db.select().from(schema.uscite).where(
            and(eq(schema.uscite.tenantId, tenantId), gte(schema.uscite.data, start), lte(schema.uscite.data, end))
          );
          const totEnt = ents.reduce((s, e) => s + e.importo, 0);
          const totUsc = uscs.reduce((s, u) => s + u.importo, 0);
          const totAcc = ents.filter(e => e.fattura).reduce((s, e) => s + e.importo * forfBase * accRate, 0);
          return { label, entrate: totEnt, uscite: totUsc, accantonamento: totAcc, netto: totEnt - totUsc };
        })
      );
      return c.json(trend, 200);
    } catch (e) {
      console.error("[contabilita/trend GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  // ─── PAREGGI ───────────────────────────────────────────────────────────────

  .get("/pareggi", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const rows = await db
        .select()
        .from(schema.pareggi)
        .where(eq(schema.pareggi.tenantId, tenantId))
        .orderBy(desc(schema.pareggi.data));
      return c.json(rows, 200);
    } catch (e) {
      console.error("[contabilita/pareggi GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .post("/pareggi", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const body = await c.req.json();
      if (!body.tipo || !body.importo || !body.debitore || !body.creditore) {
        return c.json({ error: "Campi obbligatori mancanti" }, 400);
      }
      const id = nanoid();
      await db.insert(schema.pareggi).values({
        id,
        tenantId,
        tipo: body.tipo,
        importo: Number(body.importo),
        debitore: body.debitore,
        creditore: body.creditore,
        entrataId: body.entrataId ?? null,
        note: body.note ?? null,
        data: body.data ? new Date(body.data) : new Date(),
      });
      const row = await db.select().from(schema.pareggi).where(eq(schema.pareggi.id, id)).get();
      return c.json(row, 201);
    } catch (e) {
      console.error("[contabilita/pareggi POST]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .delete("/pareggi/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id, { name: user.name, email: user.email });
      const { id } = c.req.param();
      await db.delete(schema.pareggi)
        .where(and(eq(schema.pareggi.id, id), eq(schema.pareggi.tenantId, tenantId)));
      return c.json({ ok: true }, 200);
    } catch (e) {
      console.error("[contabilita/pareggi DELETE]", e);
      return c.json({ error: String(e) }, 500);
    }
  });
