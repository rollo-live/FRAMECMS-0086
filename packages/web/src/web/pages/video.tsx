import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Plus, Video as VideoIcon, ExternalLink, MessageSquare } from "lucide-react";

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
    Promise.all([api.get("/api/videos"), api.get("/api/projects")]).then(([vRes, pRes]) => {
      if (vRes.ok) vRes.json().then((d: any) => setVideos(d.videos ?? d));
      if (pRes.ok) pRes.json().then((d: any) => setProjects(d.projects ?? d));
      setLoading(false);
    });
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
        const presignRes = await api.post("/api/videos/presign", { filename: file.name, contentType: file.type, projectId: form.projectId });
        if (presignRes.ok) {
          const { url: presignUrl, key } = await presignRes.json();
          await fetch(presignUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          uploadedUrl = key;
        }
      }
      const res = await api.post("/api/videos", { ...form, r2Key: uploadedUrl ?? "" });
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

  const displayed = filterProjectId ? videos.filter((v) => v.projectId === filterProjectId) : videos;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">Video</h1>
            <p className="text-sm text-[#a0a0a0] mt-0.5">Raccolta e review con commenti a timecode</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#F5A623] hover:bg-[#e09615] text-black text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Nuovo video</span><span className="sm:hidden">Nuovo</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl text-center">
            <VideoIcon size={36} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm mb-4">Nessun video ancora</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#F5A623] text-black text-sm font-semibold rounded-xl hover:bg-[#e09615] transition-colors"
            >
              <Plus size={14} /> Carica il primo video
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((video) => {
              const vColor = VERSION_COLORS[video.version] ?? "#6366f1";
              return (
                <div
                  key={video.id}
                  className="flex items-center gap-3 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-3 sm:p-4 hover:border-[rgba(255,255,255,0.12)] transition-colors"
                >
                  {/* Version badge */}
                  <span
                    className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg min-w-[36px] text-center"
                    style={{ background: vColor + "22", color: vColor }}
                  >
                    {video.version}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#f5f5f5] truncate">{video.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {video.project && (
                        <span className="text-xs text-[#666]">{video.project.name}</span>
                      )}
                      {(video.commentCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-[#666]">
                          <MessageSquare size={11} /> {video.commentCount}
                        </span>
                      )}
                      <span className="text-xs text-[#444]">{new Date(video.createdAt).toLocaleDateString("it-IT")}</span>
                    </div>
                  </div>

                  <Link
                    to={`/video/${video.id}`}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F5A623] text-black rounded-lg hover:bg-[#e09615] transition-colors"
                  >
                    <ExternalLink size={12} /> <span className="hidden sm:inline">Apri</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-[#111] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-[#f5f5f5] mb-5">Nuovo video</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Titolo</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="es. Teaser matrimonio Rossi"
                  className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Progetto</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                  >
                    <option value="">Nessuno</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Versione</label>
                  <select
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                  >
                    {["V1", "V2", "V3", "Final"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">File video (opzionale)</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-[#a0a0a0] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[rgba(255,255,255,0.08)] file:text-[#f5f5f5] hover:file:bg-[rgba(255,255,255,0.12)]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-[#a0a0a0] border border-[rgba(255,255,255,0.08)] rounded-xl hover:text-[#f5f5f5] transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={createVideo}
                  disabled={creating || !form.title}
                  className="flex-1 py-2.5 text-sm font-semibold bg-[#F5A623] text-black rounded-xl hover:bg-[#e09615] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Caricamento..." : "Crea video"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
