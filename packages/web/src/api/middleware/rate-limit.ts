/**
 * Simple in-process IP rate limiter.
 * Uses a sliding window counter per IP.
 * Suitable for single-process deploys (VPS with one Node process).
 */

type Window = { count: number; resetAt: number };
const store = new Map<string, Window>();

// Prune stale entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of store) {
    if (w.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function createRateLimit(opts: { max: number; windowMs: number; message?: string }) {
  const { max, windowMs, message = "Troppe richieste. Riprova tra poco." } = opts;
  return async function rateLimitMiddleware(c: any, next: () => Promise<void>) {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `${c.req.path}:${ip}`;
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: message }, 429);
    }
    return next();
  };
}

// Pre-built limiters
export const bookingRateLimit = createRateLimit({ max: 5, windowMs: 60_000 });
export const galleryAccessRateLimit = createRateLimit({ max: 10, windowMs: 60_000 });
