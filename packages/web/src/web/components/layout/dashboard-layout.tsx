import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Menu } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[#111] sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-[#a0a0a0] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#F5A623] flex items-center justify-center">
              <span className="text-black text-[10px] font-bold">F</span>
            </div>
            <span className="text-sm font-semibold text-[#f5f5f5]">FRAME</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#f5f5f5] truncate">{title}</h1>
        {subtitle && <p className="text-sm text-[#a0a0a0] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
