import { useEffect, useState } from "react";
import { authClient } from "./auth";

export type SectionKey =
  | "dashboard"
  | "clienti"
  | "preventivi"
  | "contratti"
  | "progetti"
  | "gallery"
  | "video"
  | "prenotazioni"
  | "contabilita";

export const ALL_SECTIONS: SectionKey[] = [
  "dashboard",
  "clienti",
  "preventivi",
  "contratti",
  "progetti",
  "gallery",
  "video",
  "prenotazioni",
  "contabilita",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  dashboard: "Dashboard",
  clienti: "Clienti & Lead",
  preventivi: "Preventivi",
  contratti: "Contratti",
  progetti: "Progetti",
  gallery: "Gallery",
  video: "Video Review",
  prenotazioni: "Prenotazioni",
  contabilita: "Contabilità",
};

type PermissionsState = {
  role: string | null;
  permissions: SectionKey[] | null; // null = tutte (owner)
  loading: boolean;
  canAccess: (section: SectionKey) => boolean;
};

let cache: { role: string | null; permissions: SectionKey[] | null } | null = null;

export function usePermissions(): PermissionsState {
  const { data: session } = authClient.useSession();
  const [state, setState] = useState<{ role: string | null; permissions: SectionKey[] | null; loading: boolean }>({
    role: null,
    permissions: null,
    loading: true,
  });

  useEffect(() => {
    if (!session?.user) {
      setState({ role: null, permissions: null, loading: false });
      return;
    }
    if (cache) {
      setState({ ...cache, loading: false });
      return;
    }
    fetch("/api/team/my-permissions", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { role: "owner", permissions: null })
      .then((d: any) => {
        cache = { role: d.role, permissions: d.permissions };
        setState({ role: d.role, permissions: d.permissions, loading: false });
      })
      .catch(() => setState({ role: "owner", permissions: null, loading: false }));
  }, [session?.user?.id]);

  const canAccess = (section: SectionKey): boolean => {
    if (state.role === "owner") return true;
    if (state.permissions === null) return true; // nessuna restrizione impostata
    return state.permissions.includes(section);
  };

  return { ...state, canAccess };
}

// Invalida cache (utile dopo cambio permessi)
export function invalidatePermissionsCache() {
  cache = null;
}
