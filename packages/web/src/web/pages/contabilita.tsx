import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Scale, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Check, Settings, AlertCircle, Handshake,
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
  acconto?: number | null;
  saldoRicevuto?: number | null;
  clientId?: string | null;
  clientName?: string | null;
  beneficiario: "socio_a" | "socio_b" | "split";
  fattura: boolean;
  speseOperatore?: number | null;
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
  speseOperatore: { totale: number };
  saldo: { socioA: number; socioB: number };
  compensazione: { debitore: string; creditore: string; importo: number; importoLordo: number; pareggiato: number; descrizione: string };
}

interface TrendItem {
  label: string;
  entrate: number;
  uscite: number;
  accantonamento: number;
  netto: number;
}

interface Pareggio {
  id: string;
  tipo: "pagamento" | "sconto_entrata";
  importo: number;
  debitore: "socio_a" | "socio_b";
  creditore: "socio_a" | "socio_b";
  entrataId?: string | null;
  note?: string | null;
  data: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIE_ENTRATE = ["Servizio Fotografico", "Servizio Video", "Editing", "Stampe", "Altro"];
const CATEGORIE_USCITE = ["Affitto", "Luce", "Internet", "Materiale di consumo", "Attrezzatura", "Software", "Trasporto", "Caffè", "Marketing", "Formazione", "Altro"];
const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// ─── SVG Line + Bar Chart ─────────────────────────────────────────────────────

function TrendChart({ data }: { data: TrendItem[] }) {
  if (!data.length) return null;
  const W = 560, H = 160, PAD = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap(d => [d.entrate, d.uscite, d.accantonamento]);
  const maxVal = Math.max(...allVals, 1);

  const xStep = innerW / (data.length - 1 || 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const linePath = (key: "entrate" | "uscite" | "accantonamento") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d[key]).toFixed(1)}`).join(" ");

  const areaPath = (key: "entrate" | "uscite") => {
    const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(" L ");
    const base = PAD.top + innerH;
    return `M ${toX(0).toFixed(1)},${base} L ${pts} L ${toX(data.length - 1).toFixed(1)},${base} Z`;
  };

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: maxVal * t, y: PAD.top + innerH - t * innerH }));

  const fmtK = (n: number) => n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${n.toFixed(0)}`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <defs>
          <linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4CAF50" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradUsc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {ticks.map(({ val, y }) => (
          <g key={val}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#444" fontSize="9">{fmtK(val)}</text>
          </g>
        ))}

        {/* Area fills */}
        <path d={areaPath("entrate")} fill="url(#gradEnt)" />
        <path d={areaPath("uscite")} fill="url(#gradUsc)" />

        {/* Lines */}
        <path d={linePath("entrate")} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath("uscite")} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath("accantonamento")} fill="none" stroke="#F5A623" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots + labels */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.entrate)} r="3.5" fill="#4CAF50" stroke="#111" strokeWidth="1.5" />
            <circle cx={toX(i)} cy={toY(d.uscite)} r="3.5" fill="#ef4444" stroke="#111" strokeWidth="1.5" />
            <text
              x={toX(i)} y={H - 6}
              textAnchor="middle" fill="#555" fontSize="10" className="capitalize"
            >{d.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Donut chart for composition ─────────────────────────────────────────────

function DonutChart({ socioA, socioB, studio, labelA, labelB }: {
  socioA: number; socioB: number; studio: number; labelA: string; labelB: string;
}) {
  const total = socioA + socioB + studio;
  if (total <= 0) return <div className="text-center text-xs text-[#444] py-4">Nessun dato</div>;
  const cx = 60, cy = 60, r = 48, stroke = 12;
  const circ = 2 * Math.PI * r;
  const segments = [
    { val: socioA, color: "#F5A623", label: labelA },
    { val: socioB, color: "#8b5cf6", label: labelB },
    { val: studio, color: "#3b82f6", label: "Studio" },
  ].filter(s => s.val > 0);

  let offset = 0;
  const arcs = segments.map(s => {
    const len = (s.val / total) * circ;
    const arc = { ...s, offset, len };
    offset += len;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-24 h-24 flex-shrink-0" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.len} ${circ - a.len}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="space-y-2 flex-1">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className="text-xs text-[#888]">{a.label}</span>
            </div>
            <span className="text-xs font-semibold text-[#f5f5f5]">{fmt(a.val)}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-[rgba(255,255,255,0.05)] flex justify-between">
          <span className="text-xs text-[#555]">Totale</span>
          <span className="text-xs font-bold text-[#f5f5f5]">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: any;
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl my-auto">
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

const inputCls = "bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-[#F5A623] transition-colors w-full";
const selectCls = inputCls + " cursor-pointer";
const btnPrimary = "flex items-center gap-2 bg-[#F5A623] hover:bg-[#e6991f] text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50";
const btnSecondary = "flex items-center gap-2 text-[#888] hover:text-[#f5f5f5] hover:bg-[#222] text-sm px-4 py-2.5 rounded-xl transition-colors border border-[rgba(255,255,255,0.08)]";

function Toggle({ value, onChange, label, sub }: {
  value: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] cursor-pointer" onClick={() => onChange(!value)}>
      <div className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${value ? "bg-[#F5A623]" : "bg-[#333]"}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-1"}`} />
      </div>
      <div>
        <div className="text-sm font-medium text-[#f5f5f5]">{label}</div>
        {sub && <div className="text-xs text-[#555]">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Entrata Form ─────────────────────────────────────────────────────────────

function EntrataForm({ initial, settings, clients, onSave, onClose }: {
  initial?: Partial<Entrata>;
  settings: ContabilitaSettings;
  clients: { id: string; name: string }[];
  onSave: (data: Omit<Entrata, "id">) => Promise<string | null>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    descrizione: initial?.descrizione ?? "",
    importo: initial?.importo?.toString() ?? "",
    acconto: initial?.acconto != null ? String(initial.acconto) : "",
    saldoRicevuto: initial?.saldoRicevuto != null ? String(initial.saldoRicevuto) : "",
    speseOperatore: initial?.speseOperatore != null ? String(initial.speseOperatore) : "",
    clientId: initial?.clientId ?? "",
    beneficiario: (initial?.beneficiario ?? "split") as Entrata["beneficiario"],
    fattura: initial?.fattura ?? false,
    categoria: initial?.categoria ?? "Servizio Fotografico",
    note: initial?.note ?? "",
    data: initial?.data ? new Date(initial.data).toISOString().slice(0, 10) : today,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const importoNum = parseFloat(form.importo || "0") || 0;
  const accontoNum = parseFloat(form.acconto || "0") || 0;
  const saldoNum = parseFloat(form.saldoRicevuto || "0") || 0;
  const ricevutoTotale = accontoNum + saldoNum;
  const residuo = importoNum - ricevutoTotale;
  const speseOpNum = parseFloat(form.speseOperatore || "0") || 0;
  const accForf = form.fattura ? importoNum * (settings.forfettarioBase / 100) * (settings.accAntonamentoRate / 100) : 0;
  const netto = importoNum - accForf - speseOpNum;

  const handleSave = async () => {
    if (!form.descrizione.trim()) { setError("Inserisci una descrizione"); return; }
    if (!form.importo || importoNum <= 0) { setError("Inserisci un importo valido"); return; }
    setSaving(true); setError(null);
    const err = await onSave({
      descrizione: form.descrizione.trim(),
      importo: importoNum,
      acconto: accontoNum || null,
      saldoRicevuto: saldoNum || null,
      speseOperatore: speseOpNum || 0,
      clientId: form.clientId || null,
      beneficiario: form.beneficiario,
      fattura: form.fattura,
      categoria: form.categoria,
      note: form.note.trim() || null,
      data: new Date(form.data).toISOString(),
    });
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 text-sm text-[#ef4444]">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
        </div>
      )}
      <FormField label="Descrizione *">
        <input className={inputCls} value={form.descrizione} onChange={e => set("descrizione", e.target.value)} placeholder="Es. Servizio matrimonio Rossi" />
      </FormField>

      {/* Cliente opzionale */}
      <FormField label="Cliente">
        <select className={selectCls} value={form.clientId} onChange={e => set("clientId", e.target.value)}>
          <option value="">— Nessun cliente —</option>
          {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Totale preventivo (€) *">
          <input className={inputCls} type="number" min="0" step="0.01" value={form.importo} onChange={e => set("importo", e.target.value)} placeholder="0.00" />
        </FormField>
        <FormField label="Data *">
          <input className={inputCls} type="date" value={form.data} onChange={e => set("data", e.target.value)} />
        </FormField>
      </div>

      {/* Acconto + Saldo */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Acconto ricevuto (€)">
          <input className={inputCls} type="number" min="0" step="0.01" value={form.acconto} onChange={e => set("acconto", e.target.value)} placeholder="0.00" />
        </FormField>
        <FormField label="Saldo ricevuto (€)">
          <input className={inputCls} type="number" min="0" step="0.01" value={form.saldoRicevuto} onChange={e => set("saldoRicevuto", e.target.value)} placeholder="0.00" />
        </FormField>
      </div>

      {/* Riepilogo pagamenti */}
      {importoNum > 0 && (
        <div className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 space-y-1.5 text-sm">
          {accontoNum > 0 && <div className="flex justify-between"><span className="text-[#666]">Acconto</span><span className="text-[#f5f5f5]">{fmt(accontoNum)}</span></div>}
          {saldoNum > 0 && <div className="flex justify-between"><span className="text-[#666]">Saldo</span><span className="text-[#f5f5f5]">{fmt(saldoNum)}</span></div>}
          {ricevutoTotale > 0 && <div className="flex justify-between border-t border-[rgba(255,255,255,0.06)] pt-1.5">
            <span className="text-[#888]">Ricevuto</span><span className="text-[#4CAF50] font-semibold">{fmt(ricevutoTotale)}</span>
          </div>}
          {residuo > 0.01 && <div className="flex justify-between"><span className="text-[#888]">Da incassare</span><span className="text-[#F5A623] font-semibold">{fmt(residuo)}</span></div>}
          {residuo <= 0.01 && ricevutoTotale > 0 && <div className="flex justify-between"><span className="text-[#888]">Stato</span><span className="text-[#4CAF50] font-semibold">Saldato ✓</span></div>}
        </div>
      )}

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
      <FormField label="Spese Operatore (€)" sub="Collaboratori da detrarre dal netto">
        <input className={inputCls} type="number" min="0" step="0.01" value={form.speseOperatore} onChange={e => set("speseOperatore", e.target.value)} placeholder="0.00" />
      </FormField>

      <Toggle value={form.fattura} onChange={v => set("fattura", v)} label="Fattura emessa" sub="Calcola accantonamento forfettario" />
      {(form.fattura || speseOpNum > 0) && importoNum > 0 && (
        <div className="bg-[#1a1200] border border-[rgba(245,166,35,0.2)] rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-[#888]">Lordo</span><span className="text-[#f5f5f5] font-medium">{fmt(importoNum)}</span></div>
          {form.fattura && <div className="flex justify-between text-sm"><span className="text-[#888]">Accantonamento ({settings.forfettarioBase}% × {settings.accAntonamentoRate}%)</span><span className="text-[#F5A623]">−{fmt(accForf)}</span></div>}
          {speseOpNum > 0 && <div className="flex justify-between text-sm"><span className="text-[#888]">Spese operatore</span><span className="text-[#ef4444]">−{fmt(speseOpNum)}</span></div>}
          <div className="flex justify-between text-sm border-t border-[rgba(255,255,255,0.06)] pt-2"><span className="text-[#888] font-semibold">Netto Reale</span><span className="text-[#4CAF50] font-bold">{fmt(netto)}</span></div>
        </div>
      )}
      <FormField label="Note">
        <textarea className={inputCls + " resize-none"} rows={2} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Opzionale..." />
      </FormField>
      <div className="flex gap-3 pt-2">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button className={btnPrimary + " flex-1 justify-center"} onClick={handleSave} disabled={saving}>
          <Check size={15} /> {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}

// ─── Uscita Form ──────────────────────────────────────────────────────────────

function UscitaForm({ initial, settings, onSave, onClose }: {
  initial?: Partial<Uscita>;
  settings: ContabilitaSettings;
  onSave: (data: Omit<Uscita, "id">) => Promise<string | null>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const importoNum = parseFloat(form.importo || "0") || 0;

  const handleSave = async () => {
    if (!form.descrizione.trim()) { setError("Inserisci una descrizione"); return; }
    if (!form.importo || importoNum <= 0) { setError("Inserisci un importo valido"); return; }
    setSaving(true); setError(null);
    const err = await onSave({
      descrizione: form.descrizione.trim(),
      importo: importoNum,
      categoria: form.categoria,
      divisiPerMeta: form.divisiPerMeta,
      pagatoDa: form.pagatoDa,
      note: form.note.trim() || null,
      data: new Date(form.data).toISOString(),
    });
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 text-sm text-[#ef4444]">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
        </div>
      )}
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
          {CATEGORIE_USCITE.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </FormField>
      <FormField label="Pagato da">
        <select className={selectCls} value={form.pagatoDa} onChange={e => set("pagatoDa", e.target.value)}>
          <option value="socio_a">{settings.socioAName}</option>
          <option value="socio_b">{settings.socioBName}</option>
          <option value="studio">Conto Studio</option>
        </select>
      </FormField>
      <Toggle value={form.divisiPerMeta} onChange={v => set("divisiPerMeta", v)} label="Dividi a metà" sub="Ripartisce al 50% per il bilancio individuale" />
      {form.divisiPerMeta && importoNum > 0 && (
        <div className="bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 flex justify-between text-sm">
          <span className="text-[#888]">Quota per socio</span>
          <span className="text-[#f5f5f5] font-semibold">{fmt(importoNum / 2)}</span>
        </div>
      )}
      <FormField label="Note">
        <textarea className={inputCls + " resize-none"} rows={2} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Opzionale..." />
      </FormField>
      <div className="flex gap-3 pt-2">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button className={btnPrimary + " flex-1 justify-center"} onClick={handleSave} disabled={saving}>
          <Check size={15} /> {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }: {
  settings: ContabilitaSettings;
  onSave: (s: ContabilitaSettings) => Promise<string | null>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const effRate = (form.forfettarioBase / 100) * (form.accAntonamentoRate / 100) * 100;

  const handleSave = async () => {
    setSaving(true); setError(null);
    const err = await onSave(form);
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <Modal title="Impostazioni Contabilità" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 text-sm text-[#ef4444]">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nome Socio A"><input className={inputCls} value={form.socioAName} onChange={e => set("socioAName", e.target.value)} /></FormField>
          <FormField label="Nome Socio B"><input className={inputCls} value={form.socioBName} onChange={e => set("socioBName", e.target.value)} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Aliquota accantonamento (%)"><input className={inputCls} type="number" min="0" max="100" step="0.5" value={form.accAntonamentoRate} onChange={e => set("accAntonamentoRate", parseFloat(e.target.value))} /></FormField>
          <FormField label="Base forfettaria (%)"><input className={inputCls} type="number" min="0" max="100" step="1" value={form.forfettarioBase} onChange={e => set("forfettarioBase", parseFloat(e.target.value))} /></FormField>
        </div>
        <div className="bg-[#1a1200] border border-[rgba(245,166,35,0.2)] rounded-xl p-4">
          <div className="text-xs text-[#888] mb-1">Formula effettiva su fatturato</div>
          <div className="text-sm text-[#f5f5f5]">
            {form.forfettarioBase}% × {form.accAntonamentoRate}% = <span className="text-[#F5A623] font-bold">{effRate.toFixed(2)}%</span>
          </div>
          <div className="text-xs text-[#555] mt-1">Su €1.000 → accantonamento: {fmt(1000 * effRate / 100)}</div>
        </div>
        <div className="flex gap-3 pt-2">
          <button className={btnSecondary} onClick={onClose}>Annulla</button>
          <button className={btnPrimary + " flex-1 justify-center"} onClick={handleSave} disabled={saving}>
            <Check size={15} /> {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Compensazione Banner ─────────────────────────────────────────────────────

function CompensazioneBanner({
  comp, settings, onPareggia,
}: {
  comp: Riepilogo["compensazione"];
  settings: ContabilitaSettings;
  onPareggia: () => void;
}) {
  if (comp.debitore === "in_pari") {
    return (
      <div className="flex items-center gap-3 bg-[#0d1f0d] border border-[rgba(76,175,80,0.3)] rounded-2xl p-4">
        <div className="w-9 h-9 rounded-xl bg-[#4CAF50]/20 flex items-center justify-center flex-shrink-0"><Check size={18} className="text-[#4CAF50]" /></div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#4CAF50]">Soci in pari</div>
          <div className="text-xs text-[#555]">Nessuna compensazione necessaria.</div>
        </div>
        {comp.pareggiato > 0 && (
          <div className="text-xs text-[#4CAF50] opacity-70">Pareggiato {fmt(comp.pareggiato)}</div>
        )}
      </div>
    );
  }
  const debitoreNome = comp.debitore === "socio_a" ? settings.socioAName : settings.socioBName;
  const creditoreNome = comp.creditore === "socio_a" ? settings.socioAName : settings.socioBName;
  const hasParziale = comp.pareggiato > 0;
  return (
    <div className="bg-[#1a0d00] border border-[rgba(245,166,35,0.3)] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F5A623]/20 flex items-center justify-center flex-shrink-0"><Scale size={18} className="text-[#F5A623]" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#F5A623]">Sbilancio tra soci</div>
          <div className="text-xs text-[#888] mt-0.5">
            <span className="text-[#f5f5f5]">{debitoreNome}</span> deve a <span className="text-[#f5f5f5]">{creditoreNome}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-[#F5A623]">{fmt(comp.importo)}</div>
          {hasParziale && <div className="text-xs text-[#666]">lordo {fmt(comp.importoLordo)} · già saldato {fmt(comp.pareggiato)}</div>}
        </div>
      </div>
      <button
        onClick={onPareggia}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#F5A623]/15 hover:bg-[#F5A623]/25 text-[#F5A623] text-sm font-medium transition-colors border border-[rgba(245,166,35,0.2)]"
      >
        <Handshake size={15} />
        Registra pareggio
      </button>
    </div>
  );
}

// ─── Form Pareggio ────────────────────────────────────────────────────────────

function FormPareggio({
  settings,
  comp,
  entrate,
  onSave,
  onClose,
}: {
  settings: ContabilitaSettings;
  comp: Riepilogo["compensazione"];
  entrate: Entrata[];
  onSave: (data: Omit<Pareggio, "id" | "data"> & { data?: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const suggeritaDebitore = comp.debitore !== "in_pari" ? comp.debitore as "socio_a" | "socio_b" : "socio_a";
  const suggeritaCreditore = comp.creditore !== "in_pari" ? comp.creditore as "socio_a" | "socio_b" : "socio_b";

  const [form, setForm] = useState({
    tipo: "pagamento" as "pagamento" | "sconto_entrata",
    importo: comp.importo > 0 ? String(comp.importo.toFixed(2)) : "",
    debitore: suggeritaDebitore,
    creditore: suggeritaCreditore,
    entrataId: "",
    note: "",
    data: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.importo || Number(form.importo) <= 0) { setError("Importo non valido"); return; }
    if (form.debitore === form.creditore) { setError("Debitore e creditore devono essere diversi"); return; }
    setSaving(true); setError(null);
    const err = await onSave({
      tipo: form.tipo,
      importo: Number(form.importo),
      debitore: form.debitore as "socio_a" | "socio_b",
      creditore: form.creditore as "socio_a" | "socio_b",
      entrataId: form.tipo === "sconto_entrata" && form.entrataId ? form.entrataId : null,
      note: form.note || null,
      data: form.data,
    });
    setSaving(false);
    if (err) setError(err); else onClose();
  };

  const nomeA = settings.socioAName.split(" ")[0];
  const nomeB = settings.socioBName.split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-[#F5A623]" />
            <h2 className="text-base font-semibold text-[#f5f5f5]">Registra pareggio</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#555] hover:text-[#f5f5f5] hover:bg-[#1a1a1a]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-[#ef4444]/10 border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm"><AlertCircle size={14} />{error}</div>}

          {/* Tipo */}
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Tipo pareggio</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "pagamento", label: "💸 Pagamento diretto" },
                { val: "sconto_entrata", label: "🎯 Sconto su entrata" },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => set("tipo", val)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${form.tipo === val ? "bg-[#F5A623]/20 border-[#F5A623]/50 text-[#F5A623]" : "border-[rgba(255,255,255,0.08)] text-[#666] hover:border-[rgba(255,255,255,0.15)]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Debitore / creditore */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Chi paga / cede</label>
              <select value={form.debitore} onChange={e => set("debitore", e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5]">
                <option value="socio_a">{nomeA}</option>
                <option value="socio_b">{nomeB}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Chi riceve</label>
              <select value={form.creditore} onChange={e => set("creditore", e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5]">
                <option value="socio_a">{nomeA}</option>
                <option value="socio_b">{nomeB}</option>
              </select>
            </div>
          </div>

          {/* Importo */}
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Importo (€)</label>
            <input type="number" step="0.01" min="0" value={form.importo} onChange={e => set("importo", e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#444]" />
            {comp.importo > 0 && (
              <div className="mt-1.5 flex gap-2">
                <button onClick={() => set("importo", comp.importo.toFixed(2))}
                  className="text-xs text-[#F5A623] hover:underline">Saldo totale {fmt(comp.importo)}</button>
              </div>
            )}
          </div>

          {/* Entrata collegata (solo sconto_entrata) */}
          {form.tipo === "sconto_entrata" && (
            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Entrata collegata (opzionale)</label>
              <select value={form.entrataId} onChange={e => set("entrataId", e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5]">
                <option value="">— nessuna —</option>
                {entrate.map(e => (
                  <option key={e.id} value={e.id}>{e.descrizione} · {fmt(e.importo)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Data */}
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Data</label>
            <input type="date" value={form.data} onChange={e => set("data", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5]" />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Note (opzionale)</label>
            <input value={form.note} onChange={e => set("note", e.target.value)}
              placeholder="Es. Bonifico del 15/05..."
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#444]" />
          </div>

          <button onClick={submit} disabled={saving}
            className="w-full py-3 rounded-xl bg-[#F5A623] text-black font-semibold text-sm hover:bg-[#e09510] disabled:opacity-50 transition-colors">
            {saving ? "Salvataggio..." : "Conferma pareggio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Storico Pareggi ─────────────────────────────────────────────────────────

function StoricoPareggi({
  pareggi,
  settings,
  onDelete,
}: {
  pareggi: Pareggio[];
  settings: ContabilitaSettings;
  onDelete: (id: string) => void;
}) {
  if (pareggi.length === 0) return null;
  const nomeA = settings.socioAName.split(" ")[0];
  const nomeB = settings.socioBName.split(" ")[0];
  const nomeSocio = (s: string) => s === "socio_a" ? nomeA : nomeB;
  return (
    <div className="bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
        <Handshake size={15} className="text-[#F5A623]" />
        <span className="text-sm font-semibold text-[#f5f5f5]">Storico pareggi</span>
        <span className="ml-auto text-xs text-[#555]">{pareggi.length} registraz.</span>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {pareggi.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-[#F5A623]/10 flex items-center justify-center flex-shrink-0 text-base">
              {p.tipo === "pagamento" ? "💸" : "🎯"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#f5f5f5] font-medium">
                {nomeSocio(p.debitore)} → {nomeSocio(p.creditore)}
              </div>
              <div className="text-xs text-[#555] mt-0.5 flex gap-2">
                <span>{p.tipo === "pagamento" ? "Pagamento diretto" : "Sconto su entrata"}</span>
                <span>·</span>
                <span>{new Date(p.data).toLocaleDateString("it-IT")}</span>
                {p.note && <><span>·</span><span className="truncate max-w-[120px]">{p.note}</span></>}
              </div>
            </div>
            <div className="text-sm font-bold text-[#4CAF50] flex-shrink-0 mr-2">{fmt(p.importo)}</div>
            <button onClick={() => onDelete(p.id)} className="p-1.5 rounded-lg text-[#333] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
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
  const [pareggi, setPareggi] = useState<Pareggio[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [addEntrata, setAddEntrata] = useState(false);
  const [addUscita, setAddUscita] = useState(false);
  const [editEntrata, setEditEntrata] = useState<Entrata | null>(null);
  const [editUscita, setEditUscita] = useState<Uscita | null>(null);
  const [showPareggio, setShowPareggio] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes, tRes, eRes, uRes, pRes, clRes] = await Promise.all([
        api.get("/api/contabilita/settings"),
        api.get(`/api/contabilita/riepilogo?month=${month}&year=${year}`),
        api.get("/api/contabilita/trend"),
        api.get(`/api/contabilita/entrate?month=${month}&year=${year}`),
        api.get(`/api/contabilita/uscite?month=${month}&year=${year}`),
        api.get("/api/contabilita/pareggi"),
        api.get("/api/clients"),
      ]);
      if (sRes.ok) { const d = await sRes.json(); if (d && !d.error) setSettings(d); }
      if (rRes.ok) { const d = await rRes.json(); if (d && !d.error) setRiepilogo(d); }
      if (tRes.ok) { const d = await tRes.json(); if (Array.isArray(d)) setTrend(d); }
      if (eRes.ok) { const d = await eRes.json(); if (Array.isArray(d)) setEntrate(d); }
      if (uRes.ok) { const d = await uRes.json(); if (Array.isArray(d)) setUscite(d); }
      if (pRes.ok) { const d = await pRes.json(); if (Array.isArray(d)) setPareggi(d); }
      if (clRes.ok) { const d = await clRes.json(); const arr = Array.isArray(d) ? d : (d?.clients ?? []); setClients(arr.map((c: any) => ({ id: c.id, name: c.name }))); }
    } catch (e) { console.error("fetchAll", e); }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Returns null on success, error string on failure
  const saveSettings = async (s: ContabilitaSettings): Promise<string | null> => {
    try {
      const res = await api.put("/api/contabilita/settings", s);
      const data = await res.json();
      if (!res.ok) return data?.error ?? "Errore salvataggio";
      setSettings(s); setShowSettings(false); fetchAll();
      return null;
    } catch (e) { return String(e); }
  };

  const saveEntrata = async (data: Omit<Entrata, "id">): Promise<string | null> => {
    try {
      const res = editEntrata
        ? await api.patch(`/api/contabilita/entrate/${editEntrata.id}`, data)
        : await api.post("/api/contabilita/entrate", data);
      const body = await res.json();
      if (!res.ok) return body?.error ?? `Errore ${res.status}`;
      setAddEntrata(false); setEditEntrata(null); fetchAll();
      return null;
    } catch (e) { return String(e); }
  };

  const deleteEntrata = async (id: string) => {
    if (!confirm("Eliminare questa entrata?")) return;
    await api.delete(`/api/contabilita/entrate/${id}`);
    fetchAll();
  };

  const saveUscita = async (data: Omit<Uscita, "id">): Promise<string | null> => {
    try {
      const res = editUscita
        ? await api.patch(`/api/contabilita/uscite/${editUscita.id}`, data)
        : await api.post("/api/contabilita/uscite", data);
      const body = await res.json();
      if (!res.ok) return body?.error ?? `Errore ${res.status}`;
      setAddUscita(false); setEditUscita(null); fetchAll();
      return null;
    } catch (e) { return String(e); }
  };

  const deleteUscita = async (id: string) => {
    if (!confirm("Eliminare questa uscita?")) return;
    await api.delete(`/api/contabilita/uscite/${id}`);
    fetchAll();
  };

  const savePareggio = async (data: Omit<Pareggio, "id" | "data"> & { data?: string }): Promise<string | null> => {
    try {
      const res = await api.post("/api/contabilita/pareggi", data);
      const body = await res.json();
      if (!res.ok) return body?.error ?? `Errore ${res.status}`;
      setShowPareggio(false); fetchAll();
      return null;
    } catch (e) { return String(e); }
  };

  const deletePareggio = async (id: string) => {
    if (!confirm("Eliminare questo pareggio?")) return;
    await api.delete(`/api/contabilita/pareggi/${id}`);
    fetchAll();
  };

  const benefLabel = (b: string) => b === "socio_a" ? settings.socioAName.split(" ")[0] : b === "socio_b" ? settings.socioBName.split(" ")[0] : "50/50";
  const pagatoLabel = (p: string) => p === "socio_a" ? settings.socioAName.split(" ")[0] : p === "socio_b" ? settings.socioBName.split(" ")[0] : "Studio";
  const saldoColor = (n: number) => n >= 0 ? "text-[#4CAF50]" : "text-[#ef4444]";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f5f5f5] tracking-tight">Contabilità</h1>
            <p className="text-sm text-[#666] mt-0.5">{settings.socioAName} & {settings.socioBName} · Regime forfettario</p>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] transition-colors">
            <Settings size={16} />
          </button>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={prevMonth} className="p-2 rounded-xl border border-[rgba(255,255,255,0.06)] text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"><ChevronLeft size={16} /></button>
          <div className="text-base font-semibold text-[#f5f5f5] min-w-[160px] text-center">{monthNames[month - 1]} {year}</div>
          <button onClick={nextMonth} className="p-2 rounded-xl border border-[rgba(255,255,255,0.06)] text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"><ChevronRight size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#111] rounded-2xl mb-6 w-fit">
          {(["dashboard", "entrate", "uscite"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-[#F5A623] text-black" : "text-[#666] hover:text-[#f5f5f5]"}`}>
              {t === "dashboard" ? "Riepilogo" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-16 text-[#555]">Caricamento...</div>}

        {/* ── DASHBOARD ── */}
        {!loading && tab === "dashboard" && riepilogo && (
          <div className="space-y-5">
            <CompensazioneBanner comp={riepilogo.compensazione} settings={settings} onPareggia={() => setShowPareggio(true)} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Entrate Totali" value={fmt(riepilogo.entrate.totale)} color="bg-[#4CAF50]/20 text-[#4CAF50]" icon={TrendingUp} />
              <StatCard label="Uscite Totali" value={fmt(riepilogo.uscite.totale)} color="bg-[#ef4444]/20 text-[#ef4444]" icon={TrendingDown} />
              <StatCard label="Accantonamento" value={fmt(riepilogo.accantonamento.totale)} sub={`${settings.forfettarioBase}%×${settings.accAntonamentoRate}% su fatturato`} color="bg-[#F5A623]/20 text-[#F5A623]" icon={PiggyBank} />
              {riepilogo.speseOperatore?.totale > 0 && (
                <StatCard label="Spese Operatore" value={fmt(riepilogo.speseOperatore.totale)} sub="Collaboratori" color="bg-[#ef4444]/20 text-[#ef4444]" icon={TrendingDown} />
              )}
              <StatCard label="Netto Studio" value={fmt(riepilogo.netto.studio)} color="bg-[#8b5cf6]/20 text-[#8b5cf6]" icon={Wallet} />
            </div>

            {/* Soci breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { nome: settings.socioAName, label: "Socio A", saldo: riepilogo.saldo.socioA, netto: riepilogo.netto.socioA, acc: riepilogo.accantonamento.socioA, uscite: riepilogo.uscite.socioA, entrate: riepilogo.entrate.socioA + riepilogo.entrate.studio / 2 },
                { nome: settings.socioBName, label: "Socio B", saldo: riepilogo.saldo.socioB, netto: riepilogo.netto.socioB, acc: riepilogo.accantonamento.socioB, uscite: riepilogo.uscite.socioB, entrate: riepilogo.entrate.socioB + riepilogo.entrate.studio / 2 },
              ].map((s, i) => (
                <div key={i} className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div><div className="text-xs text-[#666] uppercase tracking-wide mb-1">{s.label}</div><div className="text-base font-semibold text-[#f5f5f5]">{s.nome}</div></div>
                    <div className={`text-xl font-bold ${saldoColor(s.saldo)}`}>{fmt(s.saldo)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-[#555]">Entrate lorde</span><span className="text-[#f5f5f5]">{fmt(s.entrate)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#555]">Accantonamento tasse</span><span className="text-[#F5A623]">−{fmt(s.acc)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#555]">Netto dopo accantonamento</span><span className="text-[#4CAF50]">{fmt(s.netto)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#555]">Uscite</span><span className="text-[#ef4444]">−{fmt(s.uscite)}</span></div>
                    <div className="border-t border-[rgba(255,255,255,0.05)] pt-2 flex justify-between text-sm font-semibold">
                      <span className="text-[#888]">Saldo disponibile</span>
                      <span className={saldoColor(s.saldo)}>{fmt(s.saldo)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grafico trend */}
            {trend.length > 0 && (
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-[#f5f5f5]">Andamento ultimi 6 mesi</h3>
                  <div className="flex items-center gap-5 text-xs text-[#555]">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#4CAF50] inline-block rounded" /> Entrate</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#ef4444] inline-block rounded" /> Uscite</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#F5A623] inline-block rounded border-dashed" style={{ borderBottom: "2px dashed #F5A623", height: 0, marginTop: 4 }} /> Accantonamento</span>
                  </div>
                </div>
                <TrendChart data={trend} />
              </div>
            )}

            {/* Composizione entrate/uscite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Composizione entrate</h3>
                <DonutChart
                  socioA={riepilogo.entrate.socioA}
                  socioB={riepilogo.entrate.socioB}
                  studio={riepilogo.entrate.studio}
                  labelA={settings.socioAName.split(" ")[0]}
                  labelB={settings.socioBName.split(" ")[0]}
                />
              </div>
              <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Composizione uscite</h3>
                <DonutChart
                  socioA={riepilogo.uscite.socioA}
                  socioB={riepilogo.uscite.socioB}
                  studio={riepilogo.uscite.studio}
                  labelA={settings.socioAName.split(" ")[0]}
                  labelB={settings.socioBName.split(" ")[0]}
                />
              </div>
            </div>

            {/* Spese condivise */}
            <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-[#f5f5f5] mb-3">Spese condivise del periodo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-xs text-[#555] mb-1">Totale spese condivise</div><div className="text-lg font-bold text-[#f5f5f5]">{fmt(riepilogo.uscite.condivise)}</div></div>
                <div><div className="text-xs text-[#555] mb-1">Quota per socio</div><div className="text-lg font-bold text-[#f5f5f5]">{fmt(riepilogo.uscite.condivise / 2)}</div></div>
              </div>
            </div>

            {/* Storico pareggi */}
            <StoricoPareggi pareggi={pareggi} settings={settings} onDelete={deletePareggio} />
          </div>
        )}

        {/* ── ENTRATE ── */}
        {!loading && tab === "entrate" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-[#555]">{entrate.length} voci · <span className="text-[#4CAF50] font-semibold">{fmt(entrate.reduce((s, e) => s + e.importo, 0))}</span></div>
              <button onClick={() => setAddEntrata(true)} className={btnPrimary}><Plus size={15} /> Nuova entrata</button>
            </div>
            {entrate.length === 0 ? (
              <div className="text-center py-16 text-[#444]">Nessuna entrata in {monthNames[month - 1]} {year}</div>
            ) : (
              <div className="space-y-2">
                {entrate.map(e => {
                  const accForf = e.fattura ? e.importo * (settings.forfettarioBase / 100) * (settings.accAntonamentoRate / 100) : 0;
                  const speseOp = e.speseOperatore ?? 0;
                  const accontoRic = e.acconto ?? 0;
                  const saldoRic = e.saldoRicevuto ?? 0;
                  const ricevuto = accontoRic + saldoRic;
                  const residuo = e.importo - ricevuto;
                  const saldato = residuo <= 0.01 && ricevuto > 0;
                  return (
                    <div key={e.id} className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex items-center gap-4">
                      <div className={`w-2 self-stretch rounded-full flex-shrink-0 ${saldato ? "bg-[#4CAF50]" : residuo < e.importo && ricevuto > 0 ? "bg-[#F5A623]" : e.fattura ? "bg-[#F5A623]" : "bg-[#4CAF50]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-[#f5f5f5] truncate">{e.descrizione}</span>
                          {e.clientName && <span className="text-[10px] bg-[#1a2a1a] text-[#4CAF50] px-1.5 py-0.5 rounded-md font-medium truncate max-w-[120px]">{e.clientName}</span>}
                          {e.fattura && <span className="text-[10px] bg-[#F5A623]/20 text-[#F5A623] px-1.5 py-0.5 rounded-md font-medium">FATTURA</span>}
                          <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{e.categoria}</span>
                          <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{benefLabel(e.beneficiario)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#555] flex-wrap">
                          <span>{new Date(e.data).toLocaleDateString("it-IT")}</span>
                          {accontoRic > 0 && <span className="text-[#888]">Acc. <span className="text-[#f5f5f5]">{fmt(accontoRic)}</span></span>}
                          {saldoRic > 0 && <span className="text-[#888]">Saldo <span className="text-[#f5f5f5]">{fmt(saldoRic)}</span></span>}
                          {saldato
                            ? <span className="text-[#4CAF50] font-semibold">Saldato ✓</span>
                            : residuo > 0.01 && ricevuto > 0
                              ? <span className="text-[#F5A623]">Da incassare {fmt(residuo)}</span>
                              : null}
                          {speseOp > 0 && <span className="text-[#888]">Op. <span className="text-[#ef4444]">−{fmt(speseOp)}</span></span>}
                          {(accForf > 0 || speseOp > 0) && <span className="text-[#888]">Netto <span className="text-[#4CAF50]">{fmt(e.importo - accForf - speseOp)}</span></span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold text-[#f5f5f5]">{fmt(e.importo)}</div>
                        {ricevuto > 0 && ricevuto < e.importo && <div className="text-xs text-[#666]">{fmt(ricevuto)} ric.</div>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditEntrata(e)} className="p-2 rounded-lg text-[#555] hover:text-[#F5A623] hover:bg-[#1a1a1a] transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => deleteEntrata(e.id)} className="p-2 rounded-lg text-[#555] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── USCITE ── */}
        {!loading && tab === "uscite" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-[#555]">{uscite.length} voci · <span className="text-[#ef4444] font-semibold">{fmt(uscite.reduce((s, u) => s + u.importo, 0))}</span></div>
              <button onClick={() => setAddUscita(true)} className={btnPrimary}><Plus size={15} /> Nuova uscita</button>
            </div>
            {uscite.length === 0 ? (
              <div className="text-center py-16 text-[#444]">Nessuna uscita in {monthNames[month - 1]} {year}</div>
            ) : (
              <div className="space-y-2">
                {uscite.map(u => (
                  <div key={u.id} className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full flex-shrink-0 ${u.divisiPerMeta ? "bg-[#F5A623]" : "bg-[#ef4444]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-[#f5f5f5] truncate">{u.descrizione}</span>
                        {u.divisiPerMeta && <span className="text-[10px] bg-[#F5A623]/20 text-[#F5A623] px-1.5 py-0.5 rounded-md font-medium">÷2</span>}
                        <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">{u.categoria}</span>
                        <span className="text-[10px] bg-[#222] text-[#888] px-1.5 py-0.5 rounded-md">Pag. {pagatoLabel(u.pagatoDa)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#555]">
                        <span>{new Date(u.data).toLocaleDateString("it-IT")}</span>
                        {u.divisiPerMeta && <span className="text-[#F5A623]">Quota/socio: {fmt(u.importo / 2)}</span>}
                      </div>
                    </div>
                    <div className="text-base font-bold text-[#f5f5f5] flex-shrink-0">{fmt(u.importo)}</div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditUscita(u)} className="p-2 rounded-lg text-[#555] hover:text-[#F5A623] hover:bg-[#1a1a1a] transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => deleteUscita(u.id)} className="p-2 rounded-lg text-[#555] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors"><Trash2 size={14} /></button>
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
          <EntrataForm initial={editEntrata ?? undefined} settings={settings} clients={clients} onSave={saveEntrata} onClose={() => { setAddEntrata(false); setEditEntrata(null); }} />
        </Modal>
      )}

      {(addUscita || editUscita) && (
        <Modal title={editUscita ? "Modifica uscita" : "Nuova uscita"} onClose={() => { setAddUscita(false); setEditUscita(null); }}>
          <UscitaForm initial={editUscita ?? undefined} settings={settings} onSave={saveUscita} onClose={() => { setAddUscita(false); setEditUscita(null); }} />
        </Modal>
      )}

      {showPareggio && riepilogo && (
        <FormPareggio
          settings={settings}
          comp={riepilogo.compensazione}
          entrate={entrate}
          onSave={savePareggio}
          onClose={() => setShowPareggio(false)}
        />
      )}
    </DashboardLayout>
  );
}
