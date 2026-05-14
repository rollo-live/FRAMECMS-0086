import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

type Toast = { id: number; message: string; type: "error" | "success" | "info" };

type ToastContextType = {
  addToast: (message: string, type?: Toast["type"]) => void;
};

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

let _addToast: ((msg: string, type?: Toast["type"]) => void) | null = null;

/** Call this from anywhere (including outside React) to show a toast */
export function showToast(message: string, type: Toast["type"] = "error") {
  _addToast?.(message, type);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"] = "error") => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  useEffect(() => { _addToast = addToast; return () => { _addToast = null; }; }, [addToast]);

  const colors: Record<Toast["type"], string> = {
    error: "bg-red-900/90 border-red-500/40 text-red-100",
    success: "bg-green-900/90 border-green-500/40 text-green-100",
    info: "bg-zinc-800/90 border-zinc-600/40 text-zinc-100",
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg border text-sm shadow-lg backdrop-blur-sm flex items-start gap-2 animate-fade-in ${colors[t.type]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100 shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
