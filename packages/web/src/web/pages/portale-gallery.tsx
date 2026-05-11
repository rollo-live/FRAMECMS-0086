import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";

type Photo = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  likeCount: number;
  likedByMe: boolean;
  width?: number;
  height?: number;
};

type TenantInfo = {
  brandName: string;
  primaryColor: string;
  logoUrl: string | null;
};

type GalleryInfo = {
  id: string;
  title: string;
  watermarkEnabled: boolean;
  downloadEnabled: boolean;
  likeLimit: number;
};

type GalleryData = {
  gallery: GalleryInfo;
  photos: Photo[];
  tenant: TenantInfo;
  myLikeCount: number;
};

const ACCESS_TOKEN_PREFIX = "frame_gallery_access_";
const VISITOR_ID_KEY = "frame_visitor_id";

function getStoredAccessToken(token: string) {
  return localStorage.getItem(ACCESS_TOKEN_PREFIX + token) ?? null;
}
function setStoredAccessToken(token: string, accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_PREFIX + token, accessToken);
}
function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export default function PortaleGallery() {
  const { token } = useParams<{ token: string }>();

  // State
  const [stage, setStage] = useState<"loading" | "gate" | "pending" | "gallery" | "error">("loading");
  const [data, setData] = useState<GalleryData | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [galleryTitle, setGalleryTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Gate form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Photo viewer
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number>(0);

  // Like state
  const [myLikeCount, setMyLikeCount] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const accessToken = token ? getStoredAccessToken(token) : null;
  const visitorId = getVisitorId();

  const load = useCallback(async () => {
    if (!token) return;
    setStage("loading");
    const headers: Record<string, string> = {};
    const at = getStoredAccessToken(token);
    if (at) headers["x-access-token"] = at;

    try {
      const res = await fetch(`/api/galleries/shared/${token}`, { headers });
      const d = await res.json();

      if (d.requiresAccess) {
        setTenantInfo(d.tenant);
        setGalleryTitle(d.gallery?.title ?? "Gallery");
        setStage("gate");
        return;
      }
      if (d.requiresApproval) {
        setTenantInfo(d.tenant);
        setGalleryTitle(d.gallery?.title ?? "Gallery");
        setStage("pending");
        return;
      }
      if (!res.ok) {
        setError(d.error ?? "Errore nel caricamento");
        setStage("error");
        return;
      }

      setData(d);
      setPhotos(d.photos ?? []);
      setMyLikeCount(d.myLikeCount ?? 0);
      setStage("gallery");
    } catch (e: any) {
      setError(e.message ?? "Errore");
      setStage("error");
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const submitAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setGateError(null);
    try {
      const res = await fetch(`/api/galleries/shared/${token}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Errore");
      if (d.accessToken) {
        setStoredAccessToken(token, d.accessToken);
        load();
      } else {
        setStage("pending");
      }
    } catch (e: any) {
      setGateError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (photoId: string) => {
    if (!token || !data) return;
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const likeLimit = data.gallery.likeLimit;
    const willAdd = !photo.likedByMe;

    if (willAdd && likeLimit > 0 && myLikeCount >= likeLimit) {
      alert(`Puoi selezionare al massimo ${likeLimit} foto.`);
      return;
    }

    // Optimistic update
    setPhotos(prev => prev.map(p => {
      if (p.id !== photoId) return p;
      return {
        ...p,
        likedByMe: !p.likedByMe,
        likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1,
      };
    }));
    setMyLikeCount(prev => willAdd ? prev + 1 : prev - 1);
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto(prev => prev ? {
        ...prev,
        likedByMe: !prev.likedByMe,
        likeCount: prev.likedByMe ? prev.likeCount - 1 : prev.likeCount + 1,
      } : prev);
    }

    try {
      const at = getStoredAccessToken(token);
      const body: Record<string, string> = at
        ? { accessToken: at }
        : { visitorId };

      const res = await fetch(`/api/galleries/shared/${token}/photos/${photoId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();

      if (!res.ok) {
        // Rollback
        setPhotos(prev => prev.map(p => {
          if (p.id !== photoId) return p;
          return { ...p, likedByMe: photo.likedByMe, likeCount: photo.likeCount };
        }));
        setMyLikeCount(prev => willAdd ? prev - 1 : prev + 1);
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(prev => prev ? { ...prev, likedByMe: photo.likedByMe, likeCount: photo.likeCount } : prev);
        }
        if (d.limitReached) {
          alert(`Puoi selezionare al massimo ${likeLimit} foto.`);
        }
      }
    } catch {
      // silent
    }
  };

  const openPhoto = (idx: number) => {
    setLightboxIdx(idx);
    setSelectedPhoto(photos[idx]);
  };

  const navLightbox = (dir: -1 | 1) => {
    const newIdx = (lightboxIdx + dir + photos.length) % photos.length;
    setLightboxIdx(newIdx);
    setSelectedPhoto(photos[newIdx]);
  };

  const primaryColor = tenantInfo?.primaryColor ?? data?.tenant?.primaryColor ?? "#6366f1";
  const tenant = tenantInfo ?? data?.tenant;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px", border: "3px solid #334155",
            borderTopColor: primaryColor, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 1rem"
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#94a3b8", margin: 0 }}>Caricamento gallery...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "#ef4444", fontSize: "1.1rem", marginBottom: "0.5rem" }}>Gallery non disponibile</p>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{error}</p>
        </div>
      </div>
    );
  }

  // ── Access Gate form ──────────────────────────────────────────────────────
  if (stage === "gate") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          {/* Brand */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt="Logo" style={{ height: "40px", objectFit: "contain", marginBottom: "1rem" }} />
            ) : (
              <div style={{ fontWeight: 800, fontSize: "1.25rem", color: primaryColor, marginBottom: "1rem" }}>
                {tenant?.brandName ?? "Studio"}
              </div>
            )}
            <h1 style={{ color: "#f8fafc", fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              {galleryTitle}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
              Inserisci i tuoi dati per accedere alla gallery
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submitAccess} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Nome
                </label>
                <input
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Mario"
                  style={{
                    width: "100%", padding: "0.65rem 0.875rem", background: "#1e293b",
                    border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9",
                    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cognome
                </label>
                <input
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Rossi"
                  style={{
                    width: "100%", padding: "0.65rem 0.875rem", background: "#1e293b",
                    border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9",
                    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="mario@esempio.it"
                style={{
                  width: "100%", padding: "0.65rem 0.875rem", background: "#1e293b",
                  border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9",
                  fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            {gateError && (
              <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{gateError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "0.75rem", background: primaryColor, color: "#fff",
                border: "none", borderRadius: "8px", fontWeight: 700,
                fontSize: "0.9rem", cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1, marginTop: "0.25rem",
              }}
            >
              {submitting ? "Accesso in corso..." : "Accedi alla gallery"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Pending approval ──────────────────────────────────────────────────────
  if (stage === "pending") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: "1.5rem" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" style={{ height: "40px", objectFit: "contain", marginBottom: "1.5rem" }} />
          ) : (
            <div style={{ fontWeight: 800, fontSize: "1.25rem", color: primaryColor, marginBottom: "1.5rem" }}>
              {tenant?.brandName ?? "Studio"}
            </div>
          )}
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <h2 style={{ color: "#f8fafc", fontWeight: 700, margin: "0 0 0.75rem" }}>Richiesta inviata</h2>
          <p style={{ color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
            La tua richiesta di accesso è in attesa di approvazione.<br />
            Riceverai una notifica quando verrà approvata.
          </p>
        </div>
      </div>
    );
  }

  // ── Gallery ───────────────────────────────────────────────────────────────
  if (stage !== "gallery" || !data) return null;

  const likeLimit = data.gallery.likeLimit;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#1e293b", borderBottom: "1px solid #334155",
        padding: "0.875rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {data.tenant.logoUrl ? (
          <img src={data.tenant.logoUrl} alt="Logo" style={{ height: "28px", objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: "1rem", color: primaryColor }}>
            {data.tenant.brandName}
          </span>
        )}
        <div style={{ width: "1px", height: "18px", background: "#334155" }} />
        <h1 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#f1f5f9" }}>
          {data.gallery.title}
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          {likeLimit > 0 && (
            <span style={{
              fontSize: "0.8rem", fontWeight: 600,
              color: myLikeCount >= likeLimit ? "#f97316" : "#94a3b8",
              background: myLikeCount >= likeLimit ? "#7c2d1222" : "#1e293b",
              border: `1px solid ${myLikeCount >= likeLimit ? "#f9731633" : "#334155"}`,
              padding: "0.25rem 0.6rem", borderRadius: "6px",
            }}>
              ❤️ {myLikeCount} / {likeLimit}
            </span>
          )}
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            {photos.length} foto
          </span>
        </div>
      </div>

      {/* Photo grid */}
      <div style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto" }}>
        {photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "#475569" }}>
            <p>Nessuna foto disponibile.</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "6px",
          }}>
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "6px",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "#1e293b",
                }}
              >
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.filename}
                  loading="lazy"
                  onClick={() => openPhoto(idx)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    // Fallback to full URL if thumbnail fails
                    if (photo.thumbnailUrl && (e.target as HTMLImageElement).src !== photo.url) {
                      (e.target as HTMLImageElement).src = photo.url;
                    }
                  }}
                />
                {/* Like overlay */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(photo.id); }}
                  style={{
                    position: "absolute", bottom: "0.4rem", right: "0.4rem",
                    background: photo.likedByMe ? "#ef4444" : "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(4px)",
                    border: "none", borderRadius: "9999px",
                    padding: "0.2rem 0.55rem", color: "#fff",
                    fontSize: "0.72rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.25rem",
                    fontWeight: 600, transition: "background 0.15s",
                  }}
                >
                  {photo.likedByMe ? "❤️" : "🤍"} {photo.likeCount > 0 ? photo.likeCount : ""}
                </button>

                {/* Hover overlay */}
                <div
                  onClick={() => openPhoto(idx)}
                  style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0)",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
            display: "flex", zIndex: 100, alignItems: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhoto(null); }}
        >
          {/* Nav prev */}
          {photos.length > 1 && (
            <button
              onClick={() => navLightbox(-1)}
              style={{
                position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                width: "44px", height: "44px", color: "#fff", fontSize: "1.25rem",
                cursor: "pointer", zIndex: 101,
              }}
            >‹</button>
          )}

          {/* Image */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 3rem 2rem" }}>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.filename}
              style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: "4px" }}
            />
          </div>

          {/* Nav next */}
          {photos.length > 1 && (
            <button
              onClick={() => navLightbox(1)}
              style={{
                position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                width: "44px", height: "44px", color: "#fff", fontSize: "1.25rem",
                cursor: "pointer", zIndex: 101,
              }}
            >›</button>
          )}

          {/* Top bar */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
          }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
              {lightboxIdx + 1} / {photos.length}
            </span>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                onClick={() => toggleLike(selectedPhoto.id)}
                style={{
                  padding: "0.4rem 1rem",
                  background: selectedPhoto.likedByMe ? "#ef4444" : "rgba(255,255,255,0.12)",
                  border: "none", borderRadius: "9999px", color: "#fff",
                  cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                  display: "flex", alignItems: "center", gap: "0.35rem",
                }}
              >
                {selectedPhoto.likedByMe ? "❤️" : "🤍"} {selectedPhoto.likeCount > 0 ? selectedPhoto.likeCount : "Seleziona"}
              </button>
              {data.gallery.downloadEnabled && (
                <a
                  href={selectedPhoto.url}
                  download={selectedPhoto.filename}
                  style={{
                    padding: "0.4rem 1rem", background: "rgba(255,255,255,0.12)",
                    borderRadius: "9999px", color: "#fff", textDecoration: "none",
                    fontSize: "0.8rem", fontWeight: 600,
                  }}
                >
                  ↓ Scarica
                </a>
              )}
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{
                  background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%",
                  width: "32px", height: "32px", color: "#fff", cursor: "pointer", fontSize: "1rem",
                }}
              >×</button>
            </div>
          </div>

          {/* Like limit warning at bottom */}
          {likeLimit > 0 && (
            <div style={{
              position: "absolute", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)", padding: "0.4rem 1rem", borderRadius: "9999px",
              color: myLikeCount >= likeLimit ? "#f97316" : "#94a3b8",
              fontSize: "0.78rem", fontWeight: 600,
            }}>
              {myLikeCount >= likeLimit
                ? `Limite raggiunto (${likeLimit} foto)`
                : `Selezioni: ${myLikeCount} / ${likeLimit}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
