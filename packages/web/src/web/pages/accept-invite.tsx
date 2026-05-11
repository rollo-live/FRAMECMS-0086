import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";
import { Check, X, Loader } from "lucide-react";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const { data: session } = authClient.useSession();

  const [state, setState] = useState<"loading" | "needsLogin" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setError("Token mancante."); return; }
    api.post("/api/team/accept", { token }).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setState("error"); setError((d as any).error ?? "Errore"); return; }
      if ((d as any).needsRegister) {
        setState("needsLogin");
      } else {
        setState("success");
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 text-center">
        <div className="mb-6 text-4xl">🎬</div>
        <h1 className="text-xl font-bold text-[#f5f5f5] mb-2">FRAME</h1>

        {state === "loading" && (
          <>
            <Loader size={32} className="mx-auto mb-3 text-[#F5A623] animate-spin" />
            <p className="text-[#a0a0a0] text-sm">Verifica invito...</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-[#f5f5f5] font-semibold mb-1">Invito accettato!</p>
            <p className="text-[#555] text-sm">Accesso al team confermato. Reindirizzamento...</p>
          </>
        )}

        {state === "needsLogin" && (
          <>
            <p className="text-[#f5f5f5] font-semibold mb-2">Crea il tuo account</p>
            <p className="text-[#555] text-sm mb-5">Registrati per accettare l'invito.</p>
            <Link
              to={`/login?invite=${token}`}
              className="block w-full py-3 text-sm font-semibold bg-[#F5A623] hover:bg-[#e09615] text-black rounded-xl transition-colors"
            >
              Registrati / Accedi
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <X size={24} className="text-red-400" />
            </div>
            <p className="text-[#f5f5f5] font-semibold mb-1">Invito non valido</p>
            <p className="text-[#555] text-sm mb-5">{error}</p>
            <Link to="/login" className="text-sm text-[#F5A623] hover:underline">Vai al login</Link>
          </>
        )}
      </div>
    </div>
  );
}
