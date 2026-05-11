import React from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "../lib/auth";
import { Aperture } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623] flex items-center justify-center">
            <Aperture size={20} className="text-black" />
          </div>
          <div className="w-5 h-5 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
