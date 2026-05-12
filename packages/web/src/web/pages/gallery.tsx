import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Plus, Image as ImageIcon, Link2, Check, ExternalLink, Trash2 } from "lucide-react";

type Gallery = {
  id: string;
  title: string;
  projectId: string;
  project?: { name: string };
  photoCount?: number;
  coverUrl?: string | null;
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get("projectId");

  useEffect(() => {
    Promise.all([api.get("/api/galleries"), api.get("/api/projects")]).then(([gRes, pRes]) => {
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
      setGalleries((prev) => prev.map((g) => (g.id === galleryId ? { ...g, shareToken: d.shareToken ?? d.token } : g)));
    }
  };

  const deleteGallery = async (id: string) => {
    setDeleting(id);
    const res = await api.delete(`/api/galleries/${id}`);
    if (res.ok) {
      setGalleries((prev) => prev.filter((g) => g.id !== id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/portale/gallery/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const displayed = filterProjectId ? galleries.filter((g) => g.projectId === filterProjectId) : galleries;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">Gallery</h1>
            <p className="text-sm text-[#a0a0a0] mt-0.5">Condividi le foto con i tuoi clienti</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#F5A623] hover:bg-[#e09615] text-black text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Nuova gallery</span><span className="sm:hidden">Nuova</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-52 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)] animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl text-center">
            <ImageIcon size={36} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm mb-4">Nessuna gallery ancora</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#F5A623] text-black text-sm font-semibold rounded-xl hover:bg-[#e09615] transition-colors"
            >
              <Plus size={14} /> Crea la prima gallery
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((gallery) => (
              <div key={gallery.id} className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden hover:border-[rgba(255,255,255,0.12)] transition-colors">
                {/* Preview / Cover */}
                <div className="h-36 bg-[#0a0a0a] overflow-hidden relative">
                  {gallery.coverUrl ? (
                    <img src={gallery.coverUrl} alt={gallery.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[rgba(245,166,35,0.1)] to-[rgba(245,166,35,0.05)] flex items-center justify-center">
                      <ImageIcon size={32} className="text-[rgba(245,166,35,0.3)]" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#f5f5f5] text-sm truncate">{gallery.title}</h3>
                      {gallery.project && (
                        <p className="text-xs text-[#a0a0a0] mt-0.5 truncate">{gallery.project.name}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[#666] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">
                      {gallery.photoCount ?? 0} foto
                    </span>
                  </div>
                  {confirmDelete === gallery.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2 text-xs font-medium text-[#a0a0a0] border border-[rgba(255,255,255,0.08)] rounded-lg hover:text-[#f5f5f5] transition-colors"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => deleteGallery(gallery.id)}
                        disabled={deleting === gallery.id}
                        className="flex-1 py-2 text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      >
                        {deleting === gallery.id ? "Elimino..." : "Conferma"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Link
                        to={`/gallery/${gallery.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-[#F5A623] text-black rounded-lg hover:bg-[#e09615] transition-colors"
                      >
                        <ExternalLink size={12} /> Apri
                      </Link>
                      {gallery.shareToken ? (
                        <button
                          onClick={() => copyLink(gallery.shareToken!)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border transition-all ${copied === gallery.shareToken ? "bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.3)] text-green-400" : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#a0a0a0] hover:text-[#f5f5f5]"}`}
                        >
                          {copied === gallery.shareToken ? <><Check size={12} /> Copiato</> : <><Link2 size={12} /> Copia link</>}
                        </button>
                      ) : (
                        <button
                          onClick={() => generateShareLink(gallery.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-transparent border border-[rgba(255,255,255,0.08)] text-[#a0a0a0] hover:text-[#f5f5f5] rounded-lg transition-colors"
                        >
                          <Link2 size={12} /> Genera link
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(gallery.id)}
                        className="p-2 text-[#555] hover:text-red-400 border border-[rgba(255,255,255,0.08)] rounded-lg hover:border-red-500/30 transition-colors"
                        title="Elimina gallery"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
            <h2 className="text-lg font-bold text-[#f5f5f5] mb-5">Nuova gallery</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Nome gallery</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="es. Matrimonio Rossi - Foto finali"
                  className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wide block mb-1.5">Progetto (opzionale)</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
                >
                  <option value="">Nessun progetto</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-[#a0a0a0] border border-[rgba(255,255,255,0.08)] rounded-xl hover:text-[#f5f5f5] transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={createGallery}
                  disabled={creating || !form.name}
                  className="flex-1 py-2.5 text-sm font-semibold bg-[#F5A623] text-black rounded-xl hover:bg-[#e09615] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Creazione..." : "Crea gallery"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
