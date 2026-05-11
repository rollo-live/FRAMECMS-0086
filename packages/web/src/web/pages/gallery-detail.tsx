import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout/dashboard-layout";

type Photo = {
  id: string;
  url: string;
  filename: string;
  likeCount: number;
  comments?: Comment[];
};

type Comment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

type Gallery = {
  id: string;
  name: string;
  watermarkEnabled: boolean;
  shareToken: string | null;
  project?: { name: string };
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [gRes, pRes] = await Promise.all([
      api.get(`/api/galleries/${id}`),
      api.get(`/api/galleries/${id}/photos`),
    ]);
    if (gRes.ok) {
      const d = await gRes.json();
      setGallery(d.gallery ?? d);
    }
    if (pRes.ok) {
      const d = await pRes.json();
      setPhotos(d.photos ?? d);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (!id || files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      try {
        // Get presigned URL
        const presignRes = await api.post(`/api/galleries/${id}/photos/presign`, {
          filename: file.name,
          contentType: file.type,
        });
        if (!presignRes.ok) continue;
        const { uploadUrl, photoId, url } = await presignRes.json();

        // Upload to R2
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        // Confirm upload
        const confirmRes = await api.post(`/api/galleries/${id}/photos/${photoId}/confirm`, { url });
        if (confirmRes.ok) {
          const d = await confirmRes.json();
          setPhotos((prev) => [...prev, d.photo ?? d]);
        }
      } catch (e) {
        console.error("Upload failed", e);
      }
    }
    setUploading(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    uploadFiles(Array.from(files).filter((f) => f.type.startsWith("image/")));
  };

  const loadPhotoComments = async (photoId: string) => {
    const res = await api.get(`/api/galleries/photos/${photoId}/comments`);
    if (res.ok) {
      const d = await res.json();
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, comments: d.comments ?? d } : p))
      );
    }
  };

  const openPhoto = async (photo: Photo) => {
    setSelectedPhoto(photo);
    await loadPhotoComments(photo.id);
  };

  const postComment = async () => {
    if (!selectedPhoto || !comment.trim() || !commentName.trim()) return;
    setPosting(true);
    const res = await api.post(`/api/galleries/photos/${selectedPhoto.id}/comments`, {
      content: comment,
      authorName: commentName,
    });
    if (res.ok) {
      const d = await res.json();
      const newComment = d.comment ?? d;
      setSelectedPhoto((prev) =>
        prev ? { ...prev, comments: [...(prev.comments ?? []), newComment] } : prev
      );
      setComment("");
    }
    setPosting(false);
  };

  const toggleWatermark = async () => {
    if (!gallery) return;
    const newVal = !gallery.watermarkEnabled;
    setGallery({ ...gallery, watermarkEnabled: newVal });
    await api.patch(`/api/galleries/${id}`, { watermarkEnabled: newVal });
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
    const url = `${window.location.origin}/portale/gallery/${gallery.shareToken}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) return <DashboardLayout><div style={{ padding: "2rem", color: "var(--text-secondary)" }}>Caricamento...</div></DashboardLayout>;
  if (!gallery) return <DashboardLayout><div style={{ padding: "2rem", color: "var(--text-secondary)" }}>Gallery non trovata.</div></DashboardLayout>;

  return (
    <DashboardLayout>
    <div style={{ padding: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Link to="/gallery" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.875rem" }}>
          ← Gallery
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {gallery.name}
          </h1>
          {gallery.project && (
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{gallery.project.name}</span>
          )}
        </div>
        {/* Watermark toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Watermark</span>
          <button
            onClick={toggleWatermark}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "9999px",
              background: gallery.watermarkEnabled ? "var(--primary)" : "var(--border)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "2px",
                left: gallery.watermarkEnabled ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
        {/* Share */}
        {gallery.shareToken ? (
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

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "12px",
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "2rem",
          background: dragActive ? "var(--primary)11" : "var(--surface)",
          transition: "all 0.15s",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <p style={{ color: "var(--primary)", margin: 0 }}>Upload in corso...</p>
        ) : (
          <>
            <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>
              Trascina foto qui o clicca per selezionare
            </p>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              JPG, PNG, WebP — upload multiplo supportato
            </p>
          </>
        )}
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>Nessuna foto ancora.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => openPhoto(photo)}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--surface)",
              }}
            >
              <img
                src={photo.url}
                alt={photo.filename}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {photo.likeCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "0.5rem",
                    right: "0.5rem",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    borderRadius: "9999px",
                    padding: "0.15rem 0.5rem",
                    fontSize: "0.75rem",
                  }}
                >
                  ❤️ {photo.likeCount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo detail panel */}
      {selectedPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            zIndex: 50,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhoto(null); }}
        >
          {/* Image */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.filename}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }}
            />
          </div>
          {/* Comments sidebar */}
          <div
            style={{
              width: "320px",
              background: "var(--bg)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              padding: "1.5rem",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Commenti</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.25rem" }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(selectedPhoto.comments ?? []).length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Nessun commento ancora.</p>
              ) : (
                (selectedPhoto.comments ?? []).map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>
                        {c.authorName}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                        {new Date(c.createdAt).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)" }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>
            {/* New comment */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Il tuo nome"
                style={{
                  padding: "0.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                }}
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Scrivi un commento..."
                rows={3}
                style={{
                  padding: "0.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  resize: "none",
                }}
              />
              <button
                onClick={postComment}
                disabled={posting || !comment.trim() || !commentName.trim()}
                style={{
                  padding: "0.5rem",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  opacity: posting || !comment.trim() || !commentName.trim() ? 0.6 : 1,
                }}
              >
                {posting ? "Invio..." : "Commenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
