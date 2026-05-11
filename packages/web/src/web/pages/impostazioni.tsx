import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Save, Check, UserPlus, X, Mail, Trash2, Users } from "lucide-react";

type TenantSettings = { brandName: string; primaryColor: string; logoUrl: string | null };
type Member = { id: string; name: string; email: string; image: string | null; role: string };
type Invite = { id: string; email: string; role: string; status: string; createdAt: string | null };

type Plan = { id: string; name: string; price: string; features: string[]; recommended?: boolean };
const PLANS: Plan[] = [
  { id: "free",   name: "Free",   price: "€0/mese",  features: ["1 progetto", "10 foto", "Branding FRAME"] },
  { id: "pro",    name: "Pro",    price: "€29/mese", features: ["Progetti illimitati", "500 foto/mese", "Watermark personalizzato", "Link condivisione"], recommended: true },
  { id: "agency", name: "Agency", price: "€79/mese", features: ["Tutto di Pro", "Foto illimitate", "White-label completo", "Logo personalizzato", "Supporto prioritario"] },
];

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

  useEffect(() => {
    Promise.all([
      api.get("/api/tenant/settings"),
      api.get("/api/tenant/plan"),
      api.get("/api/team"),
    ]).then(([sRes, pRes, tRes]) => {
      if (sRes.ok) sRes.json().then((d: any) => setSettings(d.settings ?? d));
      if (pRes.ok) pRes.json().then((d: any) => setCurrentPlan(d.plan ?? d.planId ?? "free"));
      if (tRes.ok) tRes.json().then((d: any) => { setMembers(d.members ?? []); setInvites(d.invites ?? []); });
      setLoading(false);
    });
  }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    const res = await api.post("/api/team/invite", { email: inviteEmail.trim(), role: inviteRole });
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

  const upgradePlan = async (planId: string) => {
    const res = await api.post("/api/billing/checkout", { planId });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
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
            <div className="flex gap-2 flex-wrap">
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
            {inviteError && <p className="text-xs text-red-400 mt-1.5">{inviteError}</p>}
          </div>

          {/* Members list */}
          {members.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide mb-2">Membri attivi</p>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-xl">
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
                    <button onClick={() => removeMember(m.id)} className="shrink-0 p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
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
      </div>
    </DashboardLayout>
  );
}
