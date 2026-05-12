import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";
import { Aperture, Mail, Lock, Eye, EyeOff, ArrowRight, Clapperboard, Image, Video, FolderKanban } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authClient.signIn.email({ email: form.email, password: form.password });
      if (res.error) throw new Error(res.error.message);
      await authClient.getSession();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Errore di accesso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL — dark branding */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-[#0d0d0d] flex-col justify-between p-12 overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full bg-[rgba(245,166,35,0.07)] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-[320px] h-[320px] rounded-full bg-[rgba(245,166,35,0.05)] blur-[80px] pointer-events-none" />

        {/* Watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[200px] font-black text-[rgba(245,166,35,0.03)] tracking-tighter leading-none">FRAME</span>
        </div>

        {/* Top: Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623] flex items-center justify-center shadow-lg shadow-[rgba(245,166,35,0.3)]">
            <Aperture size={20} className="text-black" />
          </div>
          <span className="text-xl font-bold text-[#f5f5f5] tracking-tight">FRAME</span>
        </div>

        {/* Center: Headline */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-[#f5f5f5] leading-tight">
              Produzioni video<br />
              <span className="text-[#F5A623]">smart</span> e scalabili
            </h1>
            <p className="mt-4 text-[#666] text-base leading-relaxed max-w-xs">
              Gestisci progetti, gallery e video in un'unica piattaforma pensata per i professionisti.
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: FolderKanban, label: "Progetti" },
              { icon: Clapperboard, label: "Produzioni" },
              { icon: Image, label: "Gallery" },
              { icon: Video, label: "Video" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)]">
                <div className="w-6 h-6 rounded-lg bg-[rgba(245,166,35,0.15)] flex items-center justify-center">
                  <Icon size={13} className="text-[#F5A623]" />
                </div>
                <span className="text-sm text-[#aaa] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="text-xs text-[#444] relative z-10">© 2026 Frame. Tutti i diritti riservati.</p>
      </div>

      {/* RIGHT PANEL — light form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#F5A623] flex items-center justify-center">
            <Aperture size={18} className="text-black" />
          </div>
          <span className="text-lg font-bold text-[#111] tracking-tight">FRAME</span>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Headline */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#111]">Bentornato!</h2>
            <p className="text-sm text-[#888] mt-1">Inserisci le tue credenziali per accedere</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#555] uppercase tracking-wide">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
                <input
                  type="email"
                  placeholder="esempio@email.com"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full pl-10 pr-4 py-3 text-sm border border-[#e5e5e5] rounded-xl text-[#111] placeholder:text-[#bbb] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[rgba(245,166,35,0.12)] transition-all bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#555] uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full pl-10 pr-10 py-3 text-sm border border-[#e5e5e5] rounded-xl text-[#111] placeholder:text-[#bbb] outline-none focus:border-[#F5A623] focus:ring-2 focus:ring-[rgba(245,166,35,0.12)] transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#888] transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F5A623] hover:bg-[#e09615] active:bg-[#cc8810] text-black font-semibold text-sm rounded-xl transition-all shadow-md shadow-[rgba(245,166,35,0.25)] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Accedi
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Bottom links */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button className="text-xs text-[#bbb] hover:text-[#888]">Privacy Policy</button>
            <span className="text-[#ddd]">•</span>
            <button className="text-xs text-[#bbb] hover:text-[#888]">Cookie Policy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
