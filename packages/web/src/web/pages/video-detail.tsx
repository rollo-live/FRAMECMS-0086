import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
      setComments((d.comments ?? d).sort((a: VideoComment, b: VideoComment) => a.timecodeMs - b.timecodeMs));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
      setVideo((prev) => prev ? { ...prev, shareToken: d.shareToken ?? d.token } : prev);
    }
  };

  const copyLink = () => {
    if (!video?.shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/portale/video/${video.shareToken}`);
  };

  if (loading) return <DashboardLayout><div style={{ padding: "2rem", color: "var(--text-secondary)" }}>Caricamento...</div></DashboardLayout>;
  if (!video) return <DashboardLayout><div style={{ padding: "2rem", color: "var(--text-secondary)" }}>Video non trovato.</div></DashboardLayout>;

  const unresolvedComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  return (
    <DashboardLayout>
    <div style={{ padding: "2rem", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link to="/video" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}>
          ← Video
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {video.title}
          </h1>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            {video.project && (
              <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{video.project.name}</span>
            )}
            <span
              style={{
                padding: "0.1rem 0.5rem",
                background: "var(--primary)22",
                color: "var(--primary)",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {video.version}
            </span>
          </div>
        </div>
        {video.shareToken ? (
          <button
            onClick={copyLink}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Copia link cliente
          </button>
        ) : (
          <button
            onClick={generateShareLink}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            Genera link
          </button>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem", flex: 1, overflow: "hidden" }}>
        {/* Video player */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
              position: "relative",
              aspectRatio: "16/9",
            }}
          >
            {video.url ? (
              <video
                ref={videoRef}
                src={video.url}
                controls
                onClick={handleVideoClick}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "3rem" }}>🎬</span>
                <span>Nessun video caricato</span>
              </div>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Clicca sul video per mettere in pausa e aggiungere un commento al timecode corrente
          </p>

          {/* Comment input */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  padding: "0.25rem 0.6rem",
                  background: "var(--primary)22",
                  color: "var(--primary)",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => {
                  const vid = videoRef.current;
                  if (vid) setCommentTimecode(Math.floor(vid.currentTime * 1000));
                }}
              >
                @ {formatTimecode(commentTimecode)}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                (clicca per aggiornare dal player)
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Il tuo nome"
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                }}
              />
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                placeholder="Scrivi un commento..."
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <button
              onClick={postComment}
              disabled={posting || !commentText.trim() || !commentName.trim()}
              style={{
                alignSelf: "flex-end",
                padding: "0.5rem 1.25rem",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
                opacity: posting || !commentText.trim() || !commentName.trim() ? 0.6 : 1,
              }}
            >
              {posting ? "Invio..." : "Aggiungi commento"}
            </button>
          </div>
        </div>

        {/* Comments sidebar */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>
              Commenti ({comments.length})
            </h3>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {comments.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
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
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0.5rem 0" }}>
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
      style={{
        background: active ? "var(--primary)11" : "var(--bg)",
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "8px",
        padding: "0.75rem",
        opacity: dimmed ? 0.5 : 1,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
        <button
          onClick={() => onSeek(comment.timecodeMs)}
          style={{
            padding: "0.15rem 0.4rem",
            background: "var(--primary)22",
            color: "var(--primary)",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        >
          {formatTimecode(comment.timecodeMs)}
        </button>
        <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)", flex: 1 }}>
          {comment.authorName}
        </span>
        {!comment.resolved && (
          <button
            onClick={() => onResolve(comment.id)}
            title="Segna come risolto"
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.7rem",
              padding: "0.1rem 0.4rem",
            }}
          >
            ✓
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)" }}>{comment.content}</p>
    </div>
  );
}
