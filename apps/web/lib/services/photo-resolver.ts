import { readStoredUpload, readPrivateUpload, MAX_PHOTO_BYTES } from "../upload";

/**
 * In-memory LRU-like cache for resolved photo data URIs to avoid repeatedly
 * downloading the same photo from Supabase Storage within a short timeframe.
 * TTL: 5 minutes.
 */
type CacheEntry = {
  dataUri: string | null;
  timestamp: number;
};

const PHOTO_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPhoto(key: string): string | null | undefined {
  const entry = PHOTO_CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    PHOTO_CACHE.delete(key);
    return undefined;
  }
  return entry.dataUri;
}

function setCachedPhoto(key: string, dataUri: string | null): void {
  // Bound cache size to prevent memory bloat
  if (PHOTO_CACHE.size > 200) {
    const oldestKey = PHOTO_CACHE.keys().next().value;
    if (oldestKey) PHOTO_CACHE.delete(oldestKey);
  }
  PHOTO_CACHE.set(key, { dataUri, timestamp: Date.now() });
}

/**
 * Validates magic bytes to ensure the buffer is a valid JPEG or PNG.
 * Returns the exact MIME type or null if unsupported.
 */
export function detectSupportedImageMime(bytes: Buffer): "image/jpeg" | "image/png" | null {
  if (!bytes || bytes.length < 4) return null;

  // JPEG magic bytes: 0xFF 0xD8 0xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

/**
 * Safely resolves a stored student photo (from private Supabase Storage or local disk)
 * into a base64 Data URI for reliable embedding into React-PDF.
 *
 * Security & Reliability Safeguards:
 * 1. Only handles trusted internal paths (/api/files/, /media/group-members/, group-members/).
 * 2. Rejects arbitrary external URLs or localhost loops (SSRF protection).
 * 3. Enforces MAX_PHOTO_BYTES (2 MB) limit.
 * 4. Strictly validates image magic bytes (only JPEG and PNG supported by React-PDF).
 * 5. Returns null on any failure so broken or missing photos display the clean fallback
 *    without crashing the entire PDF generation process.
 */
export async function resolveStudentPhotoDataUri(
  rawPhotoUrl: string | null | undefined,
): Promise<string | null> {
  if (!rawPhotoUrl || typeof rawPhotoUrl !== "string") return null;
  const trimmed = rawPhotoUrl.trim();
  if (!trimmed) return null;

  // If already a valid data URI, validate format and return
  if (trimmed.startsWith("data:image/")) {
    const isJpegData = /^data:image\/jpe?g;base64,/i.test(trimmed);
    const isPngData = /^data:image\/png;base64,/i.test(trimmed);
    return isJpegData || isPngData ? trimmed : null;
  }

  // Check in-memory cache
  const cached = getCachedPhoto(trimmed);
  if (cached !== undefined) {
    return cached;
  }

  // Prevent SSRF: only allow internal upload paths
  const isInternalFile = trimmed.startsWith("/api/files/");
  const isLocalMedia = trimmed.startsWith("/media/group-members/");
  const isDirectRelative = trimmed.startsWith("group-members/");

  if (!isInternalFile && !isLocalMedia && !isDirectRelative) {
    console.warn(`[photo-resolver] Rejected non-internal photo path: ${trimmed}`);
    setCachedPhoto(trimmed, null);
    return null;
  }

  // Prevent path traversal
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    console.warn(`[photo-resolver] Rejected potentially unsafe path: ${trimmed}`);
    setCachedPhoto(trimmed, null);
    return null;
  }

  try {
    let result: { bytes: Buffer; contentType: string } | null = null;

    if (isInternalFile) {
      result = await readPrivateUpload(trimmed);
    } else if (isLocalMedia) {
      const rel = trimmed.replace(/^\/media\//, "");
      result = await readStoredUpload(rel);
    } else if (isDirectRelative) {
      result = await readStoredUpload(trimmed);
    }

    if (!result || !result.bytes || result.bytes.length === 0) {
      setCachedPhoto(trimmed, null);
      return null;
    }

    // Size check
    if (result.bytes.length > MAX_PHOTO_BYTES) {
      console.warn(
        `[photo-resolver] Photo exceeds max size limit (${result.bytes.length} > ${MAX_PHOTO_BYTES})`,
      );
      setCachedPhoto(trimmed, null);
      return null;
    }

    // Verify magic bytes
    const mime = detectSupportedImageMime(result.bytes);
    if (!mime) {
      console.warn(
        `[photo-resolver] Unsupported photo format (magic bytes not JPEG or PNG) for ${trimmed}`,
      );
      setCachedPhoto(trimmed, null);
      return null;
    }

    const dataUri = `data:${mime};base64,${result.bytes.toString("base64")}`;
    setCachedPhoto(trimmed, dataUri);
    return dataUri;
  } catch (error) {
    console.warn(
      `[photo-resolver] Failed to resolve photo:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    setCachedPhoto(trimmed, null);
    return null;
  }
}
