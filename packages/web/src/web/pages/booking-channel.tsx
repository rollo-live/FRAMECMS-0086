import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "battesimo", label: "Battesimo", duration: 4 },
  { value: "compleanno", label: "Compleanno", duration: 3 },
  { value: "matrimonio", label: "Matrimonio", duration: 11 },
  { value: "shooting_aziendale", label: "Shooting Aziendale", duration: 2 },
  { value: "conferenza", label: "Conferenza", duration: 3 },
  { value: "altro", label: "Altro", duration: 2 },
];

const SERVICES = [
  { value: "foto", label: "Fotografia" },
  { value: "video", label: "Video" },
  { value: "stampe_live", label: "Stampe Live" },
];

const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const DAYS_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

interface BusySlot { start: string; end: string }
interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  primaryColor: string;
  description?: string | null;
}

function isDateBusy(date: Date, busy: BusySlot[], durationHours: number): boolean {
  const start = date.getTime();
  const end = start + durationHours * 3600 * 1000;
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return start < be && end > bs;
  });
}

export default function BookingChannelPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();

  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [channelError, setChannelError] = useState(false);
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [loadingBusy, setLoadingBusy] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [eventType, setEventType] = useState("");
  const [eventTypeCustom, setEventTypeCustom] = useState("");
  const [services, setServices] = useState<string[]>(["foto"]);
  const [time, setTime] = useState("10:00");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [notes, setNotes] = useState("");

  const selectedEventType = EVENT_TYPES.find((e) => e.value === eventType);
  const durationHours = selectedEventType?.duration ?? 2;
  const primaryColor = channel?.primaryColor ?? "#F5A623";

  // Fetch channel info
  useEffect(() => {
    if (!channelSlug) return;
    fetch(`/api/bookings/channel/${channelSlug}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setChannel(d.channel))
      .catch(() => setChannelError(true));
  }, [channelSlug]);

  // Fetch busy slots
  useEffect(() => {
    if (!channelSlug) return;
    const from = new Date();
    const to = new Date(Date.now() + 90 * 24 * 3600 * 1000);
    setLoadingBusy(true);
    fetch(`/api/bookings/channel/${channelSlug}/busy?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then((d) => setBusy(d.busy ?? []))
      .catch(() => setBusy([]))
      .finally(() => setLoadingBusy(false));
  }, [channelSlug]);

  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }, [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const toggleService = (v: string) => {
    setServices((prev) => prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !eventType || !clientName || !clientEmail) return;
    setSubmitting(true);
    setError("");

    const [h, m] = time.split(":").map(Number);
    const eventDate = new Date(selectedDate);
    eventDate.setHours(h, m, 0, 0);

    const res = await fetch(`/api/bookings/channel/${channelSlug}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName, clientEmail,
        clientPhone: clientPhone || undefined,
        eventType, eventTypeCustom: eventTypeCustom || undefined,
        services, eventDate: eventDate.toISOString(),
        eventLocation: eventLocation || undefined,
        notes: notes || undefined,
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError((d as any).error ?? "Errore invio richiesta");
    }
    setSubmitting(false);
  };

  if (channelError) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#555" }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>404</p>
          <p style={{ fontSize: 14 }}>Link di prenotazione non trovato.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Poppins, sans-serif" }}>
        <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "48px 40px", maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <Check size={28} color="#22c55e" />
          </div>
          <h2 style={{ color: "#f5f5f5", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Richiesta inviata!</h2>
          <p style={{ color: "#a0a0a0", fontSize: 14, lineHeight: 1.6 }}>
            La tua richiesta è stata ricevuta da <strong style={{ color: "#f5f5f5" }}>{channel?.name}</strong>.<br />
            Riceverai una conferma via email non appena verrà approvata.
          </p>
        </div>
      </div>
    );
  }

  const makeInputStyle = (): React.CSSProperties => ({
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f5f5f5",
    fontSize: 13,
    outline: "none",
    fontFamily: "Poppins, sans-serif",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block", color: "#666", fontSize: 12, fontWeight: 500, marginBottom: 6,
  };

  const navBtnStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "6px 8px",
    color: "#a0a0a0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "Poppins, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header branding */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", gap: 16 }}>
          {channel?.logo ? (
            <img src={channel.logo} alt={channel.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 48, height: 48, background: primaryColor, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#000", fontSize: 22, flexShrink: 0 }}>
              {channel?.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <h1 style={{ color: "#f5f5f5", fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>
              {channel ? `Prenota con ${channel.name}` : "Richiedi una prenotazione"}
            </h1>
            <p style={{ color: "#a0a0a0", fontSize: 13, margin: 0 }}>
              {channel?.description ?? "Seleziona una data e compila il modulo. Riceverai una risposta via email."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Event type */}
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} color={primaryColor} /> Tipo di evento
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {EVENT_TYPES.map((et) => (
                    <button
                      key={et.value}
                      type="button"
                      onClick={() => setEventType(et.value)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: eventType === et.value ? `1.5px solid ${primaryColor}` : "1.5px solid rgba(255,255,255,0.08)",
                        background: eventType === et.value ? `${primaryColor}20` : "#1a1a1a",
                        color: eventType === et.value ? primaryColor : "#a0a0a0",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        transition: "all 0.15s",
                        fontFamily: "Poppins, sans-serif",
                      }}
                    >
                      <span>{et.label}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{et.duration}h</span>
                    </button>
                  ))}
                </div>
                {eventType === "altro" && (
                  <input
                    placeholder="Descrivi il tuo evento..."
                    value={eventTypeCustom}
                    onChange={(e) => setEventTypeCustom(e.target.value)}
                    style={{ ...makeInputStyle(), marginTop: 12 }}
                    required
                  />
                )}
              </div>

              {/* Services */}
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Servizi richiesti</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SERVICES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleService(s.value)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: services.includes(s.value) ? `1.5px solid ${primaryColor}` : "1.5px solid rgba(255,255,255,0.08)",
                        background: services.includes(s.value) ? `${primaryColor}20` : "#1a1a1a",
                        color: services.includes(s.value) ? primaryColor : "#a0a0a0",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "Poppins, sans-serif",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={15} color={primaryColor} /> Orario di inizio
                </h3>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required style={{ ...makeInputStyle(), colorScheme: "dark" }} />
                {selectedEventType && (
                  <p style={{ color: "#666", fontSize: 12, margin: "8px 0 0" }}>Durata stimata: {selectedEventType.duration}h</p>
                )}
              </div>

              {/* Contact */}
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <h3 style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={15} color={primaryColor} /> I tuoi dati
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nome e cognome *</label>
                    <input placeholder="Mario Rossi" value={clientName} onChange={(e) => setClientName(e.target.value)} required style={makeInputStyle()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" placeholder="mario@esempio.it" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} required style={makeInputStyle()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Telefono</label>
                    <input type="tel" placeholder="+39 333 1234567" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={makeInputStyle()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Luogo dell'evento</label>
                    <input placeholder="Milano, Piazza Duomo..." value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} style={makeInputStyle()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Note aggiuntive</label>
                    <textarea
                      placeholder="Dettagli, preferenze, richieste speciali..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      style={{ ...makeInputStyle(), resize: "vertical" as const, minHeight: 72 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — calendar */}
            <div>
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, position: "sticky", top: 24 }}>
                <h3 style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} color={primaryColor} /> Scegli una data
                </h3>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <button type="button" onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={16} /></button>
                  <span style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600 }}>{MONTHS_IT[calMonth]} {calYear}</span>
                  <button type="button" onClick={nextMonth} style={navBtnStyle}><ChevronRight size={16} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
                  {DAYS_IT.map((d) => (
                    <div key={d} style={{ textAlign: "center", color: "#555", fontSize: 11, fontWeight: 600, padding: "4px 0" }}>{d}</div>
                  ))}
                </div>

                {loadingBusy ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#555", fontSize: 13 }}>
                    <Loader2 size={20} style={{ margin: "0 auto 8px", display: "block", animation: "spin 1s linear infinite" }} />
                    Caricamento disponibilità...
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                    {calDays.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const isPast = day < today;
                      const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                      const selKey = selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}` : "";
                      const isSelected = dateKey === selKey;
                      const [h, m] = time.split(":").map(Number);
                      const testDate = new Date(day);
                      testDate.setHours(h, m, 0, 0);
                      const isBusy = eventType ? isDateBusy(testDate, busy, durationHours) : false;
                      const disabled = isPast || isBusy;
                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedDate(day)}
                          style={{
                            padding: "8px 4px",
                            borderRadius: 8,
                            border: isSelected ? `1.5px solid ${primaryColor}` : "1.5px solid transparent",
                            background: isSelected ? `${primaryColor}33` : isBusy ? "rgba(239,68,68,0.06)" : "transparent",
                            color: disabled ? (isBusy ? "rgba(239,68,68,0.4)" : "#333") : isSelected ? primaryColor : "#f5f5f5",
                            fontSize: 13,
                            fontWeight: isSelected ? 700 : 400,
                            cursor: disabled ? "not-allowed" : "pointer",
                            textAlign: "center",
                            transition: "all 0.12s",
                            fontFamily: "Poppins, sans-serif",
                          }}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, background: `${primaryColor}33`, border: `1.5px solid ${primaryColor}`, borderRadius: 3 }} />
                    <span style={{ color: "#666", fontSize: 11 }}>Selezionato</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, background: "rgba(239,68,68,0.06)", borderRadius: 3 }} />
                    <span style={{ color: "#666", fontSize: 11 }}>Occupato</span>
                  </div>
                </div>

                {selectedDate && (
                  <div style={{ background: `${primaryColor}14`, border: `1px solid ${primaryColor}33`, borderRadius: 10, padding: "12px 16px", marginTop: 16 }}>
                    <p style={{ color: primaryColor, fontSize: 13, fontWeight: 600, margin: 0 }}>
                      {selectedDate.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} alle {time}
                    </p>
                    {selectedEventType && (
                      <p style={{ color: "#a0a0a0", fontSize: 12, margin: "4px 0 0" }}>
                        {selectedEventType.label} · {selectedEventType.duration}h di copertura
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginTop: 20, color: "#ef4444", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={!selectedDate || !eventType || !clientName || !clientEmail || submitting}
              style={{
                background: primaryColor,
                color: "#000",
                border: "none",
                borderRadius: 12,
                padding: "14px 32px",
                fontSize: 14,
                fontWeight: 700,
                cursor: (!selectedDate || !eventType || !clientName || !clientEmail || submitting) ? "not-allowed" : "pointer",
                opacity: (!selectedDate || !eventType || !clientName || !clientEmail) ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "Poppins, sans-serif",
              }}
            >
              {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
              {submitting ? "Invio in corso..." : "Invia richiesta"}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @media (max-width: 700px) { form > div { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
