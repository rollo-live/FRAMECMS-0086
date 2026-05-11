import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";

type Gallery = {
  id: string;
  name: string;
  projectId: string;
  project?: { name: string };
  photoCount?: number;
  watermarkEnabled: boolean;
  shareToken: string | null;
  createdAt: string;
};

export default function GalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: "", projectId: "" });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get("projectId");

  useEffect(() => {
    Promise.all([
      api.get("/api/galleries"),
      api.get("/api/projects"),
    ]).then(([gRes, pRes]) => {
      if (gRes.ok) gRes.json().then((d: any) => setGalleries(d.galleries ?? d));
      if (pRes.ok) pRes.json().then((d: any) => setProjects(d.projects ?? d));
      setLoading(false);
    });
    if (filterProjectId) {
      setForm((f) => ({ ...f, projectId: filterProjectId }));
      setShowModal(true);
    }
  }, []);

  const createGallery = async () => {
    if (!form.name) return;
    setCreating(true);
    const res = await api.post("/api/galleries", form);
    if (res.ok) {
      const d = await res.json();
      setGalleries((prev) => [d.gallery ?? d, ...prev]);
      setShowModal(false);
      setForm({ name: "", projectId: "" });
    }
    setCreating(false);
  };

  const generateShareLink = async (galleryId: string) => {
    const res = await api.post(`/api/galleries/${galleryId}/share`);
    if (res.ok) {
      const d = await res.json();
      const token = d.shareToken ?? d.token;
      setGalleries((prev) =>
        prev.map((g) => (g.id === galleryId ? { ...g, shareToken: token } : g))
      );
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/portale/gallery/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const displayed = filterProjectId
    ? galleries.filter((g) => g.projectId === filterProjectId)
    : galleries;

  return (
    <DashboardLayout>
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Gallery</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Condividi le foto con i tuoi clienti
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "0.625rem 1.25rem",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          + Nuova gallery
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Caricamento...</p>
      ) : displayed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
            Nessuna gallery ancora. Creane una!
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "0.625rem 1.25rem",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Nuova gallery
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {displayed.map((gallery) => (
            <div
              key={gallery.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {/* Preview placeholder */}
              <div
                style={{
                  height: "140px",
                  background: "linear-gradient(135deg, var(--primary)22 0%, var(--primary)11 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                }}
              >
                🖼️
              </div>
              <div style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)", fontSize: "1rem" }}>
                      {gallery.name}
                    </h3>
                    {gallery.project && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {gallery.project.name}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      background: "var(--border)",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {gallery.photoCount ?? 0} foto
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <Link
                    to={`/gallery/${gallery.id}`}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      background: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    Apri
                  </Link>
                  {gallery.shareToken ? (
                    <button
                      onClick={() => copyLink(gallery.shareToken!)}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        background: copied === gallery.shareToken ? "#10b981" : "var(--surface)",
                        color: copied === gallery.shareToken ? "#fff" : "var(--text-primary)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        transition: "all 0.15s",
                      }}
                    >
                      {copied === gallery.shareToken ? "Copiato!" : "Copia link"}
                    </button>
                  ) : (
                    <button
                      onClick={() => generateShareLink(gallery.id)}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      Genera link
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "420px",
            }}
          >
            <h2 style={{ margin: "0 0 1.5rem", color: "var(--text-primary)" }}>Nuova gallery</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                  Nome gallery
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="es. Matrimonio Rossi - Foto finali"
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                  Progetto
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="">Seleziona progetto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "0.625rem 1.25rem",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={createGallery}
                  disabled={creating || !form.name}
                  style={{
                    padding: "0.625rem 1.25rem",
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: creating ? "wait" : "pointer",
                    fontWeight: 600,
                    opacity: creating || !form.name ? 0.6 : 1,
                  }}
                >
                  {creating ? "Creazione..." : "Crea gallery"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
