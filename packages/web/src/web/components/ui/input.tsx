import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#555] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors ${error ? "border-red-500" : ""} ${className}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">{label}</label>}
      <textarea
        {...props}
        className={`w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] placeholder:text-[#555] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors resize-none ${error ? "border-red-500" : ""} ${className}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Select({ label, error, className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide">{label}</label>}
      <select
        {...props}
        className={`w-full px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#f5f5f5] outline-none focus:border-[rgba(245,166,35,0.5)] transition-colors ${error ? "border-red-500" : ""} ${className}`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
