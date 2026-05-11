import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge, Avatar } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Plus, Search, Phone, Mail, Building2, Users, TrendingUp, Copy, Check } from "lucide-react";

export default function ClientiPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "client" | "lead">("all");
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tokenCopied, setTokenCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", type: "client", notes: "" });

  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get("/api/clients")).json() });
  const clients: any[] = (data as any)?.clients ?? [];

  const createMutation = useMutation({
    mutationFn: async () => { const r = await api.post("/api/clients", form); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setShowModal(false); setForm({ name: "", email: "", phone: "", company: "", type: "client", notes: "" }); },
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
      <div className="p-8">
        <PageHeader
          title="Clienti & Lead"
          subtitle={`${clients.filter(c => c.type === "client").length} clienti · ${clients.filter(c => c.type === "lead").length} lead`}
          actions={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>Nuovo</Button>}
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
              <Card key={client.id} className="cursor-pointer" onClick={() => setSelected(client)}>
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
                <div className="space-y-1.5">
                  {client.email && <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5"><Mail size={11} />{client.email}</p>}
                  {client.phone && <p className="text-xs text-[#a0a0a0] flex items-center gap-1.5"><Phone size={11} />{client.phone}</p>}
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    icon={tokenCopied === client.id ? <Check size={12} /> : <Copy size={12} />}
                    loading={generateToken.isPending}
                    onClick={(e) => { e.stopPropagation(); generateToken.mutate(client.id); }}
                  >
                    {tokenCopied === client.id ? "Copiato!" : "Link portale"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create modal */}
        <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuovo cliente / lead" size="md">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nome *" placeholder="Mario Rossi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <Select label="Tipo" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="client">Cliente</option>
                <option value="lead">Lead</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" placeholder="mario@email.it" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Telefono" placeholder="+39 333 000 0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <Input label="Azienda" placeholder="Nome azienda" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            <Textarea label="Note" placeholder="Appunti interni..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>Salva</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
