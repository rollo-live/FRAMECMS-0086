import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Share2, Settings, Download, Droplets, Trash2, Upload } from "lucide-react";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";

type VideoComment = {
  id: string;
  content: string;
  authorName: string;
  timecodeMs: number;
  resolved: boolean;
  createdAt: string;
};

type VideoItem = {
  id: string;
  title: string;
  url: string | null;
  version: string;
  shareToken: string | null;
  allowDownload: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  project?: { name: string };
};

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentTimecode, setCommentTimecode] = useState(0);
  const [posting, setPosting] = useState(false);
  const [activeTimecode, setActiveTimecode] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [vRes, cRes] = await Promise.all([
      api.get(`/api/videos/${id}`),
      api.get(`/api/videos/${id}/comments`),
    ]);
    if (vRes.ok) {
      const d = await vRes.json();
      setVideo(d.video ?? d);
    }
    if (cRes.ok) {
      const d = await cRes.json();
      setComments(
        (d.comments ?? d).sort(
          (a: VideoComment, b: VideoComment) => a.timecodeMs - b.timecodeMs
        )
      );
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleVideoClick = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    setCommentTimecode(Math.floor(vid.currentTime * 1000));
    setActiveTimecode(null);
  };

  const postComment = async () => {
    if (!commentText.trim() || !commentName.trim()) return;
    setPosting(true);
    const res = await api.post(`/api/videos/${id}/comments`, {
      content: commentText,
      authorName: commentName,
      timecodeMs: commentTimecode,
    });
    if (res.ok) {
      const d = await res.json();
      setComments((prev) =>
        [...prev, d.comment ?? d].sort((a, b) => a.timecodeMs - b.timecodeMs)
      );
      setCommentText("");
    }
    setPosting(false);
  };

  const resolveComment = async (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
    );
    await api.patch(`/api/videos/${id}/comments/${commentId}`, { resolved: true });
  };

  const seekToTimecode = (ms: number) => {
    const vid = videoRef.current;
    if (vid) { vid.currentTime = ms / 1000; vid.play(); }
    setActiveTimecode(ms);
  };

  const generateShareLink = async () => {
    const res = await api.post(`/api/videos/${id}/share`);
    if (res.ok) {
      const d = await res.json();
      setVideo((prev) => prev ? { ...prev, shareToken: d.shareToken ?? d.token } : prev);
    }
  };

  const copyLink = () => {
    if (!video?.shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/portale/video/${video.shareToken}`);
  };

  const uploadReplaceFile = async () => {
    if (!replaceFile || !video) return;
    setUploadingFile(true);
    try {
      const presignRes = await api.post("/api/videos/presign", { filename: replaceFile.name, contentType: replaceFile.type });
      if (!presignRes.ok) return;
      const { url: presignUrl, key } = await presignRes.json();
      await fetch(presignUrl, { method: "PUT", body: replaceFile, headers: { "Content-Type": replaceFile.type } });
      const res = await api.patch(`/api/videos/${id}/file`, { r2Key: key });
      if (res.ok) {
        setReplaceFile(null);
        // Reload to get fresh presigned URL
        await load();
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const deleteVideo = async () => {
    if (!confirm("Eliminare il video e tutti i commenti? L'azione è irreversibile.")) return;
    setDeleting(true);
    const res = await api.delete(`/api/videos/${id}`);
    if (res.ok) navigate("/video");
    else setDeleting(false);
  };

  const saveSettings = async () => {
    if (!video) return;
    setSavingSettings(true);
    const res = await api.put(`/api/videos/${id}`, {
      title: video.title,
      version: video.version,
      allowDownload: video.allowDownload,
      watermarkEnabled: video.watermarkEnabled,
      watermarkText: video.watermarkText,
    });
    if (res.ok) {
      const d = await res.json();
      setVideo((prev) => prev ? { ...prev, ...(d.video ?? d) } : prev);
      setShowSettings(false);
    }
    setSavingSettings(false);
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="p-6 text-[var(--text-secondary)]">Caricamento...</div>
      </DashboardLayout>
    );
  if (!video)
    return (
      <DashboardLayout>
        <div className="p-6 text-[var(--text-secondary)]">Video non trovato.</div>
      </DashboardLayout>
    );

  const unresolvedComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-full">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <Link
            to="/video"
            className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-1 shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="text-sm hidden sm:inline">Video</span>
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] truncate">
              {video.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {video.project && (
                <span className="text-sm text-[var(--text-secondary)]">{video.project.name}</span>
              )}
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[var(--primary)22] text-[var(--primary)]">
                {video.version}
              </span>
              {/* Status badges */}
              {video.allowDownload && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-500/10 text-blue-400">
                  <Download size={10} /> Download HD
                </span>
              )}
              {video.watermarkEnabled && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-purple-500/10 text-purple-400">
                  <Droplets size={10} /> Watermark
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={deleteVideo}
              disabled={deleting}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40 bg-transparent cursor-pointer"
              title="Elimina video"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
              title="Impostazioni"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Impostazioni</span>
            </button>
            {video.shareToken ? (
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg)] transition-colors"
              >
                <Copy size={14} />
                <span className="hidden sm:inline">Copia link</span>
              </button>
            ) : (
              <button
                onClick={generateShareLink}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-[var(--primary)] text-white cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">Genera link</span>
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 flex-1">
          {/* Left: video + comment input */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {/* Video player */}
            <div className="bg-black rounded-xl overflow-hidden aspect-video">
              {video.url ? (
                <video
                  ref={videoRef}
                  src={video.url}
                  controls
                  onClick={handleVideoClick}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                  <span className="text-5xl">🎬</span>
                  <span className="text-sm">Nessun video caricato</span>
                </div>
              )}
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Clicca sul video per mettere in pausa e aggiungere un commento al timecode corrente
            </p>

            {/* Comment input */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--primary)22] text-[var(--primary)] cursor-pointer"
                  onClick={() => {
                    const vid = videoRef.current;
                    if (vid) setCommentTimecode(Math.floor(vid.currentTime * 1000));
                  }}
                >
                  @ {formatTimecode(commentTimecode)}
                </button>
                <span className="text-xs text-[var(--text-secondary)]">(clicca per aggiornare dal player)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value)}
                  placeholder="Il tuo nome"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)]"
                />
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                  placeholder="Scrivi un commento..."
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
              <button
                onClick={postComment}
                disabled={posting || !commentText.trim() || !commentName.trim()}
                className="self-end px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "Invio..." : "Aggiungi commento"}
              </button>
            </div>
          </div>

          {/* Right: comments panel */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden lg:w-[340px] lg:min-w-[340px] max-h-[60vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Commenti ({comments.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {comments.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  Nessun commento ancora.
                </p>
              ) : (
                <>
                  {unresolvedComments.map((c) => (
                    <CommentCard key={c.id} comment={c} active={activeTimecode === c.timecodeMs} onSeek={seekToTimecode} onResolve={resolveComment} />
                  ))}
                  {resolvedComments.length > 0 && (
                    <>
                      <div className="text-xs text-[var(--text-secondary)] py-1">
                        Risolti ({resolvedComments.length})
                      </div>
                      {resolvedComments.map((c) => (
                        <CommentCard key={c.id} comment={c} active={false} onSeek={seekToTimecode} onResolve={resolveComment} dimmed />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Settings size={16} /> Impostazioni video
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none cursor-pointer bg-transparent border-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Download HD */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Download size={15} className="text-blue-400" />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Download HD</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Il cliente può scaricare il video in alta qualità dal portale
                  </p>
                </div>
                <button
                  onClick={() => setVideo((v) => v ? { ...v, allowDownload: !v.allowDownload } : v)}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                    video.allowDownload ? "bg-[var(--primary)]" : "bg-[var(--border)]",
                  ].join(" ")}
                  role="switch"
                  aria-checked={video.allowDownload}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                      video.allowDownload ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Watermark */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Droplets size={15} className="text-purple-400" />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Watermark</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sovrappone un watermark al video nel portale cliente
                  </p>
                </div>
                <button
                  onClick={() => setVideo((v) => v ? { ...v, watermarkEnabled: !v.watermarkEnabled } : v)}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                    video.watermarkEnabled ? "bg-[var(--primary)]" : "bg-[var(--border)]",
                  ].join(" ")}
                  role="switch"
                  aria-checked={video.watermarkEnabled}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                      video.watermarkEnabled ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Watermark text (shown when enabled) */}
              {video.watermarkEnabled && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col gap-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Lascia vuoto per usare il logo del tuo studio. Oppure inserisci un testo personalizzato.
                  </p>
                  <input
                    value={video.watermarkText ?? ""}
                    onChange={(e) => setVideo((v) => v ? { ...v, watermarkText: e.target.value || null } : v)}
                    placeholder="Es. © Studio XYZ — Anteprima riservata"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                  {/* Preview */}
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      [anteprima video]
                    </div>
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                      style={{
                        background: "transparent",
                      }}
                    >
                      <span
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: "clamp(10px, 2.5vw, 16px)",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          transform: "rotate(-25deg)",
                          userSelect: "none",
                          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {video.watermarkText || "© Il tuo studio"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

              {/* Replace file */}
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Upload size={15} className="text-[var(--text-secondary)]" />
                  <span className="font-semibold text-sm text-[var(--text-primary)]">Sostituisci file video</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  {video.r2Key ? "Carica un nuovo file — il vecchio verrà eliminato da R2." : "⚠ Nessun file associato. Carica il video."}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                    className="flex-1 text-xs text-[var(--text-secondary)] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--border)] file:text-[var(--text-primary)] hover:file:bg-[var(--bg)] cursor-pointer"
                  />
                  {replaceFile && (
                    <button
                      onClick={uploadReplaceFile}
                      disabled={uploadingFile}
                      className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {uploadingFile ? "Upload..." : "Carica"}
                    </button>
                  )}
                </div>
              </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)] mt-2">
              <button
                onClick={() => { setShowSettings(false); setReplaceFile(null); }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg)] transition-colors bg-transparent"
              >
                Chiudi
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingSettings ? "Salvataggio..." : "Salva impostazioni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function CommentCard({
  comment, active, onSeek, onResolve, dimmed,
}: {
  comment: VideoComment;
  active: boolean;
  onSeek: (ms: number) => void;
  onResolve: (id: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg p-3 border transition-all",
        active ? "bg-[var(--primary)11] border-[var(--primary)]" : "bg-[var(--bg)] border-[var(--border)]",
        dimmed ? "opacity-50" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={() => onSeek(comment.timecodeMs)}
          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)22] text-[var(--primary)] border-none cursor-pointer"
        >
          {formatTimecode(comment.timecodeMs)}
        </button>
        <span className="flex-1 font-semibold text-sm text-[var(--text-primary)] truncate">
          {comment.authorName}
        </span>
        {!comment.resolved && (
          <button
            onClick={() => onResolve(comment.id)}
            title="Segna come risolto"
            className="border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] bg-transparent cursor-pointer hover:border-green-500 hover:text-green-500 transition-colors"
          >
            ✓
          </button>
        )}
      </div>
      <p className="m-0 text-sm text-[var(--text-primary)]">{comment.content}</p>
    </div>
  );
}
