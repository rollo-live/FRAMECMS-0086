import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, FolderOpen, Image, Video, Settings, LogOut, Aperture, Receipt, X, CalendarCheck } from "lucide-react";
import { authClient } from "../../lib/auth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Clienti & Lead", href: "/clienti" },
  { icon: Receipt, label: "Preventivi", href: "/preventivi" },
  { icon: FileText, label: "Contratti", href: "/contratti" },
  { icon: FolderOpen, label: "Progetti", href: "/progetti" },
  { icon: Image, label: "Gallery", href: "/gallery" },
  { icon: Video, label: "Video Review", href: "/video" },
  { icon: CalendarCheck, label: "Prenotazioni", href: "/prenotazioni", badge: true },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!session) return;
    fetch("/api/bookings/pending-count", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => setPendingCount(d.count ?? 0))
      .catch(() => setPendingCount(0));
    const interval = setInterval(() => {
      fetch("/api/bookings/pending-count", { credentials: "include" })
        .then((r) => r.ok ? r.json() : { count: 0 })
        .then((d) => setPendingCount(d.count ?? 0))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [session]);

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open !== undefined && (
        <div
          className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        w-[240px] shrink-0 h-screen flex flex-col bg-[#111] border-r border-[rgba(255,255,255,0.06)]
        fixed top-0 left-0 z-50 transition-transform duration-300
        lg:sticky lg:translate-x-0
        ${open === undefined || open ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F5A623] flex items-center justify-center">
              <Aperture size={16} className="text-black" />
            </div>
            <span className="text-base font-semibold tracking-tight text-[#f5f5f5]">FRAME</span>
          </div>
          {/* Close button mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-[#666] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {navItems.map(({ icon: Icon, label, href, badge }) => {
              const active = location.pathname === href || location.pathname.startsWith(href + "/");
              const showBadge = badge && pendingCount > 0;
              return (
                <Link key={href} to={href} onClick={handleNavClick}>
                  <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                    ${active
                      ? "bg-[rgba(245,166,35,0.12)] text-[#F5A623]"
                      : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#f5f5f5]"
                    }`}>
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 999,
                        minWidth: 18,
                        height: 18,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "0 5px",
                      }}>
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.06)] space-y-0.5">
          <Link to="/impostazioni" onClick={handleNavClick}>
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
    </>
  );
}

export default Sidebar;
