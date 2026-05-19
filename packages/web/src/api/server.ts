import { Hono } from "hono";
import { join, extname } from "path";
import app from "./index";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

function getMimeType(pathname: string): string {
  return MIME_TYPES[extname(pathname).toLowerCase()] ?? "application/octet-stream";
}

const port = Number(process.env.PORT) || 8080;
const distDir = join(import.meta.dir, "../../dist");

// Production server: Hono API + static React build
const server = new Hono()
  .route("/", app)
  // SPA fallback for all non-API routes
  .use("*", async (c) => {
    const { pathname } = new URL(c.req.url);

    // Try to serve static file from dist/
    const filePath = join(distDir, pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": getMimeType(pathname) },
      });
    }

    // Fall back to index.html for client-side routing
    const indexFile = Bun.file(join(distDir, "index.html"));
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html" },
    });
  });

console.log(`[FRAME] Production server on port ${port}`);

export default {
  port,
  fetch: server.fetch,
};
