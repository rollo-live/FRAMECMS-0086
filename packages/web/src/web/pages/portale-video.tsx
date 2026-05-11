import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";

type VideoComment = {
  id: string;
  content: string;
  authorName: string;
  timecodeMs: number;
  resolved: boolean;
  createdAt: string;
};

type VideoData = {
  video: {
    id: string;
    title: string;
    url: string | null;
    version: string;
  };
  comments: VideoComment[];
  tenant: { brandName: string; primaryColor: string; logoUrl: string | null };
};

const CLIENT_TOKEN_KEY = "frame_client_token";

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function PortaleVideo() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentTimecode, setCommentTimecode] = useState(0);
  const [posting, setPosting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientToken = localStorage.getItem(CLIENT_TOKEN_KEY);

  const load = useCallback(async () => {
    if (!token) return;
    const headers: Record<string, string> = {};
    if (clientToken) headers["x-client-token"] = clientToken;

    try {
      const res = await fetch(`/api/videos/shared/${token}`, { headers });
      if (!res.ok) throw new Error("Video non trovato o link scaduto");
      const d: VideoData = await res.json();
      setData(d);
      setComments((d.comments ?? []).sort((a, b) => a.timecodeMs - b.timecodeMs));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, clientToken]);

  useEffect(() => { load(); }, [load]);

  const handleVideoClick = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    setCommentTimecode(Math.floor(vid.currentTime * 1000));
  };

  const postComment = async () => {
    if (!commentText.trim() || !commentName.trim()) return;
    setPosting(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["x-client-token"] = clientToken;

    const res = await fetch(`/api/videos/shared/${token}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: commentText,
        authorName: commentName,
        timecodeMs: commentTimecode,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      const newComment = d.comment ?? d;
      setComments((prev) => [...prev, newComment].sort((a, b) => a.timecodeMs - b.timecodeMs));
      setCommentText("");
    }
    setPosting(false);
  };

  const seekToTimecode = (ms: number) => {
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = ms / 1000;
      vid.play();
    }
  };

  const primaryColor = data?.tenant?.primaryColor ?? "#6366f1";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#64748b" }}>Caricamento video...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444" }}>⚠️ {error ?? "Errore"}</p>
        </div>
      </div>
    );
  }

  const unresolvedComments = comments.filter((c) => !c.resolved);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      {/* Header */}
      <div
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {data.tenant.logoUrl ? (
          <img src={data.tenant.logoUrl} alt="Logo" style={{ height: "28px", objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: "1rem", color: primaryColor }}>
            {data.tenant.brandName}
          </span>
        )}
        <div style={{ width: "1px", height: "16px", background: "#334155" }} />
        <h1 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#f1f5f9", flex: 1 }}>
          {data.video.title}
        </h1>
        <span
          style={{
            padding: "0.2rem 0.6rem",
            background: primaryColor + "22",
            color: primaryColor,
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {data.video.version}
        </span>
      </div>

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "calc(100vh - 60px)" }}>
        {/* Left: video + comment input */}
        <div style={{ display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem" }}>
          {/* Player */}
          <div
            style={{
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
              aspectRatio: "16/9",
              flex: "0 0 auto",
            }}
          >
            {data.video.url ? (
              <video
                ref={videoRef}
                src={data.video.url}
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
                  color: "#475569",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "3rem" }}>🎬</span>
                <span style={{ fontSize: "0.875rem" }}>Video non disponibile</span>
              </div>
            )}
          </div>

          <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
            Clicca sul video per mettere in pausa e aggiungere un feedback al momento attuale
          </p>

          {/* Comment input */}
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  background: primaryColor + "22",
                  color: primaryColor,
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
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>clicca per aggiornare</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Il tuo nome"
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  background: "#0f172a",
                  color: "#f1f5f9",
                  fontSize: "0.875rem",
                }}
              />
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                placeholder="Scrivi il tuo feedback..."
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  background: "#0f172a",
                  color: "#f1f5f9",
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
                background: primaryColor,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
                opacity: posting || !commentText.trim() || !commentName.trim() ? 0.5 : 1,
              }}
            >
              {posting ? "Invio..." : "Aggiungi feedback"}
            </button>
          </div>
        </div>

        {/* Right: comments */}
        <div
          style={{
            background: "#1e293b",
            borderLeft: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #334155" }}>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "0.9rem" }}>
              Feedback ({unresolvedComments.length})
            </h3>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {comments.length === 0 ? (
              <p style={{ color: "#475569", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
                Nessun feedback ancora. Clicca sul video per aggiungerne uno!
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  onClick={() => seekToTimecode(c.timecodeMs)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    cursor: "pointer",
                    opacity: c.resolved ? 0.4 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                    <span
                      style={{
                        padding: "0.1rem 0.4rem",
                        background: primaryColor + "22",
                        color: primaryColor,
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >
                      {formatTimecode(c.timecodeMs)}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "#f1f5f9", flex: 1 }}>
                      {c.authorName}
                    </span>
                    {c.resolved && (
                      <span style={{ fontSize: "0.7rem", color: "#10b981" }}>✓</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#cbd5e1" }}>{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
