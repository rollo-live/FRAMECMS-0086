import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
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

  useEffect(() => {
    load();
  }, [load]);

  const handleVideoClick = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    const ms = Math.floor(vid.currentTime * 1000);
    setCommentTimecode(ms);
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
      const newComment = d.comment ?? d;
      setComments((prev) =>
        [...prev, newComment].sort((a, b) => a.timecodeMs - b.timecodeMs)
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
    if (vid) {
      vid.currentTime = ms / 1000;
      vid.play();
    }
    setActiveTimecode(ms);
  };

  const generateShareLink = async () => {
    const res = await api.post(`/api/videos/${id}/share`);
    if (res.ok) {
      const d = await res.json();
      setVideo((prev) =>
        prev ? { ...prev, shareToken: d.shareToken ?? d.token } : prev
      );
    }
  };

  const copyLink = () => {
    if (!video?.shareToken) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/portale/video/${video.shareToken}`
    );
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
                <span className="text-sm text-[var(--text-secondary)]">
                  {video.project.name}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[var(--primary)22] text-[var(--primary)]">
                {video.version}
              </span>
            </div>
          </div>

          {/* Share button */}
          <div className="shrink-0">
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

        {/* Main content: stacks vertically on mobile, side-by-side on lg */}
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
                <span className="text-xs text-[var(--text-secondary)]">
                  (clicca per aggiornare dal player)
                </span>
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") postComment();
                  }}
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
                    <CommentCard
                      key={c.id}
                      comment={c}
                      active={activeTimecode === c.timecodeMs}
                      onSeek={seekToTimecode}
                      onResolve={resolveComment}
                    />
                  ))}
                  {resolvedComments.length > 0 && (
                    <>
                      <div className="text-xs text-[var(--text-secondary)] py-1">
                        Risolti ({resolvedComments.length})
                      </div>
                      {resolvedComments.map((c) => (
                        <CommentCard
                          key={c.id}
                          comment={c}
                          active={false}
                          onSeek={seekToTimecode}
                          onResolve={resolveComment}
                          dimmed
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CommentCard({
  comment,
  active,
  onSeek,
  onResolve,
  dimmed,
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
        active
          ? "bg-[var(--primary)11] border-[var(--primary)]"
          : "bg-[var(--bg)] border-[var(--border)]",
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
