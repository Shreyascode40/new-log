import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";

/**
 * File storage with two providers, selected by UPLOAD_PROVIDER:
 *   - "local" (dev default): writes to `var/uploads` on local disk and serves
 *     through the `/media/[...path]` route handler (files added to `public/`
 *     at runtime are not served by `next start`).
 *   - "supabase" (production): uploads to a private Supabase Storage bucket
 *     and stores an app-proxied URL. The file route checks group access.
 * Only the persistence step differs per provider; validation rules, file
 * naming and the StoredFile shape are identical, so call-sites stay a
 * one-line change.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB (SPEC.md B3)
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

/** Certificates, papers and content files (SPEC.md B12): PDF or scans. */
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type StoredFile = { url: string; bytes: number };

const SUPABASE_PDF_PREFIX = "supabase-pdf://";

export function uploadProvider(): string {
  const configured = (process.env.UPLOAD_PROVIDER ?? "").trim().toLowerCase();
  const hasSupabaseCredentials = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Vercel (and any production deployment) has an ephemeral filesystem. If the
  // provider was left at the development default, use the configured Supabase
  // bucket instead of writing photos/PDFs that disappear on the next request.
  if (
    configured !== "supabase" &&
    hasSupabaseCredentials &&
    (process.env.VERCEL === "1" || process.env.NODE_ENV === "production")
  ) {
    return "supabase";
  }
  return configured || "local";
}

/** Absolute path of the local upload root (local provider only). */
export function uploadRoot(): string {
  const candidates = [
    path.join(process.cwd(), "var", "uploads"),
    path.join(process.cwd(), "..", "..", "var", "uploads"),
    path.join(process.cwd(), "..", "var", "uploads"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), "var", "uploads");
}

export type StoredUpload = { bytes: Buffer; contentType: string };

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/** Rejects absolute paths and any `..` segment before touching disk or storage. */
function normalizeObjectPath(objectPath: string): string | null {
  const normalized = objectPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) return null;
  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return normalized;
}

/**
 * Buckets to search for an existing object. Old deployments stored team photos
 * and final PDFs under the public `logbook-uploads` bucket, while newer uploads
 * use the private bucket. Try both so existing rows keep working after a
 * provider/bucket change.
 */
function storageBuckets(preferred: Array<string | undefined> = []): string[] {
  return Array.from(
    new Set(
      [
        ...preferred,
        process.env.SUPABASE_PRIVATE_BUCKET,
        process.env.SUPABASE_BUCKET,
        process.env.SUPABASE_PDF_BUCKET,
        "logbook-uploads",
        "logbook-private-uploads",
      ]
        .map((bucket) => (bucket ?? "").trim())
        .filter(Boolean),
    ),
  );
}

async function downloadFromSupabase(
  objectPath: string,
  preferredBuckets: Array<string | undefined> = [],
): Promise<StoredUpload | null> {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const bucket of storageBuckets(preferredBuckets)) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (!error && data) {
      return {
        bytes: Buffer.from(await data.arrayBuffer()),
        contentType: contentTypeFor(objectPath),
      };
    }
  }
  return null;
}

/**
 * Reads a stored upload by its relative path (`group-members/file.jpg`,
 * `pdf/file.pdf`, ...). Local disk wins in development; on Vercel the local
 * file does not exist, so the same path is fetched from Supabase Storage.
 * Used by the `/media/[...path]` route and the private download endpoints.
 */
export async function readStoredUpload(
  objectPath: string,
  preferredBuckets: Array<string | undefined> = [],
): Promise<StoredUpload | null> {
  const normalized = normalizeObjectPath(objectPath);
  if (!normalized) return null;

  const root = uploadRoot();
  const localCandidates = [
    path.resolve(root, normalized),
    ...(normalized.startsWith("pdf/") ? [] : [path.resolve(root, "pdf", normalized)]),
  ];

  for (const full of localCandidates) {
    if (full.startsWith(root + path.sep)) {
      try {
        return { bytes: await readFile(full), contentType: contentTypeFor(full) };
      } catch {
        // Not on disk - check next candidate or fall through to Supabase Storage.
      }
    }
  }

  const res = await downloadFromSupabase(normalized, preferredBuckets);
  if (res) return res;

  if (normalized.endsWith(".pdf") && !normalized.startsWith("pdf/")) {
    return downloadFromSupabase(`pdf/${normalized}`, preferredBuckets);
  }

  return null;
}

function fileNameFor(baseName: string, ext: string): string {
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "file";
  return `${safeBase}-${Date.now()}.${ext}`;
}

/**
 * Persists bytes via the configured provider and returns a local or authorized URL.
 */
async function persistFile(
  subdir: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (uploadProvider() === "supabase") {
    return uploadToSupabase(subdir, fileName, bytes, contentType);
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new AppError("UPLOAD_NOT_CONFIGURED", "Set UPLOAD_PROVIDER=supabase for production file uploads.");
  }
  const dir = path.join(uploadRoot(), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), bytes);
  return `/media/${subdir}/${fileName}`;
}

/**
 * Uploads to the private Supabase Storage bucket. Throws AppError (not raw SDK
 * errors) so actions surface a clean message. The service-role key never
 * leaves the server: this module is imported by server code only.
 */
async function uploadToSupabase(
  subdir: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = (
    process.env.SUPABASE_PRIVATE_BUCKET ||
    process.env.SUPABASE_BUCKET ||
    ""
  ).trim();
  if (!url || !serviceKey || !bucket) {
    throw new AppError(
      "UPLOAD_NOT_CONFIGURED",
      "Private uploads are not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PRIVATE_BUCKET.",
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objectPath = `${subdir}/${fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new AppError("UPLOAD_FAILED", `Supabase upload failed: ${error.message}`);
  }
  const reference = Buffer.from(`${bucket}/${objectPath}`).toString("base64url");
  return `/api/files/${reference}${path.extname(objectPath).toLowerCase()}`;
}

/** Reads an uploaded file from private storage after the route authorizes its DB owner. */
export async function readPrivateUpload(fileUrl: string): Promise<StoredUpload> {
  const match = /^\/api\/files\/([A-Za-z0-9_-]+)\.(?:jpe?g|png|pdf)$/i.exec(fileUrl);
  if (!match) throw new AppError("FILE_NOT_FOUND", "Stored file reference is invalid.");
  const reference = Buffer.from(match[1]!, "base64url").toString("utf8");
  const separator = reference.indexOf("/");
  if (separator <= 0 || separator === reference.length - 1) {
    throw new AppError("FILE_NOT_FOUND", "Stored file reference is invalid.");
  }
  const bucket = reference.slice(0, separator);
  const objectPath = reference.slice(separator + 1);

  const stored = await readStoredUpload(objectPath, [bucket]);
  if (!stored) throw new AppError("FILE_NOT_FOUND", "Stored file was not found.");
  return stored;
}

/**
 * Generated logbooks contain private student information. Keep them in a
 * dedicated PRIVATE bucket and store an opaque storage reference in Prisma;
 * downloads are streamed through the authenticated /api/pdf route.
 */
export async function saveGeneratedPdf(fileName: string, bytes: Buffer): Promise<string> {
  if (uploadProvider() !== "supabase") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new AppError(
        "UPLOAD_NOT_CONFIGURED",
        "Configure UPLOAD_PROVIDER=supabase and a private SUPABASE_PDF_BUCKET before generating production PDFs.",
      );
    }
    const dir = path.join(uploadRoot(), "pdf");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    return `/media/pdf/${fileName}`;
  }

  const url = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = (
    process.env.SUPABASE_PDF_BUCKET ||
    process.env.SUPABASE_PRIVATE_BUCKET ||
    process.env.SUPABASE_BUCKET ||
    ""
  ).trim();
  if (!url || !serviceKey || !bucket) {
    throw new AppError(
      "UPLOAD_NOT_CONFIGURED",
      "PDF storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PDF_BUCKET.",
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objectPath = fileName;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw new AppError("UPLOAD_FAILED", `PDF storage upload failed: ${error.message}`);
  return `${SUPABASE_PDF_PREFIX}${bucket}/${objectPath}`;
}

/** Reads a generated PDF from either local development storage or private Supabase Storage. */
export async function readGeneratedPdf(fileUrl: string): Promise<Buffer> {
  if (fileUrl.startsWith(SUPABASE_PDF_PREFIX)) {
    const reference = fileUrl.slice(SUPABASE_PDF_PREFIX.length);
    const separator = reference.indexOf("/");
    if (separator <= 0 || separator === reference.length - 1) {
      throw new AppError("PDF_NOT_FOUND", "Stored PDF reference is invalid.");
    }
    const bucket = reference.slice(0, separator);
    const objectPath = reference.slice(separator + 1);
    const stored = await readStoredUpload(objectPath, [bucket]);
    if (!stored) throw new AppError("PDF_NOT_FOUND", "Stored PDF was not found.");
    return stored.bytes;
  }

  const match = /^\/media\/pdf\/([a-zA-Z0-9_-]+\.pdf)$/.exec(fileUrl);
  if (!match) throw new AppError("PDF_NOT_FOUND", "Stored PDF reference is invalid.");
  // Older exports stored only a local `/media/pdf/...` path. On Vercel the
  // file is not on disk, so look for the same relative path in Supabase.
  const stored = await readStoredUpload(`pdf/${match[1]}`);
  if (!stored) throw new AppError("PDF_NOT_FOUND", "Stored PDF was not found.");
  return stored.bytes;
}

/**
 * Persists an uploaded file and returns the public URL: served by the `/media`
 * route on the local provider, absolute Supabase URL otherwise. The file name
 * is namespaced with a timestamp so re-uploads never collide and the browser
 * cache is busted.
 */
export async function saveUpload(file: File, subdir: string, baseName: string): Promise<StoredFile> {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await persistFile(subdir, fileNameFor(baseName, ext), bytes, file.type);

  return { url, bytes: bytes.byteLength };
}

/**
 * Persists a document (PDF or scanned image) for competitions, papers and
 * content pages. Type and size are enforced here so every call-site is safe.
 */
export async function saveDocument(file: File, subdir: string, baseName: string): Promise<StoredFile> {
  if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError("INVALID_FILE", "Only PDF, JPG or PNG files can be uploaded");
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new AppError("FILE_TOO_BIG", "Files must be at most 10 MB");
  }
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await persistFile(subdir, fileNameFor(baseName, ext), bytes, file.type);

  return { url, bytes: bytes.byteLength };
}
