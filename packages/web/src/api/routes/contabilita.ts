import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { nanoid } from "../lib/id";
import { requireAuth } from "../middleware/auth";

async function getTenantId(userId: string) {
  const p = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).get();
  return p?.tenantId ?? null;
}

export const contabilita = new Hono()

  // ─── SETTINGS ──────────────────────────────────────────────────────────────

  .get("/settings", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id);
      if (!tenantId) {
        return c.json({
          socioAName: "Alessio Rollo",
          socioBName: "Gianluca Distante",
          accAntonamentoRate: 20,
          forfettarioBase: 78,
        }, 200);
      }
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json([], 200);
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
      const rows = await db.select().from(schema.entrate).where(whereClause).orderBy(desc(schema.entrate.data));
      return c.json(rows, 200);
    } catch (e) {
      console.error("[contabilita/entrate GET]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .post("/entrate", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
      const body = await c.req.json();
      const id = nanoid();
      const dataVal = body.data ? new Date(body.data) : new Date();
      await db.insert(schema.entrate).values({
        id,
        tenantId,
        descrizione: String(body.descrizione),
        importo: Number(body.importo),
        beneficiario: body.beneficiario ?? "split",
        fattura: body.fattura === true || body.fattura === 1,
        categoria: body.categoria ?? "Altro",
        note: body.note || null,
        data: dataVal,
      });
      const row = await db.select().from(schema.entrate).where(eq(schema.entrate.id, id)).get();
      return c.json(row, 201);
    } catch (e) {
      console.error("[contabilita/entrate POST]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .patch("/entrate/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
      const { id } = c.req.param();
      const body = await c.req.json();
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (body.descrizione !== undefined) updateData.descrizione = String(body.descrizione);
      if (body.importo !== undefined) updateData.importo = Number(body.importo);
      if (body.beneficiario !== undefined) updateData.beneficiario = body.beneficiario;
      if (body.fattura !== undefined) updateData.fattura = body.fattura === true || body.fattura === 1;
      if (body.categoria !== undefined) updateData.categoria = body.categoria;
      if (body.note !== undefined) updateData.note = body.note || null;
      if (body.data !== undefined) updateData.data = new Date(body.data);
      await db.update(schema.entrate).set(updateData)
        .where(and(eq(schema.entrate.id, id), eq(schema.entrate.tenantId, tenantId)));
      const row = await db.select().from(schema.entrate).where(eq(schema.entrate.id, id)).get();
      return c.json(row, 200);
    } catch (e) {
      console.error("[contabilita/entrate PATCH]", e);
      return c.json({ error: String(e) }, 500);
    }
  })

  .delete("/entrate/:id", requireAuth, async (c) => {
    try {
      const user = c.get("user")!;
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json([], 200);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
      let compensazione: { debitore: string; creditore: string; importo: number; descrizione: string } =
        { debitore: "in_pari", creditore: "in_pari", importo: 0, descrizione: "I soci sono in pari." };

      if (Math.abs(saldoA) > 0.01) {
        const socioAName = settings?.socioAName ?? "Alessio";
        const socioBName = settings?.socioBName ?? "Gianluca";
        if (saldoA > 0) {
          compensazione = {
            debitore: "socio_b", creditore: "socio_a",
            importo: Math.abs(saldoA),
            descrizione: `${socioBName} deve a ${socioAName} €${Math.abs(saldoA).toFixed(2)} per spese condivise anticipate`
          };
        } else {
          compensazione = {
            debitore: "socio_a", creditore: "socio_b",
            importo: Math.abs(saldoA),
            descrizione: `${socioAName} deve a ${socioBName} €${Math.abs(saldoA).toFixed(2)} per spese condivise anticipate`
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
      const tenantId = await getTenantId(user.id);
      if (!tenantId) return c.json([], 200);
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
  });
