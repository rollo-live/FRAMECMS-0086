import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Plus, Trash2, Receipt, Euro, Pencil, FileDown } from "lucide-react";

interface LineItem { desc: string; qty: number; price: number; }

type FormState = {
  clientId: string;
  title: string;
  introText: string;
  closingText: string;
  notes: string;
  taxRate: number;
  validUntil: string;
};

const EMPTY_FORM: FormState = {
  clientId: "",
  title: "",
  introText: "",
  closingText: "",
  notes: "",
  taxRate: 22,
  validUntil: "",
};

const statusColor: Record<string, any> = {
  draft: "default",
  sent: "warning",
  accepted: "success",
  rejected: "danger",
};
const statusLabel: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
};

function QuoteForm({
  form,
  setForm,
  items,
  setItems,
  clients,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
  quoteId,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  clients: any[];
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  submitLabel: string;
  quoteId?: string;
}) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = subtotal * form.taxRate / 100;
  const total = subtotal + tax;

  const addItem = () => setItems(i => [...i, { desc: "", qty: 1, price: 0 }]);
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const updateItem = (idx: number, key: keyof LineItem, val: string | number) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item));

  const downloadPdf = async () => {
    if (!quoteId) return;
    const res = await api.get(`/api/quotes/${quoteId}/pdf`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preventivo-${quoteId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Cliente *"
          value={form.clientId}
          onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
          required
        >
          <option value="">Seleziona cliente</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input
          label="Titolo *"
          placeholder="es. Servizio fotografico matrimonio"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          required
        />
      </div>

      <Input
        label="Valido fino al"
        type="date"
        value={form.validUntil}
        onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
      />

      <Textarea
        label="Testo introduttivo"
        placeholder="Gentile cliente, siamo lieti di proporle il seguente preventivo..."
        value={form.introText}
        onChange={e => setForm(f => ({ ...f, introText: e.target.value }))}
        rows={3}
      />

      {/* Line items */}
      <div>
        <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide block mb-2">Voci</label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={item.desc}
                onChange={e => updateItem(idx, "desc", e.target.value)}
                placeholder="Descrizione voce"
                className="flex-1 px-3 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#555] outline-none focus:border-[rgba(245,166,35,0.5)]"
              />
              <input
                type="number"
                value={item.qty}
                onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                min={1}
                className="w-16 px-2 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] text-center"
              />
              <div className="relative w-28">
                <Euro size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
                <input
                  type="number"
                  value={item.price}
                  onChange={e => updateItem(idx, "price", Number(e.target.value))}
                  min={0}
                  step={0.01}
                  className="w-full pl-7 pr-2 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)]"
                />
              </div>
              <div className="w-20 flex items-center justify-end text-sm font-medium text-[#F5A623]">
                €{(item.qty * item.price).toFixed(2)}
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-[#555] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Plus size={13} />}
          onClick={addItem}
          className="mt-2"
        >
          Aggiungi voce
        </Button>
      </div>

      {/* Totals */}
      <div className="bg-[#0a0a0a] rounded-xl p-3 border border-[rgba(255,255,255,0.06)] space-y-1.5">
        <div className="flex justify-between text-sm text-[#a0a0a0]">
          <span>Imponibile</span><span>€{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-[#a0a0a0] items-center gap-2">
          <span>IVA</span>
          <div className="flex items-center gap-2">
            <select
              value={form.taxRate}
              onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))}
              className="px-2 py-1 text-xs bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#f5f5f5] outline-none"
            >
              <option value={0}>0%</option>
              <option value={4}>4%</option>
              <option value={10}>10%</option>
              <option value={22}>22%</option>
            </select>
            <span>€{tax.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex justify-between text-sm font-semibold text-[#F5A623] pt-1 border-t border-[rgba(255,255,255,0.06)]">
          <span>Totale</span><span>€{total.toFixed(2)}</span>
        </div>
      </div>

      <Textarea
        label="Testo di chiusura"
        placeholder="Rimaniamo a disposizione per qualsiasi chiarimento..."
        value={form.closingText}
        onChange={e => setForm(f => ({ ...f, closingText: e.target.value }))}
        rows={3}
      />

      <Textarea
        label="Note interne"
        placeholder="Condizioni di pagamento, note aggiuntive..."
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        rows={2}
      />

      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel} type="button">Annulla</Button>
        {quoteId && (
          <Button
            type="button"
            variant="ghost"
            icon={<FileDown size={14} />}
            onClick={downloadPdf}
          >
            PDF
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={isLoading}>{submitLabel}</Button>
      </div>
    </form>
  );
}

export default function PreventiviPage() {
  const qc = useQueryClient();

  // CREATE modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [createItems, setCreateItems] = useState<LineItem[]>([{ desc: "", qty: 1, price: 0 }]);

  // EDIT modal
  const [editQuote, setEditQuote] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editItems, setEditItems] = useState<LineItem[]>([]);

  const { data: quotesData, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => (await api.get("/api/quotes")).json(),
  });
  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/api/clients")).json(),
  });

  const quotes: any[] = (quotesData as any)?.quotes ?? [];
  const clients: any[] = (clientsData as any)?.clients ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post("/api/quotes", {
        ...createForm,
        items: createItems,
        taxRate: Number(createForm.taxRate),
        validUntil: createForm.validUntil ? new Date(createForm.validUntil).toISOString() : null,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      setCreateItems([{ desc: "", qty: 1, price: 0 }]);
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editQuote) return;
      const r = await api.put(`/api/quotes/${editQuote.id}`, {
        ...editForm,
        items: editItems,
        taxRate: Number(editForm.taxRate),
        validUntil: editForm.validUntil ? new Date(editForm.validUntil).toISOString() : null,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setEditQuote(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await api.put(`/api/quotes/${id}`, { status });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const openEdit = (q: any) => {
    setEditQuote(q);
    const rawItems: any[] = (() => {
      try { return typeof q.items === "string" ? JSON.parse(q.items) : q.items ?? []; }
      catch { return []; }
    })();
    setEditItems(rawItems.length ? rawItems.map((i: any) => ({ desc: i.desc ?? i.description ?? "", qty: Number(i.qty), price: Number(i.price) })) : [{ desc: "", qty: 1, price: 0 }]);
    setEditForm({
      clientId: q.clientId ?? "",
      title: q.title ?? "",
      introText: q.introText ?? "",
      closingText: q.closingText ?? "",
      notes: q.notes ?? "",
      taxRate: q.taxRate ?? 22,
      validUntil: q.validUntil ? new Date(q.validUntil).toISOString().split("T")[0] : "",
    });
  };

  const downloadPdf = async (q: any) => {
    const res = await api.get(`/api/quotes/${q.id}/pdf`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${q.number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Preventivi"
          subtitle={`${quotes.length} preventivi totali`}
          actions={
            <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
              Nuovo preventivo
            </Button>
          }
        />

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555]">
            <Receipt size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Nessun preventivo ancora</p>
          </div>
        ) : (
          <div className="space-y-2 stagger">
            {quotes.map((q: any) => {
              const client = clients.find(c => c.id === q.clientId);
              return (
                <Card key={q.id}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(245,166,35,0.1)] flex items-center justify-center shrink-0">
                      <Receipt size={16} className="text-[#F5A623]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#f5f5f5] truncate">{q.title}</p>
                        <span className="text-xs text-[#555]">{q.number}</span>
                      </div>
                      <p className="text-xs text-[#a0a0a0] mt-0.5">{client?.name ?? "—"}</p>
                      {q.validUntil && (
                        <p className="text-xs text-[#666] mt-0.5">
                          Valido fino al {new Date(q.validUntil).toLocaleDateString("it-IT")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-semibold text-[#F5A623]">€{q.total.toFixed(2)}</p>
                      <p className="text-xs text-[#555] mt-0.5">IVA {q.taxRate}%</p>
                    </div>
                    <Badge variant={statusColor[q.status]}>{statusLabel[q.status]}</Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title="Scarica PDF"
                        onClick={() => downloadPdf(q)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)] transition-all"
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        title="Modifica"
                        onClick={() => openEdit(q)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#f5f5f5] hover:bg-[rgba(255,255,255,0.06)] transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      {q.status === "draft" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: q.id, status: "sent" })}
                        >
                          Invia
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* CREATE MODAL */}
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Nuovo preventivo"
          size="xl"
        >
          <QuoteForm
            form={createForm}
            setForm={setCreateForm}
            items={createItems}
            setItems={setCreateItems}
            clients={clients}
            onSubmit={() => createMutation.mutate()}
            onCancel={() => setShowCreate(false)}
            isLoading={createMutation.isPending}
            submitLabel="Crea preventivo"
          />
        </Modal>

        {/* EDIT MODAL */}
        <Modal
          open={!!editQuote}
          onClose={() => setEditQuote(null)}
          title={`Modifica — ${editQuote?.number ?? ""}`}
          size="xl"
        >
          <QuoteForm
            form={editForm}
            setForm={setEditForm}
            items={editItems}
            setItems={setEditItems}
            clients={clients}
            onSubmit={() => editMutation.mutate()}
            onCancel={() => setEditQuote(null)}
            isLoading={editMutation.isPending}
            submitLabel="Salva modifiche"
            quoteId={editQuote?.id}
          />
        </Modal>
      </div>
    </DashboardLayout>
  );
}
