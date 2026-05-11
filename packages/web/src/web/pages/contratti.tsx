import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Plus, FileText, Copy, Check, ExternalLink } from "lucide-react";

const CONTRACT_TEMPLATE = `CONTRATTO DI SERVIZIO FOTOGRAFICO/VIDEO

Tra [NOME STUDIO] (di seguito "Professionista") e il Cliente sottoscritto, si conviene quanto segue:

1. OGGETTO DEL CONTRATTO
Il Professionista si impegna a fornire i servizi descritti nel preventivo allegato.

2. TERMINI DI PAGAMENTO
Il pagamento dovrà essere effettuato nei termini indicati nel preventivo.

3. DIRITTI D'AUTORE
Tutte le immagini e i video prodotti rimangono di proprietà del Professionista fino al saldo completo del compenso.

4. CONSEGNA
I file saranno consegnati entro i termini concordati a mezzo portale digitale.

5. CANCELLAZIONE
In caso di cancellazione con meno di 48 ore di preavviso, il 50% dell'acconto non sarà rimborsabile.

Firmando digitalmente, il Cliente accetta integralmente i termini sopra riportati.`;

export default function ContrattiPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ clientId: "", quoteId: "", title: "", content: CONTRACT_TEMPLATE });

  const { data: contractsData, isLoading } = useQuery({ queryKey: ["contracts"], queryFn: async () => (await api.get("/api/contracts")).json() });
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get("/api/clients")).json() });
  const { data: quotesData } = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get("/api/quotes")).json() });

  const contracts: any[] = (contractsData as any)?.contracts ?? [];
  const clients: any[] = (clientsData as any)?.clients ?? [];
  const quotes: any[] = (quotesData as any)?.quotes ?? [];

  const createMutation = useMutation({
    mutationFn: async () => { const r = await api.post("/api/contracts", form); return r.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); setShowModal(false); },
  });

  const copySignLink = (contract: any) => {
    const url = `${window.location.origin}/firma/${contract.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(contract.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const statusColor: Record<string, any> = { draft: "default", sent: "warning", signed: "success", cancelled: "danger" };
  const statusLabel: Record<string, string> = { draft: "Bozza", sent: "Inviato", signed: "Firmato", cancelled: "Annullato" };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Contratti"
          subtitle={`${contracts.filter(c => c.status === "signed").length} firmati · ${contracts.filter(c => c.status === "sent").length} in attesa`}
          actions={<Button icon={<Plus size={15} />} onClick={() => setShowModal(true)}>Nuovo contratto</Button>}
        />

        {isLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />)}</div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555]">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Nessun contratto ancora</p>
          </div>
        ) : (
          <div className="space-y-2 stagger">
            {contracts.map((c: any) => {
              const client = clients.find(cl => cl.id === c.clientId);
              return (
                <Card key={c.id}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.1)] flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-[#22c55e]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#f5f5f5] truncate">{c.title}</p>
                      <p className="text-xs text-[#a0a0a0] mt-0.5">{client?.name ?? "—"}</p>
                      {c.signedAt && (
                        <p className="text-xs text-[#22c55e] mt-0.5">
                          Firmato il {new Date(c.signedAt).toLocaleDateString("it-IT")} · IP: {c.signerIp}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusColor[c.status]}>{statusLabel[c.status]}</Badge>
                    {c.shareToken && c.status !== "signed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={copiedId === c.id ? <Check size={12} /> : <Copy size={12} />}
                        onClick={() => copySignLink(c)}
                      >
                        {copiedId === c.id ? "Copiato!" : "Copia link firma"}
                      </Button>
                    )}
                    {c.shareToken && (
                      <a
                        href={`/firma/${c.shareToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-[#555] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuovo contratto" size="xl">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Cliente *" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required>
                <option value="">Seleziona cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Preventivo collegato" value={form.quoteId} onChange={e => setForm(f => ({ ...f, quoteId: e.target.value }))}>
                <option value="">Nessuno</option>
                {quotes.map(q => <option key={q.id} value={q.id}>{q.title} — €{q.total.toFixed(2)}</option>)}
              </Select>
            </div>
            <Input label="Titolo *" placeholder="es. Contratto Matrimonio Rossi 2024" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <Textarea label="Testo contratto" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={10} />
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>Crea e genera link firma</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
