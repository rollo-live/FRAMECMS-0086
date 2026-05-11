import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";

type Photo = {
  id: string;
  url: string;
  filename: string;
  likeCount: number;
  likedByMe?: boolean;
  comments?: Comment[];
};

type Comment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

type GalleryData = {
  gallery: {
    id: string;
    name: string;
    watermarkEnabled: boolean;
  };
  photos: Photo[];
  tenant: { brandName: string; primaryColor: string; logoUrl: string | null };
  clientToken: string;
};

const CLIENT_TOKEN_KEY = "frame_client_token";

export default function PortaleGallery() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [comment, setComment] = useState("");
  const [commentName, setCommentName] = useState("");
  const [posting, setPosting] = useState(false);
  const clientToken = localStorage.getItem(CLIENT_TOKEN_KEY);

  const load = useCallback(async () => {
    if (!token) return;
    const headers: Record<string, string> = {};
    if (clientToken) headers["x-client-token"] = clientToken;

    try {
      const res = await fetch(`/api/galleries/shared/${token}`, { headers });
      if (!res.ok) throw new Error("Gallery non trovata o link scaduto");
      const d = await res.json();
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, clientToken]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async (photoId: string) => {
    if (!data) return;
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        photos: prev.photos.map((p) => {
          if (p.id !== photoId) return p;
          const liked = p.likedByMe;
          return { ...p, likedByMe: !liked, likeCount: liked ? p.likeCount - 1 : p.likeCount + 1 };
        }),
      };
    });
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto((prev) => {
        if (!prev) return prev;
        const liked = prev.likedByMe;
        return { ...prev, likedByMe: !liked, likeCount: liked ? prev.likeCount - 1 : prev.likeCount + 1 };
      });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["x-client-token"] = clientToken;
    await fetch(`/api/galleries/shared/${token}/photos/${photoId}/like`, {
      method: "POST",
      headers,
    });
  };

  const loadComments = async (photoId: string) => {
    const headers: Record<string, string> = {};
    if (clientToken) headers["x-client-token"] = clientToken;
    const res = await fetch(`/api/galleries/photos/${photoId}/comments`, { headers });
    if (res.ok) {
      const d = await res.json();
      setSelectedPhoto((prev) => prev ? { ...prev, comments: d.comments ?? d } : prev);
    }
  };

  const openPhoto = async (photo: Photo) => {
    setSelectedPhoto(photo);
    await loadComments(photo.id);
  };

  const postComment = async () => {
    if (!selectedPhoto || !comment.trim() || !commentName.trim()) return;
    setPosting(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["x-client-token"] = clientToken;
    const res = await fetch(`/api/galleries/photos/${selectedPhoto.id}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: comment, authorName: commentName }),
    });
    if (res.ok) {
      const d = await res.json();
      setSelectedPhoto((prev) =>
        prev ? { ...prev, comments: [...(prev.comments ?? []), d.comment ?? d] } : prev
      );
      setComment("");
    }
    setPosting(false);
  };

  const primaryColor = data?.tenant?.primaryColor ?? "#6366f1";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#64748b" }}>Caricamento gallery...</p>
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {data.tenant.logoUrl ? (
          <img src={data.tenant.logoUrl} alt="Logo" style={{ height: "32px", objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: primaryColor }}>
            {data.tenant.brandName}
          </span>
        )}
        <div style={{ width: "1px", height: "20px", background: "#e2e8f0" }} />
        <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
          {data.gallery.name}
        </h1>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#64748b" }}>
          {data.photos.length} foto
        </span>
      </div>

      {/* Photo grid */}
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        {data.photos.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "3rem" }}>Nessuna foto disponibile.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {data.photos.map((photo) => (
              <div
                key={photo.id}
                style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", cursor: "pointer", background: "#e2e8f0" }}
              >
                <img
                  src={photo.url}
                  alt={photo.filename}
                  onClick={() => openPhoto(photo)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {/* Like button overlay */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(photo.id); }}
                  style={{
                    position: "absolute",
                    bottom: "0.5rem",
                    right: "0.5rem",
                    background: photo.likedByMe ? "#ef4444" : "rgba(0,0,0,0.5)",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "0.25rem 0.6rem",
                    color: "#fff",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  ❤️ {photo.likeCount}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhoto(null); }}
        >
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.filename}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }}
            />
          </div>
          <div
            style={{
              width: "300px",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Actions */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                onClick={() => toggleLike(selectedPhoto.id)}
                style={{
                  padding: "0.4rem 0.9rem",
                  background: selectedPhoto.likedByMe ? "#ef444411" : "#f8fafc",
                  color: selectedPhoto.likedByMe ? "#ef4444" : "#64748b",
                  border: `1px solid ${selectedPhoto.likedByMe ? "#ef444433" : "#e2e8f0"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                {selectedPhoto.likedByMe ? "❤️" : "🤍"} {selectedPhoto.likeCount}
              </button>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.25rem" }}
              >
                ×
              </button>
            </div>
            {/* Comments list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
                Commenti
              </h3>
              {(selectedPhoto.comments ?? []).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Nessun commento.</p>
              ) : (
                (selectedPhoto.comments ?? []).map((c) => (
                  <div key={c.id} style={{ background: "#f8fafc", borderRadius: "8px", padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "#0f172a" }}>{c.authorName}</span>
                      <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                        {new Date(c.createdAt).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#334155" }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>
            {/* Comment input */}
            <div style={{ padding: "1rem", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Il tuo nome"
                style={{
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  color: "#0f172a",
                }}
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Commento..."
                rows={2}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  color: "#0f172a",
                  resize: "none",
                }}
              />
              <button
                onClick={postComment}
                disabled={posting || !comment.trim() || !commentName.trim()}
                style={{
                  padding: "0.5rem",
                  background: primaryColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  opacity: posting || !comment.trim() || !commentName.trim() ? 0.5 : 1,
                }}
              >
                {posting ? "Invio..." : "Commenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
