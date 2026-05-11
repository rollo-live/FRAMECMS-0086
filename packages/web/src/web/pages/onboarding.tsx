import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Aperture } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const setup = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/tenants/setup", { name });
      return res.json();
    },
    onSuccess: () => navigate("/dashboard"),
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[rgba(245,166,35,0.04)] blur-[100px]" />
      </div>
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623] flex items-center justify-center">
            <Aperture size={20} className="text-black" />
          </div>
          <span className="text-xl font-semibold text-[#f5f5f5]">FRAME</span>
        </div>
        <div className="bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Configura il tuo studio</h2>
          <p className="text-sm text-[#a0a0a0] mb-6">Come si chiama il tuo studio fotografico o agenzia?</p>
          <form onSubmit={(e) => { e.preventDefault(); setup.mutate(); }} className="space-y-4">
            <Input
              label="Nome dello studio"
              placeholder="es. Studio Rossi, Visual Lab..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" size="lg" loading={setup.isPending} className="w-full">
              Inizia →
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
