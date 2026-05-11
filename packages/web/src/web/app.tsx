import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { authClient } from "./lib/auth";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

// Pages
import Login from "./pages/login";
import Onboarding from "./pages/onboarding";
import Dashboard from "./pages/dashboard";
import Clienti from "./pages/clienti";
import Preventivi from "./pages/preventivi";
import Contratti from "./pages/contratti";
import Progetti from "./pages/progetti";
import ProgettoDetail from "./pages/progetto-detail";
import GalleryPage from "./pages/gallery";
import GalleryDetail from "./pages/gallery-detail";
import VideoPage from "./pages/video";
import VideoDetail from "./pages/video-detail";
import Impostazioni from "./pages/impostazioni";

// Public pages
import Firma from "./pages/firma";
import Portale from "./pages/portale";
import PortaleGallery from "./pages/portale-gallery";
import PortaleVideo from "./pages/portale-video";

// Sidebar layout
import Sidebar from "./components/layout/sidebar";

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
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
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

      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </>
  );
}

export default App;
