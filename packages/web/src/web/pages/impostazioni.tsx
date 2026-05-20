import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Save, Check, UserPlus, X, Mail, Trash2, Users, Calendar, Loader2, CheckCircle2, AlertCircle, Download, Upload, DatabaseBackup, ShieldCheck, Link2, Plus, Copy, CheckCheck, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { ALL_SECTIONS, SECTION_LABELS, type SectionKey, invalidatePermissionsCache } from "../lib/permissions";

type TenantSettings = { brandName: string; primaryColor: string; logoUrl: string | null };
type Member = { id: string; name: string; email: string; image: string | null; role: string; permissions: SectionKey[] | null };
type Invite = { id: string; email: string; role: string; status: string; createdAt: string | null };

type Plan = { id: string; name: string; price: string; features: string[]; recommended?: boolean };
const PLANS: Plan[] = [
  { id: "free",   name: "Free",   price: "€0/mese",  features: ["1 progetto", "10 foto", "Branding FRAME"] },
  { id: "pro",    name: "Pro",    price: "€29/mese", features: ["Progetti illimitati", "500 foto/mese", "Watermark personalizzato", "Link condivisione"], recommended: true },
  { id: "agency", name: "Agency", price: "€79/mese", features: ["Tutto di Pro", "Foto illimitate", "White-label completo", "Logo personalizzato", "Supporto prioritario"] },
];

// ── MemberPermissionRow ─────────────────────────────────────────────────────
type MemberPermissionRowProps = {
  member: Member;
  myRole: string;
  onSave: (userId: string, perms: SectionKey[] | null, role: string) => Promise<void>;
  onRemove: (userId: string) => void;
  isSaving: boolean;
};

function MemberPermissionRow({ member: m, myRole, onSave, onRemove, isSaving }: MemberPermissionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localPerms, setLocalPerms] = useState<SectionKey[]>(m.permissions ?? [...ALL_SECTIONS]);
  const [localRole, setLocalRole] = useState(m.role);

  return (
    <div className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-[#F5A623] flex items-center justify-center text-black font-bold text-sm shrink-0">
          {m.image ? <img src={m.image} alt={m.name} className="w-8 h-8 rounded-full object-cover" /> : m.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#f5f5f5] truncate">{m.name}</p>
          <p className="text-xs text-[#555] truncate">{m.email}</p>
        </div>
        <span className="text-xs text-[#F5A623] font-semibold px-2 py-0.5 bg-[rgba(245,166,35,0.1)] rounded-lg shrink-0">
          {m.role}
        </span>
        {myRole === "owner" && (
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="shrink-0 p-1.5 rounded-lg text-[#444] hover:text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)] transition-colors"
            title="Modifica permessi"
          >
            <ShieldCheck size={13} />
          </button>
        )}
        {myRole === "owner" && (
          <button onClick={() => onRemove(m.id)} className="shrink-0 p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)] transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Permission panel */}
      {isEditing && (
        <div className="border-t border-[rgba(255,255,255,0.06)] p-3 space-y-3">
          {/* Role */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#a0a0a0] w-14 shrink-0">Ruolo</label>
            <select
              value={localRole}
              onChange={(e) => setLocalRole(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#f5f5f5] outline-none"
            >
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          {/* Sections — solo se staff */}
          {localRole === "staff" && (
            <>
              <div>
                <p className="text-xs text-[#a0a0a0] mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={11} /> Sezioni visibili
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SECTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLocalPerms((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        localPerms.includes(s)
                          ? "bg-[rgba(245,166,35,0.15)] border-[rgba(245,166,35,0.4)] text-[#F5A623]"
                          : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#555] line-through"
                      }`}
                    >
                      {SECTION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLocalPerms([...ALL_SECTIONS])}
                  className="text-xs text-[#555] hover:text-[#a0a0a0] underline"
                >
                  Seleziona tutto
                </button>
                <span className="text-[#333]">·</span>
                <button
                  type="button"
                  onClick={() => setLocalPerms([])}
                  className="text-xs text-[#555] hover:text-[#a0a0a0] underline"
                >
                  Deseleziona tutto
                </button>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={async () => {
                await onSave(m.id, localRole === "owner" ? null : localPerms, localRole);
                setIsEditing(false);
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-lg transition-colors disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Salva
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs text-[#666] hover:text-[#a0a0a0] rounded-lg transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Impostazioni ─────────────────────────────────────────────────────────────
export default function Impostazioni() {
  const [settings, setSettings] = useState<TenantSettings>({ brandName: "", primaryColor: "#F5A623", logoUrl: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Team state
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  // Invite permissions
  const [invitePermissions, setInvitePermissions] = useState<SectionKey[]>([...ALL_SECTIONS]);
  // Member permissions saving tracker (per userId)
  const [permSaving, setPermSaving] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>("owner");

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalMsg, setGcalMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Booking Channels state
  type BookingChannel = { id: string; name: string; slug: string; color: string; description?: string | null; logoUrl?: string | null; notifyEmail?: string | null; replyToEmail?: string | null; isActive: boolean };
  const [channels, setChannels] = useState<BookingChannel[]>([]);
  const [chLoading, setChLoading] = useState(false);
  const [chMsg, setChMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [editingChannel, setEditingChannel] = useState<Partial<BookingChannel> | null>(null);
  const [chSaving, setChSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const blankChannel: Partial<BookingChannel> = { name: "", slug: "", color: "#F5A623", description: "", notifyEmail: "", replyToEmail: "", isActive: true };

  const loadChannels = () => {
    api.get("/api/booking-channels").then((r) => {
      if (r.ok) r.json().then((d: any) => setChannels(d.channels ?? []));
    });
  };

  useEffect(() => {
    Promise.all([
      api.get("/api/tenant/settings"),
      api.get("/api/tenant/plan"),
      api.get("/api/team"),
      api.get("/api/bookings/oauth/status"),
      api.get("/api/team/my-permissions"),
    ]).then(([sRes, pRes, tRes, gcalRes, myPermRes]) => {
      if (sRes.ok) sRes.json().then((d: any) => setSettings(d.settings ?? d));
      if (pRes.ok) pRes.json().then((d: any) => setCurrentPlan(d.plan ?? d.planId ?? "free"));
      if (tRes.ok) tRes.json().then((d: any) => {
        setMembers(d.members ?? []);
        setInvites(d.invites ?? []);
      });
      if (gcalRes.ok) gcalRes.json().then((d: any) => setGcalConnected(d.connected ?? false));
      if (myPermRes.ok) myPermRes.json().then((d: any) => setMyRole(d.role ?? "owner"));
      setLoading(false);
    });
    loadChannels();

    // Handle redirect from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_success")) {
      setGcalConnected(true);
      setGcalMsg({ text: "Google Calendar collegato con successo!", type: "ok" });
      window.history.replaceState({}, "", "/impostazioni");
    } else if (params.get("gcal_error")) {
      setGcalMsg({ text: `Errore: ${decodeURIComponent(params.get("gcal_error")!)}`, type: "err" });
      window.history.replaceState({}, "", "/impostazioni");
    }
  }, []);

  const savePermissions = async (userId: string, permissions: SectionKey[] | null, role: string) => {
    setPermSaving(userId);
    await api.patch(`/api/team/member/${userId}/permissions`, { permissions, role });
    setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, permissions, role } : m));
    invalidatePermissionsCache();
    setPermSaving(null);
  };

  const toggleInvitePermission = (section: SectionKey) => {
    setInvitePermissions((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    const perms = inviteRole === "owner" ? null : invitePermissions;
    const res = await api.post("/api/team/invite", { email: inviteEmail.trim(), role: inviteRole, permissions: perms });
    if (res.ok) {
      const d = await res.json();
      setInvites((prev) => [...prev, d.invite]);
      setInviteEmail("");
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      setInviteError((d as any).error ?? "Errore invio invito");
    }
    setInviting(false);
  };

  const revokeInvite = async (inviteId: string) => {
    await api.delete(`/api/team/invite/${inviteId}`);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Rimuovere questo membro dal team?")) return;
    await api.delete(`/api/team/member/${userId}`);
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveSettings = async () => {
    setSaving(true);
    let logoUrl = settings.logoUrl;
    if (logoFile) {
      const presignRes = await api.post("/api/tenant/logo-presign", { filename: logoFile.name, contentType: logoFile.type });
      if (presignRes.ok) {
        const { uploadUrl, url } = await presignRes.json();
        await fetch(uploadUrl, { method: "PUT", body: logoFile, headers: { "Content-Type": logoFile.type } });
        logoUrl = url;
      }
    }
    const res = await api.patch("/api/tenant/settings", { ...settings, logoUrl });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      document.documentElement.style.setProperty("--primary", settings.primaryColor);
    }
    setSaving(false);
  };

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    setExporting(true);
    try {
      const res = await api.get("/api/backup/export");
      if (!res.ok) throw new Error("Export fallito");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frame-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setImportResult({ ok: false, msg: "Export fallito: " + (e.message ?? "errore sconosciuto") });
    }
    setExporting(false);
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.post("/api/backup/import", json);
      const d = await res.json() as any;
      if (res.ok && d.ok) {
        const s = d.stats;
        setImportResult({
          ok: true,
          msg: `Ripristino completato: ${s.clients} clienti, ${s.quotes} preventivi, ${s.contracts} contratti, ${s.projects} progetti, ${s.galleries} gallerie, ${s.photos} foto, ${s.videos} video, ${s.entrate + s.uscite} movimenti contabili.`,
        });
      } else {
        setImportResult({ ok: false, msg: d.error ?? "Importazione fallita" });
      }
    } catch (err: any) {
      setImportResult({ ok: false, msg: "File non valido: " + (err.message ?? "JSON malformato") });
    }
    setImporting(false);
    // Reset input
    if (importRef.current) importRef.current.value = "";
  };

  const connectGcal = async () => {
    setGcalLoading(true);
    const res = await api.get("/api/bookings/oauth/connect");
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      setGcalMsg({ text: "Errore avvio connessione Google Calendar", type: "err" });
      setGcalLoading(false);
    }
  };

  const disconnectGcal = async () => {
    if (!confirm("Disconnettere Google Calendar? Le prenotazioni approvate non creeranno più eventi.")) return;
    setGcalLoading(true);
    const res = await api.delete("/api/bookings/oauth/disconnect");
    if (res.ok) {
      setGcalConnected(false);
      setGcalMsg({ text: "Google Calendar disconnesso.", type: "err" });
    }
    setGcalLoading(false);
  };

  const upgradePlan = async (planId: string) => {
    const res = await api.post("/api/billing/checkout", { planId });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

  // Booking channels helpers
  const saveChannel = async () => {
    if (!editingChannel) return;
    if (!editingChannel.name?.trim() || !editingChannel.slug?.trim()) {
      setChMsg({ text: "Nome e slug sono obbligatori", type: "err" });
      return;
    }
    setChSaving(true);
    setChMsg(null);
    const isNew = !editingChannel.id;
    const res = isNew
      ? await api.post("/api/booking-channels", editingChannel)
      : await api.patch(`/api/booking-channels/${editingChannel.id}`, editingChannel);
    if (res.ok) {
      setChMsg({ text: isNew ? "Canale creato!" : "Canale aggiornato!", type: "ok" });
      setEditingChannel(null);
      loadChannels();
    } else {
      const d = await res.json().catch(() => ({}));
      setChMsg({ text: (d as any).error ?? "Errore salvataggio", type: "err" });
    }
    setChSaving(false);
    setTimeout(() => setChMsg(null), 3000);
  };

  const deleteChannel = async (id: string) => {
    if (!confirm("Eliminare questo canale? Le prenotazioni esistenti rimarranno.")) return;
    const res = await api.delete(`/api/booking-channels/${id}`);
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
      setChMsg({ text: "Canale eliminato.", type: "ok" });
      setTimeout(() => setChMsg(null), 2500);
    }
  };

  const toggleChannelActive = async (ch: BookingChannel) => {
    const res = await api.patch(`/api/booking-channels/${ch.id}`, { isActive: !ch.isActive });
    if (res.ok) setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, isActive: !c.isActive } : c));
  };

  const copyChannelUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/prenota/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (loading) return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 text-[#a0a0a0] text-sm">Caricamento...</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5] mb-6">Impostazioni</h1>

        {/* Brand section */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6 mb-4">
          <h2 className="text-base font-semibold text-[#f5f5f5] mb-5">Brand & White-label</h2>
          <div className="space-y-5">
            {/* Brand name */}
            <div>
              <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Nome brand</label>
              <input
                value={settings.brandName}
                onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                placeholder="es. Studio Rossi"
                className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              />
              <p className="text-xs text-[#555] mt-1">Sostituisce "FRAME" nell'interfaccia (piano Agency)</p>
            </div>

            {/* Primary color */}
            <div>
              <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Colore primario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-12 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
                />
                <input
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  placeholder="#F5A623"
                  className="w-32 px-3 py-2 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                />
                <div className="w-16 h-9 rounded-lg border border-[rgba(255,255,255,0.1)]" style={{ background: settings.primaryColor }} />
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Logo (piano Agency)</label>
              <div className="flex items-center gap-3 flex-wrap">
                {(logoPreview ?? settings.logoUrl) && (
                  <img
                    src={logoPreview ?? settings.logoUrl!}
                    alt="Logo"
                    className="h-12 object-contain rounded-lg border border-[rgba(255,255,255,0.1)]"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-sm text-[#a0a0a0] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[rgba(255,255,255,0.08)] file:text-[#f5f5f5]"
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed ${saved ? "bg-green-500 text-white" : "bg-[#F5A623] hover:bg-[#e09615] text-black"}`}
            >
              {saving ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Salvataggio...</> : saved ? <><Check size={15} /> Salvato!</> : <><Save size={15} /> Salva impostazioni</>}
            </button>
          </div>
        </div>

        {/* Team */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Users size={16} className="text-[#F5A623]" />
            <h2 className="text-base font-semibold text-[#f5f5f5]">Team</h2>
          </div>

          {/* Invite form */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-2">Invita membro</label>
            <div className="flex gap-2 flex-wrap mb-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
                placeholder="email@collega.com"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${inviteSent ? "bg-green-500 text-white" : "bg-[#F5A623] hover:bg-[#e09615] text-black"}`}
              >
                {inviting ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : inviteSent ? (
                  <><Check size={15} /> Inviato!</>
                ) : (
                  <><UserPlus size={15} /> Invita</>
                )}
              </button>
            </div>
            {/* Permessi invito (solo per staff) */}
            {inviteRole === "staff" && (
              <div className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#a0a0a0] mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Sezioni accessibili per questo membro
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_SECTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleInvitePermission(s)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        invitePermissions.includes(s)
                          ? "bg-[rgba(245,166,35,0.15)] border-[rgba(245,166,35,0.4)] text-[#F5A623]"
                          : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#555]"
                      }`}
                    >
                      {SECTION_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#444] mt-2">Le sezioni non selezionate saranno nascoste per questo utente.</p>
              </div>
            )}
            {inviteError && <p className="text-xs text-red-400 mt-1.5">{inviteError}</p>}
          </div>

          {/* Members list */}
          {members.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide mb-2">Membri attivi</p>
              <div className="space-y-2">
                {members.map((m) => (
                  <MemberPermissionRow
                    key={m.id}
                    member={m}
                    myRole={myRole}
                    onSave={savePermissions}
                    onRemove={removeMember}
                    isSaving={permSaving === m.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {invites.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide mb-2">Inviti in attesa</p>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-xl">
                    <Mail size={16} className="text-[#555] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#f5f5f5] truncate">{inv.email}</p>
                      <p className="text-xs text-[#555]">Ruolo: {inv.role} · In attesa</p>
                    </div>
                    <button onClick={() => revokeInvite(inv.id)} className="shrink-0 p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)] transition-colors" title="Revoca invito">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && invites.length === 0 && (
            <p className="text-sm text-[#444] text-center py-4">Nessun membro ancora — invita il tuo team!</p>
          )}
        </div>

        {/* Google Calendar */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-[#F5A623]" />
            <h2 className="text-base font-semibold text-[#f5f5f5]">Google Calendar</h2>
          </div>

          {gcalMsg && (
            <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 mb-4 ${gcalMsg.type === "ok" ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
              {gcalMsg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {gcalMsg.text}
            </div>
          )}

          <p className="text-sm text-[#a0a0a0] mb-5">
            Collega il tuo Google Calendar per sincronizzare automaticamente le prenotazioni approvate e mostrare la disponibilità ai clienti.
          </p>

          {gcalConnected ? (
            <div className="flex items-center gap-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#f5f5f5]">Google Calendar collegato</p>
                <p className="text-xs text-[#666] mt-0.5">Le prenotazioni approvate vengono aggiunte al tuo calendario automaticamente.</p>
              </div>
              <button
                onClick={disconnectGcal}
                disabled={gcalLoading}
                className="px-4 py-2 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {gcalLoading ? "..." : "Disconnetti"}
              </button>
            </div>
          ) : (
            <button
              onClick={connectGcal}
              disabled={gcalLoading}
              className="flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold bg-white hover:bg-gray-100 text-gray-900 rounded-xl transition-colors disabled:opacity-60"
            >
              {gcalLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {gcalLoading ? "Connessione in corso..." : "Collega Google Calendar"}
            </button>
          )}
        </div>

        {/* Backup & Ripristino */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <DatabaseBackup size={16} className="text-[#F5A623]" />
            <h2 className="text-base font-semibold text-[#f5f5f5]">Backup & Ripristino</h2>
          </div>
          <p className="text-sm text-[#a0a0a0] mb-5">
            Esporta tutti i dati (clienti, preventivi, contratti, progetti, gallerie, contabilità) in un file JSON.
            Puoi usarlo per migrare account o ripristinare dati eliminati accidentalmente.<br />
            <span className="text-[#555] text-xs mt-1 block">Nota: i file media (foto e video) non sono inclusi nel backup — solo i metadati.</span>
          </p>

          {importResult && (
            <div className={`flex items-start gap-2 text-sm rounded-xl px-4 py-3 mb-4 ${importResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
              {importResult.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              <span>{importResult.msg}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {/* Export */}
            <button
              onClick={exportBackup}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-xl transition-colors disabled:opacity-60"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {exporting ? "Esportazione..." : "Esporta backup"}
            </button>

            {/* Import */}
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#f5f5f5] border border-[rgba(255,255,255,0.08)] rounded-xl transition-colors disabled:opacity-60"
            >
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? "Ripristino in corso..." : "Ripristina da backup"}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={importBackup}
            />
          </div>
        </div>

        {/* Plans */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#f5f5f5] mb-5">Piano abbonamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((plan) => {
              const isActive = currentPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl p-4 border-2 transition-all ${isActive ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]" : plan.recommended ? "border-[rgba(245,166,35,0.3)]" : "border-[rgba(255,255,255,0.07)]"} bg-[#0a0a0a]`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#F5A623] text-black text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                      Consigliato
                    </div>
                  )}
                  <h3 className="text-sm font-bold text-[#f5f5f5] mb-0.5">{plan.name}</h3>
                  <p className="text-[#F5A623] font-bold text-base mb-3">{plan.price}</p>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-[#a0a0a0] flex items-start gap-1.5">
                        <span className="text-[#F5A623] mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {isActive ? (
                    <div className="py-2 text-center text-xs font-semibold text-[#F5A623] bg-[rgba(245,166,35,0.1)] rounded-lg">
                      Piano attuale
                    </div>
                  ) : (
                    <button
                      onClick={() => upgradePlan(plan.id)}
                      className="w-full py-2 text-xs font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-lg transition-colors"
                    >
                      {plan.id === "free" ? "Torna a Free" : `Passa a ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* ── Booking Channels ─────────────────────────────────────────── */}
        <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-[#f5f5f5]">Link prenotazione</h2>
              <p className="text-xs text-[#555] mt-0.5">Crea canali di prenotazione personalizzati con branding dedicato</p>
            </div>
            <button
              onClick={() => setEditingChannel({ ...blankChannel })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[rgba(245,166,35,0.12)] hover:bg-[rgba(245,166,35,0.2)] text-[#F5A623] border border-[rgba(245,166,35,0.25)] rounded-xl transition-colors"
            >
              <Plus size={13} /> Nuovo canale
            </button>
          </div>

          {chMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium mb-4 ${chMsg.type === "ok" ? "bg-[rgba(34,197,94,0.1)] text-green-400 border border-[rgba(34,197,94,0.2)]" : "bg-[rgba(239,68,68,0.1)] text-red-400 border border-[rgba(239,68,68,0.2)]"}`}>
              {chMsg.type === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {chMsg.text}
            </div>
          )}

          {/* Channels list */}
          {channels.length === 0 && !editingChannel ? (
            <div className="text-center py-8 text-[#444] text-sm">
              <Link2 size={28} className="mx-auto mb-2 opacity-30" />
              Nessun canale ancora. Crea il primo link personalizzato.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {channels.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: ch.color, display: "inline-block", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#f5f5f5] truncate">{ch.name}</span>
                      {!ch.isActive && <span className="text-xs text-[#555] bg-[#1a1a1a] px-2 py-0.5 rounded-md">disattivo</span>}
                    </div>
                    <span className="text-xs text-[#555] truncate block">/prenota/{ch.slug}</span>
                  </div>
                  <button
                    onClick={() => copyChannelUrl(ch.slug)}
                    title="Copia link"
                    className="p-1.5 rounded-lg text-[#444] hover:text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)] transition-colors"
                  >
                    {copiedSlug === ch.slug ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => toggleChannelActive(ch)}
                    title={ch.isActive ? "Disattiva" : "Attiva"}
                    className="p-1.5 rounded-lg text-[#444] hover:text-[#F5A623] transition-colors"
                  >
                    {ch.isActive ? <ToggleRight size={16} className="text-[#F5A623]" /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => setEditingChannel({ ...ch })}
                    title="Modifica"
                    className="p-1.5 rounded-lg text-[#444] hover:text-[#F5A623] hover:bg-[rgba(245,166,35,0.08)] transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteChannel(ch.id)}
                    title="Elimina"
                    className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Edit / Create form */}
          {editingChannel && (
            <div className="bg-[#0a0a0a] border border-[rgba(245,166,35,0.2)] rounded-xl p-4 space-y-3 mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[#f5f5f5]">{editingChannel.id ? "Modifica canale" : "Nuovo canale"}</span>
                <button onClick={() => setEditingChannel(null)} className="text-[#444] hover:text-[#f5f5f5] transition-colors"><X size={14} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Nome *</label>
                  <input
                    value={editingChannel.name ?? ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                    placeholder="es. Frame Studios"
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Slug URL *</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[#555] shrink-0">/prenota/</span>
                    <input
                      value={editingChannel.slug ?? ""}
                      onChange={(e) => setEditingChannel({ ...editingChannel, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      placeholder="frame"
                      className="flex-1 px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Email notifiche</label>
                  <input
                    type="email"
                    value={editingChannel.notifyEmail ?? ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, notifyEmail: e.target.value })}
                    placeholder="tua@email.com"
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Email risposta cliente</label>
                  <input
                    type="email"
                    value={editingChannel.replyToEmail ?? ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, replyToEmail: e.target.value })}
                    placeholder="risposta@email.com"
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Descrizione (visibile ai clienti)</label>
                <textarea
                  value={editingChannel.description ?? ""}
                  onChange={(e) => setEditingChannel({ ...editingChannel, description: e.target.value })}
                  rows={2}
                  placeholder="Prenota una sessione fotografica con Frame Studios..."
                  className="w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)] resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Colore brand</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingChannel.color ?? "#F5A623"}
                      onChange={(e) => setEditingChannel({ ...editingChannel, color: e.target.value })}
                      className="w-10 h-9 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      value={editingChannel.color ?? "#F5A623"}
                      onChange={(e) => setEditingChannel({ ...editingChannel, color: e.target.value })}
                      className="w-28 px-2 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#a0a0a0] font-semibold uppercase tracking-wide block mb-1">Logo URL</label>
                  <input
                    value={editingChannel.logoUrl ?? ""}
                    onChange={(e) => setEditingChannel({ ...editingChannel, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#333] outline-none focus:border-[rgba(245,166,35,0.5)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#a0a0a0]">
                  <input
                    type="checkbox"
                    checked={editingChannel.isActive ?? true}
                    onChange={(e) => setEditingChannel({ ...editingChannel, isActive: e.target.checked })}
                    className="accent-[#F5A623]"
                  />
                  Canale attivo
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingChannel(null)}
                    className="px-4 py-2 text-xs text-[#666] hover:text-[#a0a0a0] transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={saveChannel}
                    disabled={chSaving}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-xl transition-colors disabled:opacity-50"
                  >
                    {chSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {editingChannel.id ? "Salva modifiche" : "Crea canale"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
