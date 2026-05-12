import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Scale, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Check, FileText, Receipt, Settings, BarChart2,
  ArrowDownLeft, ArrowUpRight, AlertCircle, Download
} from "lucide-react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContabilitaSettings {
  tenantId?: string;
  socioAName: string;
  socioBName: string;
  accAntonamentoRate: number;
  forfettarioBase: number;
}

interface Entrata {
  id: string;
  descrizione: string;
  importo: number;
  beneficiario: "socio_a" | "socio_b" | "split";
  fattura: boolean;
  categoria: string;
  note?: string | null;
  data: string;
}

interface Uscita {
  id: string;
  descrizione: string;
  importo: number;
  categoria: string;
  divisiPerMeta: boolean;
  pagatoDa: "socio_a" | "socio_b" | "studio";
  note?: string | null;
  data: string;
}

interface Riepilogo {
  entrate: { totale: number; socioA: number; socioB: number; studio: number };
  uscite: { totale: number; socioA: number; socioB: number; studio: number; condivise: number };
  netto: { socioA: number; socioB: number; studio: number };
  accantonamento: { totale: number; socioA: number; socioB: number };
  saldo: { socioA: number; socioB: number };
  compensazione: { debitore: string; creditore: string; importo: number; descrizione: string };
}

interface TrendItem {
  label: string;
  entrate: number;
  uscite: number;
  accantonamento: number;
  netto: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIE_ENTRATE = ["Servizio Fotografico", "Servizio Video", "Editing", "Stampe", "Altro"];
const CATEGORIE_USCITE = ["Affitto", "Luce", "Internet", "Materiale di consumo", "Attrezzatura", "Software", "Trasporto", "Caffè", "Marketing", "Formazione", "Altro"];

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const fmtShort = (n: number) =>
  `€${n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toFixed(0)}`;

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// ─── Mini Chart ──────────────────────────────────────────────────────────────

function BarChart({ data }: { data: TrendItem[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.entrate, d.uscite)), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-0.5" style={{ height: 100 }}>
            <div
              className="flex-1 rounded-t-sm bg-[#4CAF50]/70"
              style={{ height: `${(d.entrate / maxVal) * 100}%`, minHeight: d.entrate > 0 ? 2 : 0 }}
            />
            <div
              className="flex-1 rounded-t-sm bg-[#ef4444]/70"
              style={{ height: `${(d.uscite / maxVal) * 100}%`, minHeight: d.uscite > 0 ? 2 : 0 }}
            />
          </div>
          <span className="text-[10px] text-[#666] capitalize">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: any
}) {
  return (
    <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-[#666] font-medium uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#f5f5f5] tracking-tight">{value}</div>
      {sub && <div className="text-xs text-[#555] mt-1">{sub}</div>}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <h3 className="font-semibold text-[#f5f5f5]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#555] hover:text-[#f5f5f5] hover:bg-[#222] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#888]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-[#F5A623] transition-colors";
const selectCls = inputCls + " cursor-pointer";
const btnPrimary = "flex items-center gap-2 bg-[#F5A623] hover:bg-[#e6991f] text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors";
const btnSecondary = "flex items-center gap-2 text-[#888] hover:text-[#f5f5f5] hover:bg-[#222] text-sm px-4 py-2.5 rounded-xl transition-colors border border-[rgba(255,255,255,0.08)]";

// ─── Entrata Form ─────────────────────────────────────────────────────────────

function EntrataForm({ initial, settings, onSave, onClose }: {
  initial?: Partial<Entrata>;
  settings: ContabilitaSettings;
  onSave: (data: Omit<Entrata, "id">) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    descrizione: initial?.descrizione ?? "",
    importo: initial?.importo?.toString() ?? "",
    beneficiario: (initial?.beneficiario ?? "split") as Entrata["beneficiario"],
    fattura: initial?.fattura ?? false,
    categoria: initial?.categoria ?? "Servizio Fotografico",
    note: initial?.note ?? "",
    data: initial?.data ? new Date(initial.data).toISOString().slice(0, 10) : today,
  });

  const acc = form.fattura
    ? parseFloat(form.importo || "0") * (settings.forfettarioBase / 100) * (settings.accAntonamentoRate / 100)
    : 0;
  const netto = parseFloat(form.importo || "0") - acc;

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Descrizione *">
        <input className={inputCls} value={form.descrizione} onChange={e => set("descrizione", e.target.value)} placeholder="Es. Servizio matrimonio Rossi" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Importo (€) *">
          <input className={inputCls} type="number" min="0" step="0.01" value={form.importo} onChange={e => set("importo", e.target.value)} placeholder="0.00" />
        </FormField>
        <FormField label="Data *">
          <input className={inputCls} type="date" value={form.data} onChange={e => set("data", e.target.value)} />
        </FormField>
      </div>
      <FormField label="Beneficiario *">
        <select className={selectCls} value={form.beneficiario} onChange={e => set("beneficiario", e.target.value)}>
          <option value="socio_a">{settings.socioAName}</option>
          <option value="socio_b">{settings.socioBName}</option>
          <option value="split">50/50 (Studio)</option>
        </select>
      </FormField>
      <FormField label="Categoria">
        <select className={selectCls} value={form.categoria} onChange={e => set("categoria", e.target.value)}>
          {CATEGORIE_ENTRATE.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormField>
      <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <button
          type="button"
          onClick={() => set("fattura", !form.fattura)}
          className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${form.fattura ? "bg-[#F5A623]" : "bg-[#333]"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.fattura ? "left-5" : "left-1"}`} />
        </button>
        <div>
          <div className="text-sm font-medium text-[#f5f5f5]">Fattura emessa</div>
          <div className="text-xs text-[#555]">Calcola accantonamento forfettario</div>
        </div>
      </div>
      {form.fattura && parseFloat(form.importo) > 0 && (
        <div className="bg-[#1a1200] border border-[rgba(245,166,35,0.2)] rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#888]">Lordo</span>
            <span className="text-[#f5f5f5] font-medium">{fmt(parseFloat(form.importo))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#888]">Accantonamento ({settings.forfettarioBase}% × {settings.accAntonamentoRate}%)</span>
            <span className="text-[#F5A623]">−{fmt(acc)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-[rgba(255,255,255,0.06)] pt-2">
            <span className="text-[#888] font-semibold">Netto Reale</span>
            <span className="text-[#4CAF50] font-bold">{fmt(netto)}</span>
          </div>
        </div>
      )}
      <FormField label="Note">
        <textarea className={inputCls + " resize-none"} rows={2} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Note opzionali..." />
      </FormField>
      <div className="flex gap-3 pt-2">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button
          className={btnPrimary + " flex-1 justify-center"}
          onClick={() => {
            if (!form.descrizione || !form.importo) return;
            onSave({ ...form, importo: parseFloat(form.importo), data: new Date(form.data).toISOString() });
          }}
        >
          <Check size={15} /> Salva
        </button>
      </div>
    </div>
  );
}

// ─── Uscita Form ──────────────────────────────────────────────────────────────

function UscitaForm({ initial, settings, onSave, onClose }: {
  initial?: Partial<Uscita>;
  settings: ContabilitaSettings;
  onSave: (data: Omit<Uscita, "id">) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    descrizione: initial?.descrizione ?? "",
    importo: initial?.importo?.toString() ?? "",
    categoria: initial?.categoria ?? "Affitto",
    divisiPerMeta: initial?.divisiPerMeta ?? false,
    pagatoDa: (initial?.pagatoDa ?? "studio") as Uscita["pagatoDa"],
    note: initial?.note ?? "",
    data: initial?.data ? new Date(initial.data).toISOString().slice(0, 10) : today,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const importoNum = parseFloat(form.importo || "0");

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Descrizione *">
        <input className={inputCls} value={form.descrizione} onChange={e => set("descrizione", e.target.value)} placeholder="Es. Affitto studio Maggio" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Importo (€) *">
          <input className={inputCls} type="number" min="0" step="0.01" value={form.importo} onChange={e => set("importo", e.target.value)} placeholder="0.00" />
        </FormField>
        <FormField label="Data *">
          <input className={inputCls} type="date" value={form.data} onChange={e => set("data", e.target.value)} />
        </FormField>
      </div>
      <FormField label="Categoria">
        <select className={selectCls} value={form.categoria} onChange={e => set("categoria", e.target.value)}>
          {CATEGORIE_USCITE.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormField>
      <FormField label="Pagato da">
        <select className={selectCls} value={form.pagatoDa} onChange={e => set("pagatoDa", e.target.value)}>
          <option value="socio_a">{settings.socioAName}</option>
          <option value="socio_b">{settings.socioBName}</option>
          <option value="studio">Conto Studio</option>
        </select>
      </FormField>
      <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <button
          type="button"
          onClick={() => set("divisiPerMeta", !form.divisiPerMeta)}
          className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${form.divisiPerMeta ? "bg-[#F5A623]" : "bg-[#333]"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.divisiPerMeta ? "left-5" : "left-1"}`} />
        </button>
        <div>
          <div className="text-sm font-medium text-[#f5f5f5]">Dividi a metà</div>
          <div className="text-xs text-[#555]">Ripartisce al 50% per il bilancio individuale</div>
        </div>
      </div>
      {form.divisiPerMeta && importoNum > 0 && (
        <div className="bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 flex justify-between text-sm">
          <span className="text-[#888]">Quota per socio</span>
          <span className="text-[#f5f5f5] font-semibold">{fmt(importoNum / 2)}</span>
        </div>
      )}
      <FormField label="Note">
        <textarea className={inputCls + " resize-none"} rows={2} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Note opzionali..." />
      </FormField>
      <div className="flex gap-3 pt-2">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button
          className={btnPrimary + " flex-1 justify-center"}
          onClick={() => {
            if (!form.descrizione || !form.importo) return;
            onSave({ ...form, importo: parseFloat(form.importo), data: new Date(form.data).toISOString() });
          }}
        >
          <Check size={15} /> Salva
        </button>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }: {
  settings: ContabilitaSettings;
  onSave: (s: ContabilitaSettings) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...settings });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const effRate = (form.forfettarioBase / 100) * (form.accAntonamentoRate / 100) * 100;

  return (
    <Modal title="Impostazioni Contabilità" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nome Socio A">
            <input className={inputCls} value={form.socioAName} onChange={e => set("socioAName", e.target.value)} />
          </FormField>
          <FormField label="Nome Socio B">
            <input className={inputCls} value={form.socioBName} onChange={e => set("socioBName", e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Aliquota accantonamento (%)">
            <input className={inputCls} type="number" min="0" max="100" value={form.accAntonamentoRate} onChange={e => set("accAntonamentoRate", parseFloat(e.target.value))} />
          </FormField>
          <FormField label="Base forfettaria (%)">
            <input className={inputCls} type="number" min="0" max="100" value={form.forfettarioBase} onChange={e => set("forfettarioBase", parseFloat(e.target.value))} />
          </FormField>
        </div>
        <div className="bg-[#1a1200] border border-[rgba(245,166,35,0.2)] rounded-xl p-4">
          <div className="text-xs text-[#888] mb-1">Formula accantonamento effettivo</div>
          <div className="text-sm text-[#f5f5f5]">
            Fatturato × <span className="text-[#F5A623]">{form.forfettarioBase}%</span> (base) × <span className="text-[#F5A623]">{form.accAntonamentoRate}%</span> (aliquota) = <span className="text-[#F5A623] font-bold">{effRate.toFixed(2)}%</span> effettivo
          </div>
          <div className="text-xs text-[#555] mt-1">
            Su €1.000 → accantonamento: {fmt(1000 * form.forfettarioBase / 100 * form.accAntonamentoRate / 100)}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button className={btnSecondary} onClick={onClose}>Annulla</button>
          <button className={btnPrimary + " flex-1 justify-center"} onClick={() => onSave(form)}>
            <Check size={15} /> Salva impostazioni
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Compensazione Banner ─────────────────────────────────────────────────────

function CompensazioneBanner({ comp, settings }: { comp: Riepilogo["compensazione"]; settings: ContabilitaSettings }) {
  if (comp.debitore === "in_pari") {
    return (
      <div className="flex items-center gap-3 bg-[#0d1f0d] border border-[rgba(76,175,80,0.3)] rounded-2xl p-4">
        <div className="w-9 h-9 rounded-xl bg-[#4CAF50]/20 flex items-center justify-center flex-shrink-0">
          <Check size={18} className="text-[#4CAF50]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[#4CAF50]">Soci in pari</div>
          <div className="text-xs text-[#555]">Nessuna compensazione necessaria per le spese condivise.</div>
        </div>
      </div>
    );
  }
  const debitoreNome = comp.debitore === "socio_a" ? settings.socioAName : settings.socioBName;
  const creditoreNome = comp.creditore === "socio_a" ? settings.socioAName : settings.socioBName;
  return (
    <div className="flex items-center gap-3 bg-[#1a0d00] border border-[rgba(245,166,35,0.3)] rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl bg-[#F5A623]/20 flex items-center justify-center flex-shrink-0">
        <Scale size={18} className="text-[#F5A623]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#F5A623]">Compensazione spese condivise</div>
        <div className="text-xs text-[#888] mt-0.5">
          <span className="text-[#f5f5f5]">{debitoreNome}</span> deve a <span className="text-[#f5f5f5]">{creditoreNome}</span>
        </div>
      </div>
      <div className="text-xl font-bold text-[#F5A623] flex-shrink-0">{fmt(comp.importo)}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "entrate" | "uscite";

export default function Contabilita() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<ContabilitaSettings>({
    socioAName: "Alessio Rollo", socioBName: "Gianluca Distante",
    accAntonamentoRate: 20, forfettarioBase: 78,
  });
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [entrate, setEntrate] = useState<Entrata[]>([]);
  const [uscite, setUscite] = useState<Uscita[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [addEntrata, setAddEntrata] = useState(false);
  const [addUscita, setAddUscita] = useState(false);
  const [editEntrata, setEditEntrata] = useState<Entrata | null>(null);
  const [editUscita, setEditUscita] = useState<Uscita | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes, tRes, eRes, uRes] = await Promise.all([
        api.get("/api/contabilita/settings"),
        api.get(`/api/contabilita/riepilogo?month=${month}&year=${year}`),
        api.get("/api/contabilita/trend"),
        api.get(`/api/contabilita/entrate?month=${month}&year=${year}`),
        api.get(`/api/contabilita/uscite?month=${month}&year=${year}`),
      ]);
      if (sRes.ok) setSettings(await sRes.json());
      if (rRes.ok) setRiepilogo(await rRes.json());
      if (tRes.ok) setTrend(await tRes.json());
      if (eRes.ok) setEntrate(await eRes.json());
      if (uRes.ok) setUscite(await uRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const saveSettings = async (s: ContabilitaSettings) => {
    const res = await api.put("/api/contabilita/settings", s);
    if (res.ok) { setSettings(s); setShowSettings(false); fetchAll(); }
  };

  const saveEntrata = async (data: Omit<Entrata, "id">) => {
    const res = editEntrata
      ? await api.patch(`/api/contabilita/entrate/${editEntrata.id}`, data)
      : await api.post("/api/contabilita/entrate", data);
    if (res.ok) { setAddEntrata(false); setEditEntrata(null); fetchAll(); }
  };

  const deleteEntrata = async (id: string) => {
    if (!confirm("Eliminare questa entrata?")) return;
    await api.delete(`/api/contabilita/entrate/${id}`);
    fetchAll();
  };

  const saveUscita = async (data: Omit<Uscita, "id">) => {
    const res = editUscita
      ? await api.patch(`/api/contabilita/uscite/${editUscita.id}`, data)
      : await api.post("/api/contabilita/uscite", data);
    if (res.ok) { setAddUscita(false); setEditUscita(null); fetchAll(); }
  };

  const deleteUscita = async (id: string) => {
    if (!confirm("Eliminare questa uscita?")) return;
    await api.delete(`/api/contabilita/uscite/${id}`);
    fetchAll();
  };

  const beneficiarioLabel = (b: string) => {
    if (b === "socio_a") return settings.socioAName.split(" ")[0];
    if (b === "socio_b") return settings.socioBName.split(" ")[0];
    return "50/50";
  };

  const pagatoDaLabel = (p: string) => {
    if (p === "socio_a") return settings.socioAName.split(" ")[0];
    if (p === "socio_b") return settings.socioBName.split(" ")[0];
    return "Studio";
  };

  const saldoColor = (n: number) => n >= 0 ? "text-[#4CAF50]" : "text-[#ef4444]";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f5f5f5] tracking-tight">Contabilità</h1>
            <p className="text-sm text-[#666] mt-0.5">Gestione finanziaria studio · {settings.socioAName} & {settings.socioBName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={prevMonth} className="p-2 rounded-xl border border-[rgba(255,255,255,0.06)] text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-base font-semibold text-[#f5f5f5] min-w-[160px] text-center">
            {monthNames[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl border border-[rgba(255,255,255,0.06)] text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#111] rounded-2xl mb-6 w-fit">
          {(["dashboard", "entrate", "uscite"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all ${tab === t ? "bg-[#F5A623] text-black" : "text-[#666] hover:text-[#f5f5f5]"}`}
            >
              {t === "dashboard" ? "Riepilogo" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16 text-[#555]">Caricamento...</div>
        )}

        {/* ── DASHBOARD TAB ── */}
        {!loading && tab === "dashboard" && riepilogo && (
          <div className="space-y-6">
            {/* Compensazione */}
            <CompensazioneBanner comp={riepilogo.compensazione} settings={settings} />

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Entrate Totali" value={fmt(riepilogo.entrate.totale)} color="bg-[#4CAF50]/20 text-[#4CAF50]" icon={TrendingUp} />
              <StatCard label="Uscite Totali" value={fmt(riepilogo.uscite.totale)} color="bg-[#ef4444]/20 text-[#ef4444]" icon={TrendingDown} />
              <StatCard label="Accantonamento" value={fmt(riepilogo.accantonamento.totale)} sub={`${settings.forfettarioBase}% × ${settings.accAntonamentoRate}% su fatturato`} color="bg-[#F5A623]/20 text-[#F5A623]" icon={PiggyBank} />
              <StatCard label="Netto Studio" value={fmt(riepilogo.netto.studio)} color="bg-[#8b5cf6]/20 text-[#8b5cf6]" icon={Wallet} />
            </div>

            {/* Soci breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Socio A */}
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-[#666] uppercase tracking-wide mb-1">Socio A</div>
                    <div className="text-base font-semibold text-[#f5f5f5]">{settings.socioAName}</div>
                  </div>
                  <div className={`text-xl font-bold ${saldoColor(riepilogo.saldo.socioA)}`}>{fmt(riepilogo.saldo.socioA)}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Entrate lorde</span><span className="text-[#f5f5f5]">{fmt(riepilogo.entrate.socioA + riepilogo.entrate.studio / 2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Netto (dopo acc.)</span><span className="text-[#4CAF50]">{fmt(riepilogo.netto.socioA)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Accantonamento</span><span className="text-[#F5A623]">−{fmt(riepilogo.accantonamento.socioA)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Uscite</span><span className="text-[#ef4444]">−{fmt(riepilogo.uscite.socioA)}</span></div>
                  <div className="border-t border-[rgba(255,255,255,0.05)] pt-2 flex justify-between text-sm font-semibold">
                    <span className="text-[#888]">Saldo netto</span>
                    <span className={saldoColor(riepilogo.saldo.socioA)}>{fmt(riepilogo.saldo.socioA)}</span>
                  </div>
                </div>
              </div>

              {/* Socio B */}
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-[#666] uppercase tracking-wide mb-1">Socio B</div>
                    <div className="text-base font-semibold text-[#f5f5f5]">{settings.socioBName}</div>
                  </div>
                  <div className={`text-xl font-bold ${saldoColor(riepilogo.saldo.socioB)}`}>{fmt(riepilogo.saldo.socioB)}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Entrate lorde</span><span className="text-[#f5f5f5]">{fmt(riepilogo.entrate.socioB + riepilogo.entrate.studio / 2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Netto (dopo acc.)</span><span className="text-[#4CAF50]">{fmt(riepilogo.netto.socioB)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Accantonamento</span><span className="text-[#F5A623]">−{fmt(riepilogo.accantonamento.socioB)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">Uscite</span><span className="text-[#ef4444]">−{fmt(riepilogo.uscite.socioB)}</span></div>
                  <div className="border-t border-[rgba(255,255,255,0.05)] pt-2 flex justify-between text-sm font-semibold">
                    <span className="text-[#888]">Saldo netto</span>
                    <span className={saldoColor(riepilogo.saldo.socioB)}>{fmt(riepilogo.saldo.socioB)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend chart */}
            {trend.length > 0 && (
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#f5f5f5]">Andamento ultimi 6 mesi</h3>
                  <div className="flex items-center gap-4 text-xs text-[#555]">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#4CAF50]/70 inline-block" /> Entrate</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#ef4444]/70 inline-block" /> Uscite</span>
                  </div>
                </div>
                <BarChart data={trend} />
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {trend.slice(-3).map((d, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs text-[#555] mb-1 capitalize">{d.label}</div>
                      <div className="text-sm font-semibold text-[#f5f5f5]">{fmtShort(d.netto)}</div>
                      <div className="text-xs text-[#555]">netto</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spese condivise detail */}
            <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-[#f5f5f5] mb-3">Spese condivise del periodo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#555] mb-1">Totale spese condivise</div>
                  <div className="text-lg font-bold text-[#f5f5f5]">{fmt(riepilogo.uscite.condivise)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#555] mb-1">Quota per socio</div>
                  <div className="text-lg font-bold text-[#f5f5f5]">{fmt(riepilogo.uscite.condivise / 2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ENTRATE TAB ── */}
        {!loading && tab === "entrate" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-[#555]">{entrate.length} voci · Totale: <span className="text-[#4CAF50] font-semibold">{fmt(entrate.reduce((s, e) => s + e.importo, 0))}</span></div>
              <button onClick={() => setAddEntrata(true)} className={btnPrimary}>
                <Plus size={15} /> Nuova entrata
              </button>
            </div>
            {entrate.length === 0 ? (
              <div className="text-center py-16 text-[#444]">Nessuna entrata in {monthNames[month - 1]} {year}</div>
            ) : (
              <div className="space-y-2">
                {entrate.map(e => {
                  const acc = e.fattura ? e.importo * (settings.forfettarioBase / 100) * (settings.accAntonamentoRate / 100) : 0;
                  const netto = e.importo - acc;
                  return (
                    <div key={e.id} className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full flex-shrink-0 ${e.fattura ? "bg-[#F5A623]" : "bg-[#4CAF50]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-[#f5f5f5] truncate">{e.descrizione}</span>
                          {e.fattura && <span className="text-[10px] bg-[#F5A623]/20 text-[#F5A623] px-1.5 py-0.5 rounded-md font-medium">FATTURA</span>}
                          <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{e.categoria}</span>
                          <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{beneficiarioLabel(e.beneficiario)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#555]">
                          <span>{new Date(e.data).toLocaleDateString("it-IT")}</span>
                          {e.fattura && <span className="text-[#F5A623]">Acc. {fmt(acc)}</span>}
                          <span className="text-[#4CAF50]">Netto {fmt(netto)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold text-[#f5f5f5]">{fmt(e.importo)}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditEntrata(e)} className="p-2 rounded-lg text-[#555] hover:text-[#F5A623] hover:bg-[#1a1a1a] transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteEntrata(e.id)} className="p-2 rounded-lg text-[#555] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── USCITE TAB ── */}
        {!loading && tab === "uscite" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-[#555]">{uscite.length} voci · Totale: <span className="text-[#ef4444] font-semibold">{fmt(uscite.reduce((s, u) => s + u.importo, 0))}</span></div>
              <button onClick={() => setAddUscita(true)} className={btnPrimary}>
                <Plus size={15} /> Nuova uscita
              </button>
            </div>
            {uscite.length === 0 ? (
              <div className="text-center py-16 text-[#444]">Nessuna uscita in {monthNames[month - 1]} {year}</div>
            ) : (
              <div className="space-y-2">
                {uscite.map(u => (
                  <div key={u.id} className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex items-center gap-4">
                    <div className={`w-2 h-12 rounded-full flex-shrink-0 ${u.divisiPerMeta ? "bg-[#F5A623]" : "bg-[#ef4444]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-[#f5f5f5] truncate">{u.descrizione}</span>
                        {u.divisiPerMeta && <span className="text-[10px] bg-[#F5A623]/20 text-[#F5A623] px-1.5 py-0.5 rounded-md font-medium">÷2</span>}
                        <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{u.categoria}</span>
                        <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">Pag. {pagatoDaLabel(u.pagatoDa)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#555]">
                        <span>{new Date(u.data).toLocaleDateString("it-IT")}</span>
                        {u.divisiPerMeta && <span className="text-[#F5A623]">Quota/socio: {fmt(u.importo / 2)}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-[#f5f5f5]">{fmt(u.importo)}</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditUscita(u)} className="p-2 rounded-lg text-[#555] hover:text-[#F5A623] hover:bg-[#1a1a1a] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteUscita(u.id)} className="p-2 rounded-lg text-[#555] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />}

      {(addEntrata || editEntrata) && (
        <Modal title={editEntrata ? "Modifica entrata" : "Nuova entrata"} onClose={() => { setAddEntrata(false); setEditEntrata(null); }}>
          <EntrataForm
            initial={editEntrata ?? undefined}
            settings={settings}
            onSave={saveEntrata}
            onClose={() => { setAddEntrata(false); setEditEntrata(null); }}
          />
        </Modal>
      )}

      {(addUscita || editUscita) && (
        <Modal title={editUscita ? "Modifica uscita" : "Nuova uscita"} onClose={() => { setAddUscita(false); setEditUscita(null); }}>
          <UscitaForm
            initial={editUscita ?? undefined}
            settings={settings}
            onSave={saveUscita}
            onClose={() => { setAddUscita(false); setEditUscita(null); }}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
