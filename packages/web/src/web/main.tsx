import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./app.tsx";

const queryClient = new QueryClient({
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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
