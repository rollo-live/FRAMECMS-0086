import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Plus, FolderOpen, Camera, Film, Layers, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ProgettiPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", clientId: "", contractId: "", type: "photo", startDate: "", endDate: "", location: "" });

  const { data: projectsData, isLoading } = useQuery({ queryKey: ["projects"], queryFn: async () => (await api.get("/api/projects")).json() });
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get("/api/clients")).json() });
  const { data: contractsData } = useQuery({ queryKey: ["contracts"], queryFn: async () => (await api.get("/api/contracts")).json() });

  const projects: any[] = (projectsData as any)?.projects ?? [];
  const clients: any[] = (clientsData as any)?.clients ?? [];
  const contracts: any[] = (contractsData as any)?.contracts ?? [];

  const createMutation = useMutation({
    mutationFn: async () => { const r = await api.post("/api/projects", form); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setShowModal(false); },
  });

  const typeIcon = { photo: Camera, video: Film, photo_video: Layers };
  const typeColor = { photo: "rgba(245,166,35,0.1)", video: "rgba(139,92,246,0.15)", photo_video: "rgba(34,197,94,0.1)" };
  const typeIconColor = { photo: "text-[#F5A623]", video: "text-purple-400", photo_video: "text-green-400" };
  const statusColor: Record<string, any> = { planning: "warning", active: "success", in_review: "accent", completed: "default", archived: "default" };
  const statusLabel: Record<string, string> = { planning: "Pianificazione", active: "Attivo", in_review: "In revisione", completed: "Completato", archived: "Archiviato" };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Progetti"
          subtitle={`${projects.length} progetti totali`}
          actions={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>Nuovo progetto</Button>}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555]">
            <FolderOpen size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Nessun progetto ancora</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {projects.map((p: any) => {
              const Icon = typeIcon[p.type as keyof typeof typeIcon] ?? Camera;
              const client = clients.find(c => c.id === p.clientId);
              return (
                <Link key={p.id} to={`/progetti/${p.id}`}>
                  <Card className="cursor-pointer group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: typeColor[p.type as keyof typeof typeColor] }}>
                        <Icon size={18} className={typeIconColor[p.type as keyof typeof typeIconColor]} />
                      </div>
                      <Badge variant={statusColor[p.status]}>{statusLabel[p.status]}</Badge>
                    </div>
                    <h3 className="text-sm font-semibold text-[#f5f5f5] mb-1">{p.name}</h3>
                    {client && <p className="text-xs text-[#a0a0a0]">{client.name}</p>}
                    {p.location && <p className="text-xs text-[#555] mt-1">📍 {p.location}</p>}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                      {p.startDate && <p className="text-xs text-[#555]">{new Date(p.startDate).toLocaleDateString("it-IT")}</p>}
                      <ArrowRight size={14} className="text-[#555] group-hover:text-[#F5A623] ml-auto transition-colors" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuovo progetto" size="md">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <Input label="Nome progetto *" placeholder="es. Matrimonio Rossi — Luglio 2024" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Cliente" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Seleziona cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Tipo" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="photo">📷 Foto</option>
                <option value="video">🎬 Video</option>
                <option value="photo_video">📷🎬 Foto + Video</option>
              </Select>
            </div>
            <Select label="Contratto collegato" value={form.contractId} onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}>
              <option value="">Nessuno</option>
              {contracts.filter(c => c.status === "signed").map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Data inizio" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              <Input label="Data fine" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <Input label="Location" placeholder="es. Villa Crespi, Lago d'Orta" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            {form.contractId && (
              <div className="px-3 py-2.5 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] rounded-xl text-xs text-green-400">
                ✓ Task automatici creati: Shooting, Post-produzione, Consegna
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>Crea progetto</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
