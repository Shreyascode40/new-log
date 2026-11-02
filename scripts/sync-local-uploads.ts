import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

/**
 * Copies every file under var/uploads to Supabase Storage and optionally
 * rewrites DB references that still point at local `/media/...` URLs.
 *
 * Run:
 *   npx tsx scripts/sync-local-uploads.ts            # upload only
 *   npx tsx scripts/sync-local-uploads.ts --update-db # upload + rewrite URLs
 *
 * Existing uploads used /media/... URLs, which only work while the files sit on
 * the web server's disk. Vercel has an ephemeral filesystem, so those photos
 * returned 404 in production. Uploading them and switching DB refs to
 * /api/files/... (or supabase-pdf://...) makes them available to the deployed
 * app immediately.
 */

try {
  loadEnvFile(process.env.ENV_FILE ?? ".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

const ROOT = path.join(process.cwd(), "var", "uploads");
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

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function main() {
  const updateDb = process.argv.includes("--update-db");
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = (
    process.env.SUPABASE_PRIVATE_BUCKET ||
    process.env.SUPABASE_BUCKET ||
    "logbook-uploads"
  ).trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before syncing uploads.");
  }

  const storage = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;

  const files = await walk(ROOT);
  const uploaded = new Set<string>();
  for (const file of files) {
    const objectPath = path.relative(ROOT, file).split(path.sep).join("/");
    if (!objectPath || objectPath.startsWith("..")) continue;
    const bytes = await readFile(file);
    const { error } = await storage.from(bucket).upload(objectPath, bytes, {
      contentType: contentTypeFor(file),
      upsert: true,
    });
    if (error) throw new Error(`Could not upload ${objectPath}: ${error.message}`);
    uploaded.add(objectPath);
    console.log(`Uploaded ${objectPath} (${bytes.byteLength} bytes)`);
  }
  console.log(`\nUploaded ${uploaded.size} file(s) to bucket "${bucket}".`);

  if (!updateDb) {
    console.log("Run again with --update-db to rewrite /media/... references.");
    return;
  }

  let updated = 0;

  async function migrate(url: string | null, kind: string, update: (next: string) => Promise<unknown>) {
    if (!url || !url.startsWith("/media/")) return;
    const objectPath = url.slice("/media/".length);
    if (!uploaded.has(objectPath)) {
      console.warn(`Skipped ${kind}: ${objectPath} was not uploaded.`);
      return;
    }
    if (objectPath.startsWith("pdf/")) {
      const next = `supabase-pdf://${bucket}/${objectPath}`;
      await update(next);
      updated += 1;
      console.log(`Updated ${kind}: ${url} -> ${next}`);
      return;
    }
    const token = Buffer.from(`${bucket}/${objectPath}`).toString("base64url");
    const next = `/api/files/${token}${path.extname(objectPath).toLowerCase()}`;
    await update(next);
    updated += 1;
    console.log(`Updated ${kind}: ${url} -> ${next}`);
  }

  const members = await prisma.groupMember.findMany({
    where: { photoUrl: { startsWith: "/media/" } },
    select: { id: true, photoUrl: true },
  });
  for (const row of members) {
    await migrate(row.photoUrl, `member photo ${row.id}`, (photoUrl) =>
      prisma.groupMember.update({ where: { id: row.id }, data: { photoUrl } }),
    );
  }

  const competitions = await prisma.competition.findMany({
    where: { certificateUrl: { startsWith: "/media/" } },
    select: { id: true, certificateUrl: true },
  });
  for (const row of competitions) {
    await migrate(row.certificateUrl, `competition ${row.id}`, (certificateUrl) =>
      prisma.competition.update({ where: { id: row.id }, data: { certificateUrl } }),
    );
  }

  const papers = await prisma.paperPublication.findMany({
    where: { fileUrl: { startsWith: "/media/" } },
    select: { id: true, fileUrl: true },
  });
  for (const row of papers) {
    await migrate(row.fileUrl, `paper ${row.id}`, (fileUrl) =>
      prisma.paperPublication.update({ where: { id: row.id }, data: { fileUrl } }),
    );
  }

  const pages = await prisma.contentPage.findMany({
    where: { fileUrl: { startsWith: "/media/" } },
    select: { id: true, fileUrl: true },
  });
  for (const row of pages) {
    await migrate(row.fileUrl, `content page ${row.id}`, (fileUrl) =>
      prisma.contentPage.update({ where: { id: row.id }, data: { fileUrl } }),
    );
  }

  const feedback = await prisma.sponsorFeedback.findMany({
    where: { sealUrl: { startsWith: "/media/" } },
    select: { id: true, sealUrl: true },
  });
  for (const row of feedback) {
    await migrate(row.sealUrl, `sponsor feedback ${row.id}`, (sealUrl) =>
      prisma.sponsorFeedback.update({ where: { id: row.id }, data: { sealUrl } }),
    );
  }

  const exports = await prisma.pdfExport.findMany({
    where: { fileUrl: { startsWith: "/media/pdf/" } },
    select: { id: true, fileUrl: true },
  });
  for (const row of exports) {
    await migrate(row.fileUrl, `PDF export ${row.id}`, (fileUrl) =>
      prisma.pdfExport.update({ where: { id: row.id }, data: { fileUrl } }),
    );
  }

  console.log(`\nUpdated ${updated} database reference(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
