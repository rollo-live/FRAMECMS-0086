import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import "./styles.css";
import App from "./app.tsx";
import { ToastProvider, showToast } from "./components/ui/toast.tsx";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Errore di rete";
      // Don't spam 401s (user not logged in)
      if (msg.includes("401") || msg.includes("Non autorizzato")) return;
      showToast(`Errore: ${msg}`);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // dati freschi per 30s — nessun re-fetch inutile
      gcTime: 5 * 60 * 1000,       // cache in memoria per 5min
      retry: 1,
      refetchOnWindowFocus: false, // non re-fetcha quando torni sulla tab
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
