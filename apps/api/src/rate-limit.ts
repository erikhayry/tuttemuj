import type { MiddlewareHandler } from "hono";

export type RateLimitOptions = {
  /** Requests allowed per client in one window. */
  max: number;
  windowMs: number;
  now?: () => number;
};

/**
 * Fixed-window limit per client, kept in memory. One API process, so counts reset on restart.
 * The client is the first address in X-Forwarded-For, or "local" when there is none.
 */
export function rateLimit({ max, windowMs, now = Date.now }: RateLimitOptions): MiddlewareHandler {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return async (c, next) => {
    const t = now();
    const client = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    let w = windows.get(client);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(client, w);
    }
    w.count += 1;
    if (w.count > max) {
      const retryAfter = Math.max(1, Math.ceil((w.resetAt - t) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "too many requests" }, 429);
    }
    await next();
  };
}
