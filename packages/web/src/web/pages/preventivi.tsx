import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Plus, Trash2, Receipt, Euro } from "lucide-react";

interface LineItem { desc: string; qty: number; price: number; }

export default function PreventiviPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ desc: "", qty: 1, price: 0 }]);
  const [form, setForm] = useState({ clientId: "", title: "", notes: "", taxRate: 22 });

  const { data: quotesData, isLoading } = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get("/api/quotes")).json() });
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get("/api/clients")).json() });

  const quotes: any[] = (quotesData as any)?.quotes ?? [];
  const clients: any[] = (clientsData as any)?.clients ?? [];

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = subtotal * form.taxRate / 100;
  const total = subtotal + tax;

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post("/api/quotes", { ...form, items, taxRate: Number(form.taxRate) });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); setShowModal(false); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await api.patch(`/api/quotes/${id}`, { status });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const addItem = () => setItems(i => [...i, { desc: "", qty: 1, price: 0 }]);
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const updateItem = (idx: number, key: keyof LineItem, val: string | number) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item));

  const statusColor: Record<string, any> = { draft: "default", sent: "warning", accepted: "success", rejected: "danger" };
  const statusLabel: Record<string, string> = { draft: "Bozza", sent: "Inviato", accepted: "Accettato", rejected: "Rifiutato" };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Preventivi"
          subtitle={`${quotes.length} preventivi totali`}
          actions={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>Nuovo preventivo</Button>}
        />

        {isLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />)}</div>
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
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-semibold text-[#F5A623]">€{q.total.toFixed(2)}</p>
                      <p className="text-xs text-[#555] mt-0.5">IVA {q.taxRate}%</p>
                    </div>
                    <Badge variant={statusColor[q.status]}>{statusLabel[q.status]}</Badge>
                    {q.status === "draft" && (
                      <Button variant="secondary" size="sm" onClick={() => updateStatus.mutate({ id: q.id, status: "sent" })}>
                        Invia
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuovo preventivo" size="xl">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Cliente *" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required>
                <option value="">Seleziona cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Titolo *" placeholder="es. Servizio fotografico matrimonio" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            {/* Line items */}
            <div>
              <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide block mb-2">Voci</label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input value={item.desc} onChange={e => updateItem(idx, "desc", e.target.value)} placeholder="Descrizione voce" className="flex-1 px-3 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#555] outline-none focus:border-[rgba(245,166,35,0.5)]" />
                    <input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", Number(e.target.value))} min={1} className="w-16 px-2 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] text-center" />
                    <div className="relative w-28">
                      <Euro size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
                      <input type="number" value={item.price} onChange={e => updateItem(idx, "price", Number(e.target.value))} min={0} step={0.01} className="w-full pl-7 pr-2 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)]" />
                    </div>
                    <div className="w-20 flex items-center justify-end text-sm font-medium text-[#F5A623]">
                      €{(item.qty * item.price).toFixed(2)}
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-[#555] hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" icon={<Plus size={13} />} onClick={addItem} className="mt-2">
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
                  <select value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))}
                    className="px-2 py-1 text-xs bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#f5f5f5] outline-none">
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

            <Textarea label="Note" placeholder="Condizioni di pagamento, note aggiuntive..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>Crea preventivo</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
