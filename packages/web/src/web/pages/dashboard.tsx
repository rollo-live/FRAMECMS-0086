import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/card";
import { Link } from "react-router-dom";
import { Users, FolderOpen, CheckSquare, TrendingUp, ArrowRight, Camera, Film } from "lucide-react";
import { authClient } from "../lib/auth";

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[rgba(245,166,35,0.1)] flex items-center justify-center shrink-0">
        <Icon size={18} className="text-[#F5A623]" />
      </div>
      <div>
        <p className="text-xs text-[#a0a0a0] font-medium">{label}</p>
        <p className="text-2xl font-semibold text-[#f5f5f5] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#555] mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get("/api/clients")).json() });
  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: async () => (await api.get("/api/projects")).json() });
  const { data: quotesData } = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get("/api/quotes")).json() });

  const clients = (clientsData as any)?.clients ?? [];
  const projects = (projectsData as any)?.projects ?? [];
  const quotes = (quotesData as any)?.quotes ?? [];

  const activeProjects = projects.filter((p: any) => p.status === "active" || p.status === "planning");
  const pendingQuotes = quotes.filter((q: any) => q.status === "draft" || q.status === "sent");

  const statusColor: Record<string, any> = {
    planning: "warning",
    active: "success",
    in_review: "accent",
    completed: "default",
    archived: "default",
  };
  const statusLabel: Record<string, string> = {
    planning: "Pianificazione",
    active: "Attivo",
    in_review: "In revisione",
    completed: "Completato",
    archived: "Archiviato",
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <PageHeader
          title={`Ciao, ${session?.user?.name?.split(" ")[0] ?? "..."} 👋`}
          subtitle="Ecco una panoramica del tuo studio"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
          <StatCard icon={Users} label="Clienti totali" value={clients.filter((c: any) => c.type === "client").length} />
          <StatCard icon={TrendingUp} label="Lead attivi" value={clients.filter((c: any) => c.type === "lead").length} />
          <StatCard icon={FolderOpen} label="Progetti attivi" value={activeProjects.length} />
          <StatCard icon={CheckSquare} label="Preventivi in attesa" value={pendingQuotes.length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progetti recenti */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#f5f5f5]">Progetti recenti</h2>
              <Link to="/progetti" className="text-xs text-[#F5A623] hover:underline flex items-center gap-1">
                  Vedi tutti <ArrowRight size={12} />
                </Link>
            </div>
            {projects.length === 0 ? (
              <div className="py-8 text-center text-[#555] text-sm">
                <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nessun progetto ancora</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 5).map((p: any) => (
                  <Link key={p.id} to={`/progetti/${p.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.type === "video" ? "bg-[rgba(139,92,246,0.15)]" : "bg-[rgba(245,166,35,0.1)]"}`}>
                      {p.type === "video" ? <Film size={14} className="text-purple-400" /> : <Camera size={14} className="text-[#F5A623]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">{p.name}</p>
                    </div>
                    <Badge variant={statusColor[p.status] ?? "default"}>{statusLabel[p.status] ?? p.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Preventivi recenti */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#f5f5f5]">Preventivi recenti</h2>
              <Link to="/preventivi" className="text-xs text-[#F5A623] hover:underline flex items-center gap-1">
                  Vedi tutti <ArrowRight size={12} />
                </Link>
            </div>
            {quotes.length === 0 ? (
              <div className="py-8 text-center text-[#555] text-sm">
                <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nessun preventivo ancora</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.slice(0, 5).map((q: any) => (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1a] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">{q.title}</p>
                      <p className="text-xs text-[#555] mt-0.5">{q.number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#F5A623]">€{q.total.toFixed(0)}</p>
                      <Badge variant={q.status === "accepted" ? "success" : q.status === "sent" ? "warning" : "default"}>
                        {q.status === "draft" ? "Bozza" : q.status === "sent" ? "Inviato" : q.status === "accepted" ? "Accettato" : "Rifiutato"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
