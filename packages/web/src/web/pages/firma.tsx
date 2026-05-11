import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

type ContractData = {
  title: string;
  content: string;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  tenant?: { brandName: string; primaryColor: string; logoUrl: string | null };
};

export default function Firma() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/contracts/sign/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Contratto non trovato");
        return r.json();
      })
      .then((d) => {
        setContract(d.contract ?? d);
        if (d.contract?.signedAt || d.signedAt) setSigned(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const sign = async () => {
    if (!accepted || !signerName.trim() || !signerEmail.trim()) return;
    setSigning(true);
    const res = await fetch(`/api/contracts/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName, signerEmail }),
    });
    if (res.ok) {
      setSigned(true);
    } else {
      setError("Errore durante la firma. Riprova.");
    }
    setSigning(false);
  };

  const primaryColor = contract?.tenant?.primaryColor ?? "#6366f1";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#64748b" }}>Caricamento contratto...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontSize: "1.125rem" }}>⚠️ {error}</p>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Verifica il link ricevuto o contatta il fotografo.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          {contract?.tenant?.logoUrl ? (
            <img src={contract.tenant.logoUrl} alt="Logo" style={{ height: "48px", objectFit: "contain" }} />
          ) : (
            <span style={{ fontWeight: 800, fontSize: "1.5rem", color: primaryColor, letterSpacing: "-0.02em" }}>
              {contract?.tenant?.brandName ?? "FRAME"}
            </span>
          )}
        </div>

        {/* Contract card */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header */}
          <div style={{ padding: "1.75rem 2rem", borderBottom: "1px solid #e2e8f0" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {contract?.title}
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Leggi attentamente il contratto prima di firmare
            </p>
          </div>

          {/* Content */}
          <div
            style={{
              padding: "2rem",
              borderBottom: "1px solid #e2e8f0",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                color: "#334155",
                lineHeight: "1.7",
                whiteSpace: "pre-wrap",
              }}
            >
              {contract?.content}
            </div>
          </div>

          {/* Sign section */}
          {signed ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  background: "#dcfce7",
                  color: "#16a34a",
                  borderRadius: "9999px",
                  fontWeight: 600,
                  fontSize: "1rem",
                  marginBottom: "0.75rem",
                }}
              >
                ✓ Contratto firmato
              </div>
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                {contract?.signedAt
                  ? `Firmato il ${new Date(contract.signedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`
                  : "La firma è stata registrata con successo."}
              </p>
            </div>
          ) : (
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.875rem", color: "#64748b", display: "block", marginBottom: "0.375rem" }}>
                    Nome completo *
                  </label>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Mario Rossi"
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "0.875rem",
                      color: "#0f172a",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.875rem", color: "#64748b", display: "block", marginBottom: "0.375rem" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="mario@esempio.com"
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "0.875rem",
                      color: "#0f172a",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  style={{ marginTop: "0.125rem", width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.875rem", color: "#334155", lineHeight: "1.5" }}>
                  Dichiaro di aver letto e compreso il contratto e <strong>accetto e firmo</strong> digitalmente tutte le clausole in esso contenute.
                </span>
              </label>

              {error && (
                <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0 }}>{error}</p>
              )}

              <button
                onClick={sign}
                disabled={signing || !accepted || !signerName.trim() || !signerEmail.trim()}
                style={{
                  padding: "0.75rem 2rem",
                  background: primaryColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  cursor: signing ? "wait" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                  alignSelf: "flex-start",
                  opacity: signing || !accepted || !signerName.trim() || !signerEmail.trim() ? 0.5 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {signing ? "Firma in corso..." : "Firma il contratto"}
              </button>

              <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
                La firma verrà registrata insieme alla data/ora e all'indirizzo IP. Valida ai fini legali italiani ed europei.
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
          Powered by {contract?.tenant?.brandName ?? "FRAME"}
        </p>
      </div>
    </div>
  );
}
