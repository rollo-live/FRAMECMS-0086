import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge, Avatar } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import { Plus, Search, Phone, Mail, Building2, Users, Copy, Check, Pencil, Trash2, MapPin, FileText, X } from "lucide-react";

const inputCls = "w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors";
const labelCls = "block text-xs font-medium text-[#888] mb-1.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

const EMPTY_FORM = {
  name: "", email: "", phone: "", company: "", type: "client", notes: "",
  codiceSdi: "", partitaIva: "", codiceFiscale: "", codiceCliente: "",
  pec: "", indirizzo: "", cap: "", comune: "", provincia: "",
};

function ClientForm({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial?: any;
  onSave: (data: typeof EMPTY_FORM) => void;
  onClose: () => void;
  loading: boolean;
  error?: string | null;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    company: initial?.company ?? "",
    type: initial?.type ?? "client",
    notes: initial?.notes ?? "",
    codiceSdi: initial?.codiceSdi ?? "",
    partitaIva: initial?.partitaIva ?? "",
    codiceFiscale: initial?.codiceFiscale ?? "",
    codiceCliente: initial?.codiceCliente ?? "",
    pec: initial?.pec ?? "",
    indirizzo: initial?.indirizzo ?? "",
    cap: initial?.cap ?? "",
    comune: initial?.comune ?? "",
    provincia: initial?.provincia ?? "",
  });
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }));
  const [tab, setTab] = useState<"base" | "fattura" | "indirizzo">("base");

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-4">
      {error && (
        <div className="bg-[#2a0a0a] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 text-sm text-[#ef4444]">{error}</div>
      )}

      {/* Tab switcher */}
      <div className="flex bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 gap-0.5">
        {([["base", "Dati base"], ["fattura", "Fatturazione"], ["indirizzo", "Indirizzo"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === v ? "bg-[#1a1a1a] text-[#f5f5f5]" : "text-[#555] hover:text-[#888]"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "base" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Mario Rossi" required />
            </Field>
            <Field label="Tipo">
              <select className={inputCls} value={form.type} onChange={e => set("type", e.target.value)}>
                <option value="client">Cliente</option>
                <option value="lead">Lead</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input className={inputCls} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="mario@email.it" />
            </Field>
            <Field label="Telefono">
              <input className={inputCls} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+39 333 000 0000" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Azienda / Ragione sociale">
              <input className={inputCls} value={form.company} onChange={e => set("company", e.target.value)} placeholder="Nome azienda" />
            </Field>
            <Field label="Codice cliente interno">
              <input className={inputCls} value={form.codiceCliente} onChange={e => set("codiceCliente", e.target.value)} placeholder="Es. CLI-001" />
            </Field>
          </div>
          <Field label="Note">
            <textarea className={inputCls + " resize-none"} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Appunti interni..." />
          </Field>
        </div>
      )}

      {tab === "fattura" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Partita IVA">
              <input className={inputCls} value={form.partitaIva} onChange={e => set("partitaIva", e.target.value)} placeholder="IT00000000000" />
            </Field>
            <Field label="Codice fiscale">
              <input className={inputCls} value={form.codiceFiscale} onChange={e => set("codiceFiscale", e.target.value)} placeholder="RSSMRA80A01H501U" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Codice destinatario SDI">
              <input className={inputCls} value={form.codiceSdi} onChange={e => set("codiceSdi", e.target.value)} placeholder="Per fatturazione elettronica" />
            </Field>
            <Field label="Indirizzo PEC">
              <input className={inputCls} type="email" value={form.pec} onChange={e => set("pec", e.target.value)} placeholder="pec@esempio.it" />
            </Field>
          </div>
        </div>
      )}

      {tab === "indirizzo" && (
        <div className="space-y-3">
          <Field label="Indirizzo">
            <input className={inputCls} value={form.indirizzo} onChange={e => set("indirizzo", e.target.value)} placeholder="Via Roma 1" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="CAP">
              <input className={inputCls} value={form.cap} onChange={e => set("cap", e.target.value)} placeholder="00100" />
            </Field>
            <Field label="Comune">
              <input className={inputCls} value={form.comune} onChange={e => set("comune", e.target.value)} placeholder="Roma" />
            </Field>
            <Field label="Provincia">
              <input className={inputCls} value={form.provincia} onChange={e => set("provincia", e.target.value)} placeholder="RM" maxLength={2} />
            </Field>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2 text-sm font-medium bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#888] hover:text-[#f5f5f5] transition-colors">
          Annulla
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 text-sm font-semibold bg-[#F5A623] text-black rounded-xl hover:bg-[#e09515] transition-colors disabled:opacity-50">
          {loading ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </form>
  );
}

export default function ClientiPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "client" | "lead">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [tokenCopied, setTokenCopied] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/api/clients")).json(),
  });
  const clients: any[] = (data as any)?.clients ?? [];

  const createMutation = useMutation({
    mutationFn: async (form: typeof EMPTY_FORM) => {
      const r = await api.post("/api/clients", form);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Errore creazione");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowCreate(false);
      setCreateError(null);
    },
    onError: (e: any) => setCreateError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof EMPTY_FORM }) => {
      const r = await api.put(`/api/clients/${id}`, form);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Errore aggiornamento");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditClient(null);
      setEditError(null);
    },
    onError: (e: any) => setEditError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/clients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  const generateToken = useMutation({
    mutationFn: async (clientId: string) => {
      const r = await api.post(`/api/clients/${clientId}/token`, { label: "Portale cliente" });
      return r.json();
    },
    onSuccess: (data: any) => {
      navigator.clipboard.writeText(data.portalUrl);
      setTokenCopied(data.token?.clientId);
      setTimeout(() => setTokenCopied(null), 3000);
    },
  });

  const filtered = clients.filter(c =>
    (typeFilter === "all" || c.type === typeFilter) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Clienti & Lead"
          subtitle={`${clients.filter(c => c.type === "client").length} clienti · ${clients.filter(c => c.type === "lead").length} lead`}
          actions={<Button icon={<Plus size={15} />} onClick={() => { setShowCreate(true); setCreateError(null); }}>Nuovo</Button>}
        />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome, email, azienda..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#555] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
            />
          </div>
          <div className="flex bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl p-1 gap-0.5">
            {[["all", "Tutti"], ["client", "Clienti"], ["lead", "Lead"]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${typeFilter === v ? "bg-[#1a1a1a] text-[#f5f5f5]" : "text-[#555] hover:text-[#a0a0a0]"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555]">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Nessun cliente trovato</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {filtered.map((client: any) => (
              <Card key={client.id} className="flex flex-col gap-0">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={client.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#f5f5f5] truncate">{client.name}</p>
                    {client.company && <p className="text-xs text-[#555] flex items-center gap-1 mt-0.5"><Building2 size={11} />{client.company}</p>}
                  </div>
                  <Badge variant={client.type === "lead" ? "warning" : "accent"}>
                    {client.type === "lead" ? "Lead" : "Cliente"}
                  </Badge>
                </div>
                <div className="space-y-1.5 mb-3">
                  {client.email && <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5"><Mail size={11} />{client.email}</p>}
                  {client.phone && <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5"><Phone size={11} />{client.phone}</p>}
                  {(client.comune || client.indirizzo) && (
                    <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
                      <MapPin size={11} />
                      {[client.comune, client.provincia].filter(Boolean).join(" ") || client.indirizzo}
                    </p>
                  )}
                  {client.partitaIva && (
                    <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5"><FileText size={11} />P.IVA {client.partitaIva}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-auto pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <button
                    onClick={() => generateToken.mutate(client.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#888] hover:text-[#f5f5f5] transition-colors"
                  >
                    {tokenCopied === client.id ? <><Check size={12} /> Copiato!</> : <><Copy size={12} /> Link portale</>}
                  </button>
                  <button
                    onClick={() => { setEditClient(client); setEditError(null); }}
                    className="p-1.5 rounded-lg text-[#555] hover:text-[#F5A623] hover:bg-[#1a1a1a] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Eliminare ${client.name}?`)) deleteMutation.mutate(client.id); }}
                    className="p-1.5 rounded-lg text-[#555] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create modal */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuovo cliente / lead" size="md">
          <ClientForm
            onSave={(form) => createMutation.mutate(form)}
            onClose={() => setShowCreate(false)}
            loading={createMutation.isPending}
            error={createError}
          />
        </Modal>

        {/* Edit modal */}
        <Modal open={!!editClient} onClose={() => setEditClient(null)} title={`Modifica — ${editClient?.name ?? ""}`} size="md">
          {editClient && (
            <ClientForm
              initial={editClient}
              onSave={(form) => updateMutation.mutate({ id: editClient.id, form })}
              onClose={() => setEditClient(null)}
              loading={updateMutation.isPending}
              error={editError}
            />
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
