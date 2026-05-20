import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";
import { Aperture, ShieldCheck, Loader2, KeyRound } from "lucide-react";

export default function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    try {
      if (useBackup) {
        const res = await authClient.twoFactor.verifyBackupCode({ code: code.trim() });
        if (res.error) throw new Error(res.error.message ?? "Codice non valido");
      } else {
        const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
        if (res.error) throw new Error(res.error.message ?? "Codice non valido");
      }
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Codice non valido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] px-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[rgba(245,166,35,0.04)] blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#F5A623] flex items-center justify-center shadow-lg shadow-[rgba(245,166,35,0.3)]">
            <Aperture size={18} className="text-black" />
          </div>
          <span className="text-lg font-bold text-[#f5f5f5] tracking-tight">FRAME</span>
        </div>

        <div className="bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(245,166,35,0.1)] border border-[rgba(245,166,35,0.2)] flex items-center justify-center">
              {useBackup
                ? <KeyRound size={24} className="text-[#F5A623]" />
                : <ShieldCheck size={24} className="text-[#F5A623]" />
              }
            </div>
          </div>

          <h1 className="text-lg font-bold text-[#f5f5f5] text-center mb-1">
            {useBackup ? "Codice di backup" : "Verifica in due passaggi"}
          </h1>
          <p className="text-sm text-[#666] text-center mb-6">
            {useBackup
              ? "Inserisci uno dei codici di backup salvati"
              : "Inserisci il codice a 6 cifre dalla tua app authenticator"
            }
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode={useBackup ? "text" : "numeric"}
              pattern={useBackup ? undefined : "[0-9]*"}
              maxLength={useBackup ? 20 : 6}
              value={code}
              onChange={(e) => {
                const val = useBackup ? e.target.value : e.target.value.replace(/\D/g, "");
                setCode(val);
              }}
              placeholder={useBackup ? "xxxxxxxx-xxxx" : "000000"}
              autoFocus
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] text-center text-2xl font-mono tracking-[0.4em] placeholder:text-[#333] placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-[#F5A623] transition-colors"
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || code.length < (useBackup ? 4 : 6)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#F5A623] hover:bg-[#e09615] text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {loading ? "Verifica..." : "Verifica"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => { setUseBackup((v) => !v); setCode(""); setError(""); }}
              className="text-xs text-[#555] hover:text-[#F5A623] transition-colors"
            >
              {useBackup ? "Usa l'app authenticator" : "Non hai accesso all'app? Usa un codice di backup"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#444] mt-6">
          Hai perso l'accesso? Contatta il tuo amministratore.
        </p>
      </div>
    </div>
  );
}
