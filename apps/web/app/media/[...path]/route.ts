import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backend-api";
import { readStoredUpload } from "@/lib/upload";

/**
 * Serves locally stored uploads (`var/uploads`) with the right content type.
 * Needed because `next start` does not serve files added to `public/` after the
 * build. With UPLOAD_PROVIDER="supabase" files live in Supabase Storage
 * instead, so this route is dev-only in practice but always safe to leave in
 * place.
 *
 * Generated final PDFs are private: unlike certificates and photos, a PDF
 * contains the whole logbook. It is only served to a signed-in user who can
 * view its group (and only while PDF permission is still granted, except for
 * the HOD).
 */

export const dynamic = "force-dynamic";

async function authorizeMediaFile(pathParts: string[]): Promise<NextResponse | null> {
  const relative = pathParts.join("/");
  if (!relative || relative.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isPdf = pathParts[0]?.toLowerCase() === "pdf";
  const fileUrl = `/media/${relative}`;
  const endpoint = isPdf
    ? `/v1/files/authorize-media-pdf?fileUrl=${encodeURIComponent(fileUrl)}`
    : `/v1/files/authorize?fileUrl=${encodeURIComponent(fileUrl)}`;

  try {
    await backendApi<{ allowed: boolean }>(endpoint);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Access denied";
    const status = message.includes("Authentication required")
      ? 401
      : message.includes("Not found") || message.includes("not found")
        ? 404
        : 403;
    return new NextResponse(message, { status });
  }
}

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const pathParts = params.path ?? [];
  const denied = await authorizeMediaFile(pathParts);
  if (denied) return denied;

  const relative = pathParts.join("/");
  const stored = await readStoredUpload(relative);
  if (!stored) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
