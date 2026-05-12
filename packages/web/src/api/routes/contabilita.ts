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
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
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
  })

  .put("/settings", requireAuth, async (c) => {
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
          accAntonamentoRate: body.accAntonamentoRate ?? existing.accAntonamentoRate,
          forfettarioBase: body.forfettarioBase ?? existing.forfettarioBase,
          updatedAt: new Date(),
        })
        .where(eq(schema.contabilitaSettings.tenantId, tenantId));
      const updated = await db.select().from(schema.contabilitaSettings).where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
      return c.json(updated, 200);
    } else {
      const id = nanoid();
      await db.insert(schema.contabilitaSettings).values({
        id,
        tenantId,
        socioAName: body.socioAName ?? "Alessio Rollo",
        socioBName: body.socioBName ?? "Gianluca Distante",
        accAntonamentoRate: body.accAntonamentoRate ?? 20,
        forfettarioBase: body.forfettarioBase ?? 78,
      });
      const created = await db.select().from(schema.contabilitaSettings).where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
      return c.json(created, 201);
    }
  })

  // ─── ENTRATE ───────────────────────────────────────────────────────────────

  .get("/entrate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json([], 200);
    const { month, year } = c.req.query();
    const conditions: ReturnType<typeof eq>[] = [eq(schema.entrate.tenantId, tenantId)];
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      conditions.push(gte(schema.entrate.data, start) as any);
      conditions.push(lte(schema.entrate.data, end) as any);
    }
    const rows = await db
      .select()
      .from(schema.entrate)
      .where(and(...(conditions as any)))
      .orderBy(desc(schema.entrate.data));
    return c.json(rows, 200);
  })

  .post("/entrate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const id = nanoid();
    await db.insert(schema.entrate).values({
      id,
      tenantId,
      descrizione: body.descrizione,
      importo: body.importo,
      beneficiario: body.beneficiario,
      fattura: body.fattura ?? false,
      categoria: body.categoria ?? "Altro",
      note: body.note ?? null,
      data: body.data ? new Date(body.data) : new Date(),
    });
    const row = await db.select().from(schema.entrate).where(eq(schema.entrate.id, id)).get();
    return c.json(row, 201);
  })

  .patch("/entrate/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const { id } = c.req.param();
    const body = await c.req.json();
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione;
    if (body.importo !== undefined) updateData.importo = body.importo;
    if (body.beneficiario !== undefined) updateData.beneficiario = body.beneficiario;
    if (body.fattura !== undefined) updateData.fattura = body.fattura;
    if (body.categoria !== undefined) updateData.categoria = body.categoria;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.data !== undefined) updateData.data = new Date(body.data);
    await db
      .update(schema.entrate)
      .set(updateData)
      .where(and(eq(schema.entrate.id, id), eq(schema.entrate.tenantId, tenantId)));
    const row = await db.select().from(schema.entrate).where(eq(schema.entrate.id, id)).get();
    return c.json(row, 200);
  })

  .delete("/entrate/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const { id } = c.req.param();
    await db
      .delete(schema.entrate)
      .where(and(eq(schema.entrate.id, id), eq(schema.entrate.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  })

  // ─── USCITE ────────────────────────────────────────────────────────────────

  .get("/uscite", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json([], 200);
    const { month, year } = c.req.query();
    const conditions: ReturnType<typeof eq>[] = [eq(schema.uscite.tenantId, tenantId)];
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      conditions.push(gte(schema.uscite.data, start) as any);
      conditions.push(lte(schema.uscite.data, end) as any);
    }
    const rows = await db
      .select()
      .from(schema.uscite)
      .where(and(...(conditions as any)))
      .orderBy(desc(schema.uscite.data));
    return c.json(rows, 200);
  })

  .post("/uscite", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const body = await c.req.json();
    const id = nanoid();
    await db.insert(schema.uscite).values({
      id,
      tenantId,
      descrizione: body.descrizione,
      importo: body.importo,
      categoria: body.categoria ?? "Altro",
      divisiPerMeta: body.divisiPerMeta ?? false,
      pagatoDa: body.pagatoDa,
      note: body.note ?? null,
      data: body.data ? new Date(body.data) : new Date(),
    });
    const row = await db.select().from(schema.uscite).where(eq(schema.uscite.id, id)).get();
    return c.json(row, 201);
  })

  .patch("/uscite/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const { id } = c.req.param();
    const body = await c.req.json();
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione;
    if (body.importo !== undefined) updateData.importo = body.importo;
    if (body.categoria !== undefined) updateData.categoria = body.categoria;
    if (body.divisiPerMeta !== undefined) updateData.divisiPerMeta = body.divisiPerMeta;
    if (body.pagatoDa !== undefined) updateData.pagatoDa = body.pagatoDa;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.data !== undefined) updateData.data = new Date(body.data);
    await db
      .update(schema.uscite)
      .set(updateData)
      .where(and(eq(schema.uscite.id, id), eq(schema.uscite.tenantId, tenantId)));
    const row = await db.select().from(schema.uscite).where(eq(schema.uscite.id, id)).get();
    return c.json(row, 200);
  })

  .delete("/uscite/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const { id } = c.req.param();
    await db
      .delete(schema.uscite)
      .where(and(eq(schema.uscite.id, id), eq(schema.uscite.tenantId, tenantId)));
    return c.json({ ok: true }, 200);
  })

  // ─── RIEPILOGO ─────────────────────────────────────────────────────────────

  .get("/riepilogo", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ error: "Nessun tenant" }, 400);
    const { month, year } = c.req.query();

    const settings = await db
      .select()
      .from(schema.contabilitaSettings)
      .where(eq(schema.contabilitaSettings.tenantId, tenantId))
      .get();
    const accRate = (settings?.accAntonamentoRate ?? 20) / 100;
    const forfBase = (settings?.forfettarioBase ?? 78) / 100;

    const entConditions: any[] = [eq(schema.entrate.tenantId, tenantId)];
    const uscConditions: any[] = [eq(schema.uscite.tenantId, tenantId)];
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      entConditions.push(gte(schema.entrate.data, start));
      entConditions.push(lte(schema.entrate.data, end));
      uscConditions.push(gte(schema.uscite.data, start));
      uscConditions.push(lte(schema.uscite.data, end));
    }

    const entRows = await db.select().from(schema.entrate).where(and(...entConditions));
    const uscRows = await db.select().from(schema.uscite).where(and(...uscConditions));

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
    let usciteCondivise = 0;
    let totaleUscite = 0;
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
    const saldoA = pagatoASuCondivise - quotaCondivisa; // >0 = B deve ad A
    let compensazione: {
      debitore: string; creditore: string; importo: number; descrizione: string;
    } = { debitore: "in_pari", creditore: "in_pari", importo: 0, descrizione: "I soci sono in pari." };

    if (Math.abs(saldoA) > 0.01) {
      if (saldoA > 0) {
        compensazione = {
          debitore: "socio_b", creditore: "socio_a",
          importo: Math.abs(saldoA),
          descrizione: `Gianluca deve ad Alessio €${Math.abs(saldoA).toFixed(2)} per spese condivise anticipate`
        };
      } else {
        compensazione = {
          debitore: "socio_a", creditore: "socio_b",
          importo: Math.abs(saldoA),
          descrizione: `Alessio deve a Gianluca €${Math.abs(saldoA).toFixed(2)} per spese condivise anticipate`
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
  })

  // ─── TREND (6 mesi) ────────────────────────────────────────────────────────

  .get("/trend", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json([], 200);
    const now = new Date();
    const settings = await db.select().from(schema.contabilitaSettings).where(eq(schema.contabilitaSettings.tenantId, tenantId)).get();
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
  });
