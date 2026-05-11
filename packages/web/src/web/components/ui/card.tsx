import React from "react";

export function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 ${onClick ? "cursor-pointer hover:bg-[#1a1a1a] transition-colors" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "accent" }) {
  const colors = {
    default: "bg-[rgba(255,255,255,0.06)] text-[#a0a0a0]",
    success: "bg-[rgba(34,197,94,0.12)] text-[#22c55e]",
    warning: "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]",
    danger: "bg-[rgba(239,68,68,0.12)] text-[#ef4444]",
    accent: "bg-[rgba(245,166,35,0.15)] text-[#F5A623]",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors[variant]}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full bg-[rgba(245,166,35,0.15)] text-[#F5A623] font-semibold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}
