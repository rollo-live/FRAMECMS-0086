import { useState, useEffect } from "react";
import { api } from "../lib/api";

type TenantSettings = {
  brandName: string;
  primaryColor: string;
  logoUrl: string | null;
};

type Plan = {
  id: string;
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "€0/mese",
    features: ["1 progetto", "10 foto", "Branding FRAME"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€29/mese",
    features: ["Progetti illimitati", "500 foto/mese", "Watermark personalizzato", "Link condivisione"],
    recommended: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "€79/mese",
    features: ["Tutto di Pro", "Foto illimitate", "White-label completo", "Logo personalizzato", "Supporto prioritario"],
  },
];

export default function Impostazioni() {
  const [settings, setSettings] = useState<TenantSettings>({
    brandName: "",
    primaryColor: "#6366f1",
    logoUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/tenant/settings"),
      api.get("/api/tenant/plan"),
    ]).then(([sRes, pRes]) => {
      if (sRes.ok) sRes.json().then((d: any) => setSettings(d.settings ?? d));
      if (pRes.ok) pRes.json().then((d: any) => setCurrentPlan(d.plan ?? d.planId ?? "free"));
      setLoading(false);
    });
  }, []);

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
      const presignRes = await api.post("/api/tenant/logo-presign", {
        filename: logoFile.name,
        contentType: logoFile.type,
      });
      if (presignRes.ok) {
        const { uploadUrl, url } = await presignRes.json();
        await fetch(uploadUrl, {
          method: "PUT",
          body: logoFile,
          headers: { "Content-Type": logoFile.type },
        });
        logoUrl = url;
      }
    }

    const res = await api.patch("/api/tenant/settings", { ...settings, logoUrl });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Apply primary color live
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

  if (loading) return <div style={{ padding: "2rem", color: "var(--text-secondary)" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "2rem", maxWidth: "800px" }}>
      <h1 style={{ margin: "0 0 2rem", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
        Impostazioni
      </h1>

      {/* Brand settings */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "1.75rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
          Brand & White-label
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Brand name */}
          <div>
            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
              Nome brand
            </label>
            <input
              value={settings.brandName}
              onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
              placeholder="es. Studio Rossi"
              style={{
                width: "100%",
                padding: "0.625rem 0.875rem",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Sostituisce "FRAME" nell'interfaccia (piano Agency)
            </p>
          </div>

          {/* Primary color */}
          <div>
            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
              Colore primario
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                style={{ width: "48px", height: "40px", border: "none", borderRadius: "6px", cursor: "pointer" }}
              />
              <input
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                placeholder="#6366f1"
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  width: "140px",
                }}
              />
              <div
                style={{
                  width: "80px",
                  height: "36px",
                  borderRadius: "8px",
                  background: settings.primaryColor,
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
              Logo (piano Agency)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {(logoPreview ?? settings.logoUrl) && (
                <img
                  src={logoPreview ?? settings.logoUrl!}
                  alt="Logo"
                  style={{ height: "48px", objectFit: "contain", borderRadius: "6px", border: "1px solid var(--border)" }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            style={{
              alignSelf: "flex-start",
              padding: "0.625rem 1.5rem",
              background: saved ? "#10b981" : "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Salvataggio..." : saved ? "✓ Salvato!" : "Salva impostazioni"}
          </button>
        </div>
      </section>

      {/* Plans */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "1.75rem",
        }}
      >
        <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
          Piano abbonamento
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                style={{
                  background: isActive ? "var(--primary)11" : "var(--bg)",
                  border: `2px solid ${isActive ? "var(--primary)" : plan.recommended ? "var(--primary)44" : "var(--border)"}`,
                  borderRadius: "12px",
                  padding: "1.25rem",
                  position: "relative",
                }}
              >
                {plan.recommended && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--primary)",
                      color: "#fff",
                      padding: "0.1rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    Consigliato
                  </div>
                )}
                <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-primary)", fontSize: "1rem" }}>
                  {plan.name}
                </h3>
                <p style={{ margin: "0 0 1rem", color: "var(--primary)", fontWeight: 700, fontSize: "1.1rem" }}>
                  {plan.price}
                </p>
                <ul style={{ margin: "0 0 1rem", padding: "0 0 0 1rem", color: "var(--text-secondary)", fontSize: "0.8rem", lineHeight: "1.8" }}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {isActive ? (
                  <div
                    style={{
                      padding: "0.5rem",
                      background: "var(--primary)22",
                      color: "var(--primary)",
                      borderRadius: "8px",
                      textAlign: "center",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    Piano attuale
                  </div>
                ) : (
                  <button
                    onClick={() => upgradePlan(plan.id)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    {plan.id === "free" ? "Torna a Free" : `Passa a ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
