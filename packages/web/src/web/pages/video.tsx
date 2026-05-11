import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";

type VideoItem = {
  id: string;
  title: string;
  url: string | null;
  version: string;
  projectId: string;
  project?: { name: string };
  commentCount?: number;
  shareToken: string | null;
  createdAt: string;
};

const VERSION_COLORS: Record<string, string> = {
  V1: "#6366f1",
  V2: "#f59e0b",
  V3: "#8b5cf6",
  Final: "#10b981",
};

export default function VideoPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ title: "", projectId: "", version: "V1" });
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get("projectId");

  useEffect(() => {
    Promise.all([api.get("/api/videos"), api.get("/api/projects")]).then(
      ([vRes, pRes]) => {
        if (vRes.ok) vRes.json().then((d: any) => setVideos(d.videos ?? d));
        if (pRes.ok) pRes.json().then((d: any) => setProjects(d.projects ?? d));
        setLoading(false);
      }
    );
    if (filterProjectId) {
      setForm((f) => ({ ...f, projectId: filterProjectId }));
      setShowModal(true);
    }
  }, []);

  const createVideo = async () => {
    if (!form.title) return;
    setCreating(true);
    try {
      let uploadedUrl: string | null = null;

      if (file) {
        // Presign upload
        const presignRes = await api.post("/api/videos/presign", {
          filename: file.name,
          contentType: file.type,
          projectId: form.projectId,
        });
        if (presignRes.ok) {
          const { uploadUrl, url } = await presignRes.json();
          await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          uploadedUrl = url;
        }
      }

      const res = await api.post("/api/videos", {
        ...form,
        url: uploadedUrl,
      });
      if (res.ok) {
        const d = await res.json();
        setVideos((prev) => [d.video ?? d, ...prev]);
        setShowModal(false);
        setForm({ title: "", projectId: "", version: "V1" });
        setFile(null);
      }
    } finally {
      setCreating(false);
    }
  };

  const displayed = filterProjectId
    ? videos.filter((v) => v.projectId === filterProjectId)
    : videos;

  return (
    <DashboardLayout>
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Video</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Raccolta e review con commenti a timecode
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
          + Nuovo video
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
            Nessun video ancora. Caricane uno!
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
            + Nuovo video
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayed.map((video) => {
            const vColor = VERSION_COLORS[video.version] ?? "#6366f1";
            return (
              <div
                key={video.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                }}
              >
                {/* Version badge */}
                <span
                  style={{
                    padding: "0.25rem 0.6rem",
                    background: vColor + "22",
                    color: vColor,
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    minWidth: "40px",
                    textAlign: "center",
                  }}
                >
                  {video.version}
                </span>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{video.title}</span>
                  {video.project && (
                    <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {video.project.name}
                    </span>
                  )}
                  {(video.commentCount ?? 0) > 0 && (
                    <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      💬 {video.commentCount}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {new Date(video.createdAt).toLocaleDateString("it-IT")}
                </span>

                <Link
                  to={`/video/${video.id}`}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Apri
                </Link>
              </div>
            );
          })}
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
              maxWidth: "440px",
            }}
          >
            <h2 style={{ margin: "0 0 1.5rem", color: "var(--text-primary)" }}>Nuovo video</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                  Titolo
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="es. Teaser matrimonio Rossi"
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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
                    <option value="">Seleziona</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                    Versione
                  </label>
                  <select
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
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
                    {["V1", "V2", "V3", "Final"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
                  File video (opzionale)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  style={{
                    width: "100%",
                    fontSize: "0.875rem",
                    color: "var(--text-primary)",
                  }}
                />
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
                  onClick={createVideo}
                  disabled={creating || !form.title}
                  style={{
                    padding: "0.625rem 1.25rem",
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: creating ? "wait" : "pointer",
                    fontWeight: 600,
                    opacity: creating || !form.title ? 0.6 : 1,
                  }}
                >
                  {creating ? "Caricamento..." : "Crea video"}
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
