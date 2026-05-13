import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { ArrowLeft, Link2, Upload, X, Check, Settings, Users, Trash2, ScanFace, User } from "lucide-react";

type FaceTag = { id: string; nome: string };
type Photo = { id: string; url: string; filename: string; likeCount: number; comments?: Comment[]; persone?: FaceTag[] };
type Comment = { id: string; content: string; authorName: string; createdAt: string };
type Gallery = {
  id: string; title: string; watermarkEnabled: boolean; shareToken: string | null;
  downloadEnabled?: boolean; accessGate?: boolean; accessApproval?: "auto" | "manual";
  likeLimit?: number; project?: { name: string };
};
type AccessRequest = { id: string; firstName: string; lastName: string; email: string; status: string; createdAt: string };

export default function GalleryDetail() {
  const { id } = useParams<{ id: string }>();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [comment, setComment] = useState("");
  const [commentName, setCommentName] = useState("");
  const [posting, setPosting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ newPersone: number; newFaces: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api.get(`/api/galleries/${id}`);
    if (res.ok) {
      const d = await res.json();
      setGallery(d.gallery ?? d);
      setPhotos(d.photos ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (!id || files.length === 0) return;
    setUploading(true);
    try {
      // 1. Batch presign
      const presignRes = await api.post(`/api/galleries/${id}/presign`, {
        files: files.map((f) => ({ filename: f.name, contentType: f.type })),
      });
      if (!presignRes.ok) { setUploading(false); return; }
      const { urls } = await presignRes.json() as { urls: { key: string; url: string; filename: string }[] };

      // 2. Upload all files to S3 in parallel
      await Promise.all(
        urls.map((u, i) =>
          fetch(u.url, { method: "PUT", body: files[i], headers: { "Content-Type": files[i].type } })
        )
      );

      // 3. Batch confirm — save photo records
      const confirmRes = await api.post(`/api/galleries/${id}/photos`, {
        photos: urls.map((u) => ({ filename: u.filename, r2Key: u.key })),
      });
      if (confirmRes.ok) {
        const d = await confirmRes.json();
        // Reload gallery to get presigned GET URLs for new photos
        await load();
        // Trigger face analysis in background (non-blocking)
        const newPhotoIds = (d.photos ?? []).map((p: any) => p.id);
        if (newPhotoIds.length > 0) {
          api.post(`/api/galleries/${id}/photos/analyze`, { photoIds: newPhotoIds })
            .then(async (r) => {
              if (r.ok) {
                const ar = await r.json() as any;
                if (ar.newPersone > 0 || ar.newFaces > 0) {
                  setAnalyzeResult({ newPersone: ar.newPersone, newFaces: ar.newFaces });
                  setTimeout(() => setAnalyzeResult(null), 5000);
                }
              }
            })
            .catch(() => { /* ignore */ });
        }
      }
    } catch (e) {
      console.error("Upload failed", e);
    }
    setUploading(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    uploadFiles(Array.from(files).filter((f) => f.type.startsWith("image/")));
  };

  const openPhoto = async (photo: Photo) => {
    setSelectedPhoto(photo);
    // Load comments + face tags in parallel
    const [commentsRes, personeRes] = await Promise.all([
      api.get(`/api/galleries/photos/${photo.id}/comments`),
      api.get(`/api/galleries/photos/${photo.id}/persone`),
    ]);
    if (commentsRes.ok) {
      const d = await commentsRes.json();
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, comments: d.comments ?? d } : p)));
      setSelectedPhoto((prev) => prev ? { ...prev, comments: d.comments ?? d } : prev);
    }
    if (personeRes.ok) {
      const d = await personeRes.json() as any;
      const persone: FaceTag[] = d.persone ?? [];
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, persone } : p)));
      setSelectedPhoto((prev) => prev ? { ...prev, persone } : prev);
    }
  };

  const postComment = async () => {
    if (!selectedPhoto || !comment.trim() || !commentName.trim()) return;
    setPosting(true);
    const res = await api.post(`/api/galleries/photos/${selectedPhoto.id}/comments`, { content: comment, authorName: commentName });
    if (res.ok) {
      const d = await res.json();
      setSelectedPhoto((prev) => prev ? { ...prev, comments: [...(prev.comments ?? []), d.comment ?? d] } : prev);
      setComment("");
    }
    setPosting(false);
  };

  const toggleWatermark = async () => {
    if (!gallery) return;
    const newVal = !gallery.watermarkEnabled;
    setGallery({ ...gallery, watermarkEnabled: newVal });
    await api.put(`/api/galleries/${id}`, { ...gallery, watermarkEnabled: newVal });
  };

  const updateSettings = async (patch: Partial<Gallery>) => {
    if (!gallery) return;
    const updated = { ...gallery, ...patch };
    setGallery(updated);
    await api.put(`/api/galleries/${id}`, updated);
  };

  const loadAccessRequests = async () => {
    if (!id) return;
    setLoadingAccess(true);
    const res = await api.get(`/api/galleries/${id}/access`);
    if (res.ok) {
      const d = await res.json();
      setAccessRequests(d.requests ?? []);
    }
    setLoadingAccess(false);
  };

  const handleAccessDecision = async (accessId: string, status: "approved" | "rejected") => {
    await api.patch(`/api/galleries/${id}/access/${accessId}`, { status });
    setAccessRequests(prev => prev.map(r => r.id === accessId ? { ...r, status } : r));
  };

  const deletePhoto = async (photoId: string) => {
    setDeletingPhoto(photoId);
    const res = await api.delete(`/api/galleries/${id}/photos/${photoId}`);
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (selectedPhoto?.id === photoId) setSelectedPhoto(null);
    }
    setDeletingPhoto(null);
  };

  const analyzeAll = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      const r = await api.post(`/api/galleries/${id}/photos/analyze`, {});
      if (r.ok) {
        const d = await r.json() as any;
        setAnalyzeResult({ newPersone: d.newPersone, newFaces: d.newFaces });
        setTimeout(() => setAnalyzeResult(null), 6000);
      }
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const generateShareLink = async () => {
    if (!id) return;
    const res = await api.post(`/api/galleries/${id}/share`);
    if (res.ok) {
      const d = await res.json();
      setGallery((prev) => prev ? { ...prev, shareToken: d.shareToken ?? d.token } : prev);
    }
  };

  const copyLink = () => {
    if (!gallery?.shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/portale/gallery/${gallery.shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <DashboardLayout><div className="p-4 sm:p-8 text-[#a0a0a0] text-sm">Caricamento...</div></DashboardLayout>;
  if (!gallery) return <DashboardLayout><div className="p-4 sm:p-8 text-[#a0a0a0] text-sm">Gallery non trovata.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link to="/gallery" className="p-1.5 rounded-lg text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-[#f5f5f5] truncate">{gallery.title}</h1>
            {gallery.project && <p className="text-xs text-[#a0a0a0] mt-0.5">{gallery.project.name}</p>}
          </div>
          {/* Analizza volti */}
          <button
            onClick={analyzeAll}
            disabled={analyzing}
            title="Analizza volti con AI e crea album per persona"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[rgba(255,255,255,0.08)] text-[#a0a0a0] hover:text-[#F5A623] hover:border-[rgba(245,166,35,0.3)] transition-all disabled:opacity-50"
          >
            <ScanFace size={12} /> <span className="hidden sm:inline">{analyzing ? "Analisi..." : "Analizza"}</span>
          </button>
          {/* Settings button */}
          <button
            onClick={() => { setShowSettings(s => !s); if (!showSettings && gallery.accessGate) loadAccessRequests(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${showSettings ? "bg-[rgba(245,166,35,0.1)] border-[rgba(245,166,35,0.3)] text-[#F5A623]" : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#a0a0a0] hover:text-[#f5f5f5]"}`}
          >
            <Settings size={12} /> Impostazioni
          </button>
          {/* Share button */}
          {gallery.shareToken ? (
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${copied ? "bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.3)] text-green-400" : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#a0a0a0] hover:text-[#f5f5f5]"}`}
            >
              {copied ? <><Check size={12} /> Copiato</> : <><Link2 size={12} /> Copia link</>}
            </button>
          ) : (
            <button
              onClick={generateShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F5A623] text-black rounded-lg hover:bg-[#e09615] transition-colors"
            >
              <Link2 size={12} /> Genera link
            </button>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-6 bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[#f5f5f5] mb-3">Impostazioni Gallery</h2>

            {/* Row: Watermark + Download */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#f5f5f5] font-medium">Watermark</p>
                  <p className="text-xs text-[#555]">Applica filigrana sulle foto</p>
                </div>
                <button
                  onClick={() => updateSettings({ watermarkEnabled: !gallery.watermarkEnabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${gallery.watermarkEnabled ? "bg-[#F5A623]" : "bg-[rgba(255,255,255,0.1)]"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${gallery.watermarkEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#f5f5f5] font-medium">Download</p>
                  <p className="text-xs text-[#555]">Permetti download alle foto</p>
                </div>
                <button
                  onClick={() => updateSettings({ downloadEnabled: !gallery.downloadEnabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${gallery.downloadEnabled ? "bg-[#F5A623]" : "bg-[rgba(255,255,255,0.1)]"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${gallery.downloadEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[rgba(255,255,255,0.06)]" />

            {/* Access Gate */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#f5f5f5] font-medium">Accesso con registrazione</p>
                <p className="text-xs text-[#555]">I visitatori devono inserire nome, cognome ed email</p>
              </div>
              <button
                onClick={() => updateSettings({ accessGate: !gallery.accessGate })}
                className={`relative w-10 h-5 rounded-full transition-colors ${gallery.accessGate ? "bg-[#F5A623]" : "bg-[rgba(255,255,255,0.1)]"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${gallery.accessGate ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>

            {gallery.accessGate && (
              <div className="ml-4 space-y-3">
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="approval"
                      checked={gallery.accessApproval !== "manual"}
                      onChange={() => updateSettings({ accessApproval: "auto" })}
                      className="accent-[#F5A623]"
                    />
                    <span className="text-sm text-[#a0a0a0]">Approvazione automatica</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="approval"
                      checked={gallery.accessApproval === "manual"}
                      onChange={() => updateSettings({ accessApproval: "manual" })}
                      className="accent-[#F5A623]"
                    />
                    <span className="text-sm text-[#a0a0a0]">Approvazione manuale</span>
                  </label>
                </div>

                {/* Access requests */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-[#a0a0a0]" />
                    <span className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider">Richieste di accesso</span>
                    <button onClick={loadAccessRequests} className="text-[10px] text-[#555] hover:text-[#a0a0a0] underline ml-auto">
                      Aggiorna
                    </button>
                  </div>
                  {loadingAccess ? (
                    <p className="text-xs text-[#555]">Caricamento...</p>
                  ) : accessRequests.length === 0 ? (
                    <p className="text-xs text-[#555]">Nessuna richiesta ancora.</p>
                  ) : (
                    <div className="space-y-2">
                      {accessRequests.map(r => (
                        <div key={r.id} className="flex items-center gap-3 bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.05)]">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#f5f5f5] truncate">{r.firstName} {r.lastName}</p>
                            <p className="text-[11px] text-[#555] truncate">{r.email}</p>
                          </div>
                          {r.status === "pending" ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleAccessDecision(r.id, "approved")}
                                className="px-2 py-1 text-[11px] font-semibold bg-[rgba(16,185,129,0.15)] text-green-400 border border-[rgba(16,185,129,0.3)] rounded-md hover:bg-[rgba(16,185,129,0.25)] transition-colors"
                              >
                                ✓ Approva
                              </button>
                              <button
                                onClick={() => handleAccessDecision(r.id, "rejected")}
                                className="px-2 py-1 text-[11px] font-semibold bg-[rgba(239,68,68,0.1)] text-red-400 border border-[rgba(239,68,68,0.3)] rounded-md hover:bg-[rgba(239,68,68,0.2)] transition-colors"
                              >
                                ✗ Nega
                              </button>
                            </div>
                          ) : (
                            <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${r.status === "approved" ? "bg-[rgba(16,185,129,0.1)] text-green-400" : "bg-[rgba(239,68,68,0.1)] text-red-400"}`}>
                              {r.status === "approved" ? "Approvato" : "Negato"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[rgba(255,255,255,0.06)]" />

            {/* Like Limit */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#f5f5f5] font-medium">Limite selezioni (like)</p>
                <p className="text-xs text-[#555]">Max foto che un cliente può selezionare (0 = illimitato)</p>
              </div>
              <input
                type="number"
                min={0}
                max={9999}
                value={gallery.likeLimit ?? 0}
                onChange={e => updateSettings({ likeLimit: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1.5 text-sm text-center bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] rounded-lg text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Drop zone */}
        {/* Banner risultato analisi */}
        {analyzeResult && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-xl text-sm text-[#F5A623]">
            <ScanFace size={15} />
            <span>
              Analisi completata — {analyzeResult.newFaces} {analyzeResult.newFaces === 1 ? "volto rilevato" : "volti rilevati"}
              {analyzeResult.newPersone > 0 && `, ${analyzeResult.newPersone} nuov${analyzeResult.newPersone === 1 ? "a persona" : "e persone"} create`}
              {analyzeResult.newPersone === 0 && analyzeResult.newFaces > 0 && " (già categorizzati)"}
            </span>
            <Link to="/gallery/persone" className="ml-auto text-xs underline hover:no-underline">Vedi persone →</Link>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer mb-6 transition-all ${dragActive ? "border-[#F5A623] bg-[rgba(245,166,35,0.05)]" : "border-[rgba(255,255,255,0.1)] bg-[#111] hover:border-[rgba(255,255,255,0.2)]"}`}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Upload size={24} className={`mx-auto mb-2 ${dragActive ? "text-[#F5A623]" : "text-[#444]"}`} />
          {uploading ? (
            <p className="text-[#F5A623] text-sm font-medium">Upload in corso...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-[#f5f5f5]">Trascina foto qui o clicca per selezionare</p>
              <p className="text-xs text-[#555] mt-1">JPG, PNG, WebP — upload multiplo supportato</p>
            </>
          )}
        </div>

        {/* Photo grid */}
        {photos.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-8">Nessuna foto ancora.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-[#111] group"
              >
                <img
                  src={photo.url}
                  alt={photo.filename}
                  onClick={() => openPhoto(photo)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {photo.likeCount > 0 && (
                  <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] rounded-full px-1.5 py-0.5">
                    ❤️ {photo.likeCount}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                  disabled={deletingPhoto === photo.id}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  title="Elimina foto"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhoto(null); }}
        >
          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-4 min-w-0">
            <img src={selectedPhoto.url} alt={selectedPhoto.filename} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
          {/* Comments + Persone sidebar */}
          <div className="w-[280px] sm:w-[320px] shrink-0 bg-[#111] border-l border-[rgba(255,255,255,0.07)] flex flex-col">
            {/* Persone tag */}
            {(selectedPhoto.persone ?? []).length > 0 && (
              <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex flex-wrap gap-1.5">
                {(selectedPhoto.persone ?? []).map((p) => (
                  <Link
                    key={p.id}
                    to="/gallery/persone"
                    onClick={() => setSelectedPhoto(null)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-[11px] font-medium rounded-full hover:bg-[#F5A623]/20 transition-colors"
                  >
                    <User size={10} /> {p.nome}
                  </Link>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
              <h3 className="text-sm font-semibold text-[#f5f5f5]">Commenti</h3>
              <button onClick={() => setSelectedPhoto(null)} className="p-1 rounded-lg text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(selectedPhoto.comments ?? []).length === 0 ? (
                <p className="text-[#555] text-xs text-center py-4">Nessun commento ancora.</p>
              ) : (
                (selectedPhoto.comments ?? []).map((c) => (
                  <div key={c.id} className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-lg p-2.5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-[#f5f5f5]">{c.authorName}</span>
                      <span className="text-[10px] text-[#555]">{new Date(c.createdAt).toLocaleDateString("it-IT")}</span>
                    </div>
                    <p className="text-xs text-[#a0a0a0]">{c.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-[rgba(255,255,255,0.07)] space-y-2">
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Il tuo nome"
                className="w-full px-3 py-2 text-xs bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors"
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Scrivi un commento..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors resize-none"
              />
              <button
                onClick={postComment}
                disabled={posting || !comment.trim() || !commentName.trim()}
                className="w-full py-2 text-xs font-semibold bg-[#F5A623] text-black rounded-lg hover:bg-[#e09615] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? "Invio..." : "Commenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
