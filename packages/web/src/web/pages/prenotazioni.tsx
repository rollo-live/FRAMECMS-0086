import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout, PageHeader } from "../components/layout/dashboard-layout";
import { Calendar, Clock, MapPin, Mail, Phone, Check, X, Trash2, ChevronDown, Loader2, RefreshCw, Copy, CheckCheck, Link2 } from "lucide-react";

const EVENT_TYPE_LABELS: Record<string, string> = {
  battesimo: "Battesimo",
  compleanno: "Compleanno",
  matrimonio: "Matrimonio",
  shooting_aziendale: "Shooting Aziendale",
  conferenza: "Conferenza",
  altro: "Altro",
};

const SERVICE_LABELS: Record<string, string> = {
  foto: "Fotografia",
  video: "Video",
  stampe_live: "Stampe Live",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "In attesa", color: "#F5A623", bg: "rgba(245,166,35,0.12)" },
  approved: { label: "Approvata", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  rejected: { label: "Rifiutata", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

interface Appointment {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  eventType: string;
  eventTypeCustom?: string | null;
  services: string[];
  eventDate: string;
  eventLocation?: string | null;
  notes?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  channelId?: string | null;
  channelName?: string | null;
  channelColor?: string | null;
}

interface BookingChannel {
  id: string;
  name: string;
  slug: string;
  color: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

export default function Prenotazioni() {
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [channels, setChannels] = useState<BookingChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [res, chRes] = await Promise.all([
      api.get("/api/bookings"),
      api.get("/api/booking-channels"),
    ]);
    if (res.ok) {
      const d = await res.json();
      setAppointments(d.appointments ?? []);
    }
    if (chRes.ok) {
      const d = await chRes.json();
      setChannels(d.channels ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Show toast from URL params (email link redirects)
    if (searchParams.get("approved")) showToast("Prenotazione approvata!");
    if (searchParams.get("rejected")) showToast("Prenotazione rifiutata", "err");
  }, [load]);

  const approve = async (id: string) => {
    setActing(id);
    const res = await api.post(`/api/bookings/${id}/approve`, {});
    if (res.ok) {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved" } : a));
      showToast("Prenotazione approvata! Email inviata al cliente.");
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as any).error ?? "Errore", "err");
    }
    setActing(null);
  };

  const reject = async (id: string) => {
    if (!confirm("Rifiutare questa prenotazione?")) return;
    setActing(id);
    const res = await api.post(`/api/bookings/${id}/reject`, {});
    if (res.ok) {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" } : a));
      showToast("Prenotazione rifiutata. Email inviata al cliente.", "err");
    }
    setActing(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare definitivamente questa prenotazione?")) return;
    setActing(id);
    const res = await api.delete(`/api/bookings/${id}`);
    if (res.ok) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      showToast("Prenotazione eliminata.");
    }
    setActing(null);
  };

  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const filtered = appointments.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (channelFilter === "none") return !a.channelId;
    if (channelFilter !== "all" && a.channelId !== channelFilter) return false;
    return true;
  });

  // Booking page public URL — need tenant slug
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  useEffect(() => {
    api.get("/api/tenants/me").then((r) => {
      if (r.ok) r.json().then((d: any) => setTenantSlug(d.tenant?.slug ?? null));
    });
  }, []);

  const bookingUrl = tenantSlug ? `${window.location.origin}/booking/${tenantSlug}` : null;

  const copyUrl = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto" }}>
        <PageHeader
          title="Prenotazioni"
          subtitle={pendingCount > 0 ? `${pendingCount} richiesta${pendingCount > 1 ? "e" : ""} in attesa` : "Gestisci le richieste di prenotazione"}
          actions={
            <button
              onClick={load}
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", color: "#a0a0a0", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Aggiorna
            </button>
          }
        />

        {/* Public booking link */}
        {bookingUrl && (
          <div style={{ background: "#111", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 14, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#F5A623", fontSize: 12, fontWeight: 600, margin: "0 0 4px" }}>Link prenotazione pubblica</p>
              <p style={{ color: "#a0a0a0", fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bookingUrl}</p>
            </div>
            <button
              onClick={copyUrl}
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: copied ? "#22c55e" : "#a0a0a0", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "Poppins, sans-serif", flexShrink: 0 }}
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              {copied ? "Copiato!" : "Copia"}
            </button>
          </div>
        )}

        {/* Status Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {(["all", "pending", "approved", "rejected"] as const).map((f) => {
            const count = f === "all" ? appointments.length : appointments.filter((a) => a.status === f).length;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: active ? "1.5px solid #F5A623" : "1.5px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(245,166,35,0.12)" : "#111",
                  color: active ? "#F5A623" : "#a0a0a0",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "Poppins, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {f === "all" ? "Tutte" : f === "pending" ? "In attesa" : f === "approved" ? "Approvate" : "Rifiutate"}
                {count > 0 && (
                  <span style={{
                    background: f === "pending" ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.08)",
                    color: f === "pending" ? "#F5A623" : "#666",
                    borderRadius: 6,
                    padding: "1px 7px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Channel Filters — shown only if channels exist */}
        {channels.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {[{ id: "all", name: "Tutti i canali", color: "#a0a0a0" }, ...channels, { id: "none", name: "Senza canale", color: "#555" }].map((ch) => {
              const active = channelFilter === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setChannelFilter(ch.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: active ? `1.5px solid ${ch.color}` : "1.5px solid rgba(255,255,255,0.06)",
                    background: active ? `${ch.color}22` : "#0d0d0d",
                    color: active ? ch.color : "#666",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "Poppins, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {ch.id !== "all" && ch.id !== "none" && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.color, display: "inline-block", flexShrink: 0 }} />
                  )}
                  <Link2 size={10} style={{ opacity: 0.6 }} />
                  {ch.name}
                </button>
              );
            })}
          </div>
        )}
        {channels.length === 0 && <div style={{ marginBottom: 24 }} />}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            <Loader2 size={24} style={{ margin: "0 auto 12px", display: "block", animation: "spin 1s linear infinite" }} />
            Caricamento...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555", fontSize: 14 }}>
            <Calendar size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            {filter === "all" ? "Nessuna prenotazione ancora." : `Nessuna prenotazione ${filter === "pending" ? "in attesa" : filter === "approved" ? "approvata" : "rifiutata"}.`}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((appt) => {
              const s = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending;
              const isOpen = expanded === appt.id;
              const isActing = acting === appt.id;
              const eventLabel =
                appt.eventType === "altro" && appt.eventTypeCustom
                  ? appt.eventTypeCustom
                  : EVENT_TYPE_LABELS[appt.eventType] ?? appt.eventType;

              return (
                <div
                  key={appt.id}
                  style={{
                    background: "#111",
                    border: `1px solid ${appt.status === "pending" ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 14,
                    overflow: "hidden",
                    transition: "border-color 0.15s",
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
                    onClick={() => setExpanded(isOpen ? null : appt.id)}
                  >
                    {/* Status dot */}
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: appt.status === "pending" ? `0 0 8px ${s.color}` : "none" }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ color: "#f5f5f5", fontSize: 15, fontWeight: 600 }}>{appt.clientName}</span>
                        <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                        <span style={{ background: "#1a1a1a", color: "#a0a0a0", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>{eventLabel}</span>
                        {appt.channelName && (
                          <span style={{ background: `${appt.channelColor ?? "#F5A623"}18`, color: appt.channelColor ?? "#F5A623", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: appt.channelColor ?? "#F5A623", display: "inline-block" }} />
                            {appt.channelName}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ color: "#666", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={11} /> {formatDate(appt.eventDate)}
                        </span>
                        <span style={{ color: "#666", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> {formatTime(appt.eventDate)}
                        </span>
                        <span style={{ color: "#555", fontSize: 12 }}>Ricevuta {timeAgo(appt.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {appt.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); approve(appt.id); }}
                            disabled={isActing}
                            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "7px 14px", color: "#22c55e", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "Poppins, sans-serif" }}
                          >
                            {isActing ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
                            Approva
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); reject(appt.id); }}
                            disabled={isActing}
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "7px 14px", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "Poppins, sans-serif" }}
                          >
                            <X size={12} /> Rifiuta
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : appt.id); }}
                        style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center" }}
                      >
                        <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
                        {/* Client info */}
                        <div>
                          <p style={detailLabel}>Contatti cliente</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Mail size={13} color="#666" />
                              <a href={`mailto:${appt.clientEmail}`} style={{ color: "#a0a0a0", fontSize: 13, textDecoration: "none" }}>{appt.clientEmail}</a>
                            </div>
                            {appt.clientPhone && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Phone size={13} color="#666" />
                                <span style={{ color: "#a0a0a0", fontSize: 13 }}>{appt.clientPhone}</span>
                              </div>
                            )}
                            {appt.eventLocation && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <MapPin size={13} color="#666" />
                                <span style={{ color: "#a0a0a0", fontSize: 13 }}>{appt.eventLocation}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Services */}
                        <div>
                          <p style={detailLabel}>Servizi richiesti</p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {appt.services.length > 0
                              ? appt.services.map((s) => (
                                  <span key={s} style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", color: "#a0a0a0", fontSize: 12, borderRadius: 6, padding: "3px 10px" }}>
                                    {SERVICE_LABELS[s] ?? s}
                                  </span>
                                ))
                              : <span style={{ color: "#555", fontSize: 13 }}>Non specificato</span>
                            }
                          </div>
                        </div>
                      </div>

                      {appt.notes && (
                        <div style={{ marginTop: 16 }}>
                          <p style={detailLabel}>Note</p>
                          <p style={{ color: "#a0a0a0", fontSize: 13, background: "#1a1a1a", borderRadius: 10, padding: "12px 14px", margin: 0 }}>{appt.notes}</p>
                        </div>
                      )}

                      {/* Delete button */}
                      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => remove(appt.id)}
                          disabled={isActing}
                          style={{ background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, fontFamily: "Poppins, sans-serif" }}
                        >
                          <Trash2 size={12} /> Elimina
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "ok" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "ok" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: toast.type === "ok" ? "#22c55e" : "#ef4444",
          borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 500,
          backdropFilter: "blur(8px)",
          animation: "fadeIn 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </DashboardLayout>
  );
}

const detailLabel: React.CSSProperties = {
  color: "#555",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 8px",
};
