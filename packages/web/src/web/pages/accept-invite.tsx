import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Aperture, Check, X, Loader, User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

type State = "loading" | "register" | "success" | "error";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>("loading");
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");

  // Register form
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: validate token
  useEffect(() => {
    if (!token) { setState("error"); setError("Token mancante."); return; }

    api.post("/api/team/accept", { token }).then(async (res) => {
      const d = await res.json().catch(() => ({})) as any;
      if (!res.ok) { setState("error"); setError(d.error ?? "Errore"); return; }
      if (d.needsRegister) {
        setInviteEmail(d.email ?? "");
        setState("register");
      } else {
        // Utente già esistente e linkato — manda al login
        setState("success");
        setTimeout(() => navigate("/login", { replace: true }), 2500);
      }
    }).catch(() => {
      setState("error");
      setError("Impossibile raggiungere il server.");
    });
  }, [token]);

  // Step 2: create account + accept invite
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Register — pass inviteToken in body so the backend guard allows it
      const signupRes = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email: inviteEmail, password, inviteToken: token }),
      });
      const signupData = await signupRes.json().catch(() => ({})) as any;
      if (!signupRes.ok) throw new Error(signupData.error ?? "Registrazione fallita");

      // Accept invite (link user to tenant)
      const acceptRes = await api.post("/api/team/accept", { token });
      const acceptData = await acceptRes.json().catch(() => ({})) as any;
      if (!acceptRes.ok) throw new Error(acceptData.error ?? "Errore nell'accettare l'invito");

      setState("success");
      setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message ?? "Errore");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#F5A623] flex items-center justify-center">
            <Aperture size={18} className="text-black" />
          </div>
          <span className="text-lg font-bold text-[#f5f5f5] tracking-tight">FRAME</span>
        </div>

        {/* LOADING */}
        {state === "loading" && (
          <div className="text-center">
            <Loader size={32} className="mx-auto mb-3 text-[#F5A623] animate-spin" />
            <p className="text-[#a0a0a0] text-sm">Verifica invito...</p>
          </div>
        )}

        {/* SUCCESS */}
        {state === "success" && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-[#f5f5f5] font-semibold text-lg mb-1">Account collegato!</p>
            <p className="text-[#555] text-sm">Accedi con le tue credenziali per entrare nel team.</p>
            <p className="text-[#444] text-xs mt-2">Reindirizzamento al login...</p>
          </div>
        )}

        {/* ERROR */}
        {state === "error" && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X size={24} className="text-red-400" />
            </div>
            <p className="text-[#f5f5f5] font-semibold text-lg mb-1">Invito non valido</p>
            <p className="text-[#555] text-sm mb-6">{error}</p>
            <Link to="/login" className="text-sm text-[#F5A623] hover:underline">Vai al login</Link>
          </div>
        )}

        {/* REGISTER FORM */}
        {state === "register" && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#f5f5f5]">Crea il tuo account</h2>
              <p className="text-[#666] text-sm mt-1">
                Hai ricevuto un invito per <span className="text-[#F5A623] font-medium">{inviteEmail}</span>
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Email — readonly */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#555] uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  readOnly
                  className="w-full px-4 py-3 text-sm rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#666] cursor-not-allowed"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#555] uppercase tracking-wide">Nome completo</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    type="text"
                    placeholder="Mario Rossi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[rgba(245,166,35,0.12)] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#555] uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-10 py-3 text-sm rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#f5f5f5] placeholder:text-[#444] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[rgba(245,166,35,0.12)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-[#444]">Minimo 8 caratteri</p>
              </div>

              {error && (
                <div className="px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F5A623] hover:bg-[#e09615] text-black font-semibold text-sm rounded-xl transition-all shadow-lg shadow-[rgba(245,166,35,0.2)] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    Crea account e accedi
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
