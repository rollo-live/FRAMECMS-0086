import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { ArrowLeft, User, Pencil, Trash2, Check, X, Users } from "lucide-react";

type Persona = {
  id: string;
  nome: string;
  photoCount: number;
  coverUrl: string | null;
  visibileASoci: boolean;
};

type Foto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  likeCount: number;
  faceBox: { x: number; y: number; width: number; height: number } | null;
};

// ─── Album di una persona ─────────────────────────────────────────────────────
function PersonaAlbum({ personaId, onBack }: { personaId: string; onBack: () => void }) {
  const [persona, setPersona] = useState<{ id: string; nome: string } | null>(null);
  const [foto, setFoto] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Foto | null>(null);

  useEffect(() => {
    api.get(`/api/galleries/persone/${personaId}/foto`).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as any;
        setPersona(d.persona);
        setFoto(d.foto ?? []);
      }
      setLoading(false);
    });
  }, [personaId]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#a0a0a0] hover:text-white mb-4 transition-colors">
        <ArrowLeft size={15} /> Tutte le persone
      </button>
      <h2 className="text-lg font-bold text-white mb-1">{persona?.nome ?? "Persona"}</h2>
      <p className="text-sm text-[#a0a0a0] mb-5">{foto.length} foto</p>

      {foto.length === 0 ? (
        <p className="text-sm text-[#666]">Nessuna foto per questa persona.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {foto.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className="aspect-square rounded-lg overflow-hidden bg-[#2a2a2a] group relative"
            >
              {f.thumbnailUrl || f.url ? (
                <img src={f.thumbnailUrl ?? f.url} alt={f.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={24} className="text-[#555]" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setSelected(null)}>
            <X size={24} />
          </button>
          <img
            src={selected.url}
            alt={selected.filename}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Griglia persone ──────────────────────────────────────────────────────────
export default function GalleryPersonePage() {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api.get("/api/galleries/persone");
    if (r.ok) {
      const d = await r.json() as any;
      setPersone(d.persone ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveNome = async (id: string) => {
    if (!editNome.trim()) return;
    const r = await api.put(`/api/galleries/persone/${id}`, { nome: editNome.trim() });
    if (r.ok) {
      setPersone((prev) => prev.map((p) => p.id === id ? { ...p, nome: editNome.trim() } : p));
    }
    setEditingId(null);
  };

  const deletePersona = async (id: string) => {
    setDeletingId(id);
    const r = await api.delete(`/api/galleries/persone/${id}`);
    if (r.ok) {
      setPersone((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  if (selectedPersonaId) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <PersonaAlbum personaId={selectedPersonaId} onBack={() => setSelectedPersonaId(null)} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Link to="/gallery" className="text-[#a0a0a0] hover:text-white transition-colors">
                <ArrowLeft size={16} />
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">Persone</h1>
            </div>
            <p className="text-sm text-[#a0a0a0] ml-6">Album automatici generati con AI</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : persone.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center">
              <Users size={24} className="text-[#555]" />
            </div>
            <p className="text-[#a0a0a0] text-sm">Nessuna persona rilevata ancora.<br />Carica delle foto e analizzale dalla gallery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {persone.map((p) => (
              <div key={p.id} className="group relative">
                {/* Card */}
                <button
                  className="w-full aspect-square rounded-xl overflow-hidden bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#F5A623]/40 transition-all duration-200 relative"
                  onClick={() => setSelectedPersonaId(p.id)}
                >
                  {p.coverUrl ? (
                    <img src={p.coverUrl} alt={p.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={36} className="text-[#444]" />
                    </div>
                  )}
                  {/* overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-white/80">{p.photoCount} foto</span>
                  </div>
                </button>

                {/* Nome + azioni */}
                <div className="mt-2 flex items-center gap-1">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        autoFocus
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveNome(p.id); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 bg-[#2a2a2a] text-white text-xs rounded px-2 py-1 border border-[#3a3a3a] outline-none focus:border-[#F5A623]"
                      />
                      <button onClick={() => saveNome(p.id)} className="text-green-400 hover:text-green-300">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-[#666] hover:text-white">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-medium text-[#e0e0e0] truncate">{p.nome}</span>
                      <button
                        onClick={() => { setEditingId(p.id); setEditNome(p.nome); }}
                        className="text-[#555] hover:text-[#F5A623] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-[#666] mt-0.5">{p.photoCount} foto</p>

                {/* Confirm delete overlay */}
                {confirmDeleteId === p.id && (
                  <div className="absolute inset-0 bg-black/80 rounded-xl flex flex-col items-center justify-center gap-2 z-10">
                    <p className="text-white text-xs text-center px-2">Elimina persona?<br /><span className="text-[#aaa]">Le foto restano.</span></p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deletePersona(p.id)}
                        disabled={deletingId === p.id}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-50"
                      >
                        {deletingId === p.id ? "..." : "Elimina"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 bg-[#333] hover:bg-[#444] text-white text-xs rounded-lg"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
