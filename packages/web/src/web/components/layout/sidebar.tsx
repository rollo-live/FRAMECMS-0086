import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, FolderOpen, Image, Video, Settings, LogOut, Aperture, Receipt } from "lucide-react";
import { authClient } from "../../lib/auth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Clienti & Lead", href: "/clienti" },
  { icon: Receipt, label: "Preventivi", href: "/preventivi" },
  { icon: FileText, label: "Contratti", href: "/contratti" },
  { icon: FolderOpen, label: "Progetti", href: "/progetti" },
  { icon: Image, label: "Gallery", href: "/gallery" },
  { icon: Video, label: "Video Review", href: "/video" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  return (
    <aside className="w-[240px] shrink-0 h-screen flex flex-col bg-[#111] border-r border-[rgba(255,255,255,0.06)] sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F5A623] flex items-center justify-center">
            <Aperture size={16} className="text-black" />
          </div>
          <span className="text-base font-semibold tracking-tight text-[#f5f5f5]">FRAME</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ icon: Icon, label, href }) => {
            const active = location.pathname === href || location.pathname.startsWith(href + "/");
            return (
              <Link key={href} to={href}>
                <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                  ${active
                    ? "bg-[rgba(245,166,35,0.12)] text-[#F5A623]"
                    : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#f5f5f5]"
                  }`}>
                  <Icon size={16} className="shrink-0" />
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.06)] space-y-0.5">
        <Link to="/impostazioni">
          <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
            ${location.pathname === "/impostazioni" ? "bg-[rgba(245,166,35,0.12)] text-[#F5A623]" : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#f5f5f5]"}`}>
            <Settings size={16} />
            Impostazioni
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#a0a0a0] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444] transition-all duration-150 cursor-pointer"
        >
          <LogOut size={16} />
          Esci
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
