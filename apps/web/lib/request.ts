import { headers } from "next/headers";

/** Best-effort client IP for rate limiting. */
export function clientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = h.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return "127.0.0.1";
}
