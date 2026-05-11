import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Aperture } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "register") {
        const res = await authClient.signUp.email({ name: form.name, email: form.email, password: form.password });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email: form.email, password: form.password });
        if (res.error) throw new Error(res.error.message);
      }
      // aspetta che la sessione si propaghi poi naviga
      await authClient.getSession();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Errore di accesso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[rgba(245,166,35,0.03)] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623] flex items-center justify-center">
            <Aperture size={20} className="text-black" />
          </div>
          <span className="text-xl font-semibold text-[#f5f5f5]">FRAME</span>
        </div>

        <div className="bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
          {/* Tabs */}
          <div className="flex bg-[#0a0a0a] rounded-xl p-1 mb-6 border border-[rgba(255,255,255,0.06)]">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${tab === t ? "bg-[#1a1a1a] text-[#f5f5f5]" : "text-[#555] hover:text-[#a0a0a0]"}`}
              >
                {t === "login" ? "Accedi" : "Registrati"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <Input
                label="Nome completo"
                placeholder="Mario Rossi"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            )}
            <Input
              label="Email"
              type="email"
              placeholder="mario@studio.it"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />

            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              {tab === "login" ? "Accedi" : "Crea account"}
            </Button>
          </form>

          {tab === "register" && (
            <p className="text-xs text-[#555] text-center mt-4">
              Registrandoti accetti i Termini di Servizio
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
