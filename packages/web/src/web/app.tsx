import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { authClient } from "./lib/auth";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

// Pages — lazy loaded for code splitting
const Login = lazy(() => import("./pages/login"));
const Onboarding = lazy(() => import("./pages/onboarding"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Clienti = lazy(() => import("./pages/clienti"));
const Preventivi = lazy(() => import("./pages/preventivi"));
const Contratti = lazy(() => import("./pages/contratti"));
const Progetti = lazy(() => import("./pages/progetti"));
const ProgettoDetail = lazy(() => import("./pages/progetto-detail"));
const GalleryPage = lazy(() => import("./pages/gallery"));
const GalleryDetail = lazy(() => import("./pages/gallery-detail"));
const VideoPage = lazy(() => import("./pages/video"));
const VideoDetail = lazy(() => import("./pages/video-detail"));
const Impostazioni = lazy(() => import("./pages/impostazioni"));

// Public pages
const AcceptInvite = lazy(() => import("./pages/accept-invite"));
const Firma = lazy(() => import("./pages/firma"));
const Portale = lazy(() => import("./pages/portale"));
const PortaleGallery = lazy(() => import("./pages/portale-gallery"));
const PortaleVideo = lazy(() => import("./pages/portale-video"));

// Sidebar layout
import Sidebar from "./components/layout/sidebar";

const PageLoader = () => (
  <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", color: "var(--text-secondary)", fontFamily: "Poppins, sans-serif" }}>
    Caricamento...
  </div>
);

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          color: "var(--text-secondary)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        Caricamento...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/firma/:token" element={<Firma />} />
        <Route path="/portale/:token" element={<Portale />} />
        <Route path="/portale/gallery/:token" element={<PortaleGallery />} />
        <Route path="/portale/video/:token" element={<PortaleVideo />} />

        {/* Onboarding (requires auth but no sidebar) */}
        <Route
          path="/onboarding"
          element={
            <AuthGuard>
              <Onboarding />
            </AuthGuard>
          }
        />

        {/* Protected routes with sidebar */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/clienti"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Clienti />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/preventivi"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Preventivi />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/contratti"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Contratti />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/progetti"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Progetti />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/progetti/:id"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <ProgettoDetail />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/gallery"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <GalleryPage />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/gallery/:id"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <GalleryDetail />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/video"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <VideoPage />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/video/:id"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <VideoDetail />
              </ProtectedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/impostazioni"
          element={
            <AuthGuard>
              <ProtectedLayout>
                <Impostazioni />
              </ProtectedLayout>
            </AuthGuard>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      </Suspense>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </>
  );
}

export default App;
