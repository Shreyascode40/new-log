/**
 * Shared Upstash limiter for deployments; falls back to an in-memory Map
 * when Redis is not configured so valid users are never locked out.
 */

import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const now = Date.now();
      const windowId = Math.floor(now / windowMs);
      const subject = createHash("sha256").update(key).digest("hex");
      const redisKey = `be-logbook:auth:${limit}:${windowMs}:${windowId}:${subject}`;
      const script = [
        "local count = redis.call('INCR', KEYS[1])",
        "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
        "return count",
      ].join("\n");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(["EVAL", script, "1", redisKey, String(windowMs)]),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Upstash returned HTTP ${response.status}`);
      const result = await response.json() as { result?: unknown };
      const count = Number(result.result);
      if (!Number.isFinite(count)) throw new Error("Upstash returned an invalid rate-limit count");
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterMs: count <= limit ? 0 : (windowId + 1) * windowMs - now,
      };
    } catch (error) {
      console.warn("Shared Upstash rate limiter unavailable; falling back to local limiter:", error);
      return localRateLimit(key, limit, windowMs);
    }
  }

  return localRateLimit(key, limit, windowMs);
}

/** Test/maintenance helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Common windows used by the auth endpoints. */
export const RATE_LIMITS = {
  signup: { limit: 10, windowMs: 10 * 60 * 1000 },
  login: { limit: 15, windowMs: 5 * 60 * 1000 },
  passwordReset: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;
