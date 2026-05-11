import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

type ClientData = {
  id: string;
  name: string;
  email: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  galleries?: { id: string; name: string; shareToken: string }[];
  videos?: { id: string; title: string; version: string; shareToken: string }[];
};

type PortaleData = {
  client: ClientData;
  projects: Project[];
  tenant: { brandName: string; primaryColor: string; logoUrl: string | null };
};

const CLIENT_TOKEN_KEY = "frame_client_token";

export default function Portale() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    // Store token for subsequent API calls
    localStorage.setItem(CLIENT_TOKEN_KEY, token);

    fetch(`/api/client-portal/verify/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Link non valido o scaduto");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const primaryColor = data?.tenant?.primaryColor ?? "#6366f1";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#64748b" }}>Caricamento portale...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontSize: "1.125rem" }}>⚠️ {error ?? "Errore sconosciuto"}</p>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Contatta il fotografo per un nuovo link.</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    lead: "#94a3b8",
    booked: "#6366f1",
    shooting: "#f59e0b",
    editing: "#8b5cf6",
    delivered: "#10b981",
  };

  const statusLabels: Record<string, string> = {
    lead: "In valutazione",
    booked: "Confermato",
    shooting: "In shooting",
    editing: "In editing",
    delivered: "Consegnato",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          {data.tenant.logoUrl ? (
            <img src={data.tenant.logoUrl} alt="Logo" style={{ height: "40px", objectFit: "contain" }} />
          ) : (
            <span style={{ fontWeight: 800, fontSize: "1.5rem", color: primaryColor, letterSpacing: "-0.02em" }}>
              {data.tenant.brandName}
            </span>
          )}
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>{data.client.name}</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>{data.client.email}</p>
          </div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>
          Benvenuto, {data.client.name.split(" ")[0]}!
        </h1>
        <p style={{ margin: "0 0 2rem", color: "#64748b" }}>
          Qui trovi tutte le foto e i video dei tuoi progetti.
        </p>

        {data.projects.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "3rem",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#64748b" }}>Nessun contenuto disponibile al momento.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {data.projects.map((project) => {
              const sc = statusColors[project.status] ?? "#94a3b8";
              return (
                <div
                  key={project.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", flex: 1 }}>
                      {project.name}
                    </h2>
                    <span
                      style={{
                        padding: "0.2rem 0.75rem",
                        background: sc + "22",
                        color: sc,
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {statusLabels[project.status] ?? project.status}
                    </span>
                  </div>

                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    {/* Galleries */}
                    {(project.galleries ?? []).length > 0 && (
                      <div style={{ marginBottom: "1rem" }}>
                        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Gallery
                        </h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {(project.galleries ?? []).map((g) => (
                            <Link
                              key={g.id}
                              to={`/portale/gallery/${g.shareToken}`}
                              style={{
                                padding: "0.5rem 1rem",
                                background: primaryColor + "11",
                                color: primaryColor,
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                border: `1px solid ${primaryColor}33`,
                              }}
                            >
                              🖼️ {g.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Videos */}
                    {(project.videos ?? []).length > 0 && (
                      <div>
                        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Video
                        </h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {(project.videos ?? []).map((v) => (
                            <Link
                              key={v.id}
                              to={`/portale/video/${v.shareToken}`}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#f59e0b11",
                                color: "#f59e0b",
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                border: "1px solid #f59e0b33",
                              }}
                            >
                              🎬 {v.title} <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{v.version}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {(project.galleries ?? []).length === 0 && (project.videos ?? []).length === 0 && (
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.875rem" }}>
                        Nessun contenuto disponibile per questo progetto ancora.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: "#94a3b8" }}>
          Powered by {data.tenant.brandName}
        </p>
      </div>
    </div>
  );
}
