import { createHash } from "node:crypto";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Best-effort in-process limiter. Helps on a warm instance; not a global edge
 * quota. Prefer a shared store (Upstash/Redis) if traffic grows.
 */
export function consumeRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { ok: true };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

export function hashTokenForRateLimit(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
