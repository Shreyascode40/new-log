import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { backendApi, BackendApiError } from "@/lib/backend-api";
import { checkPdfGate, listPdfExports } from "@/lib/services/pdf";
import { saveGeneratedPdf, readGeneratedPdf, deleteGeneratedPdf } from "@/lib/upload";
import { rateLimit } from "@/lib/rate-limit";
import {
  MAX_PDF_BYTES,
  MIN_PDF_BYTES,
  validatePdfStructure,
} from "@/lib/validation/pdf-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

// In-flight concurrency lock to prevent simultaneous duplicate uploads for the same group
const inFlightGroupUploads = new Map<string, Promise<NextResponse>>();

/**
 * Upload endpoint for frontend-generated React PDF.
 * Validates:
 * - Content-Type (must be multipart/form-data)
 * - Rate limits (per user / IP)
 * - Session and gate authorization (role, group membership, completion, HOD permission)
 * - File size (min 300B, max 15MB)
 * - PDF structural integrity (header, trailer, /Root, /Pages, xref)
 * - Server-isolated storage paths
 * - Orphan cleanup on database failure
 * - Deduplication for concurrent and recent duplicate requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } },
) {
  // 1. Content-Type check (HTTP 415)
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data." },
      { status: 415 },
    );
  }

  // 2. Early Content-Length check (HTTP 413)
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `Upload payload exceeds the maximum allowed size of ${MAX_PDF_BYTES / (1024 * 1024)}MB.` },
      { status: 413 },
    );
  }

  // 3. User authentication (HTTP 401)
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  // 4. Rate limiting: max 6 uploads per minute per user (HTTP 429)
  const rl = await rateLimit(`pdf-upload:${user.id}`, 6, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many PDF upload requests. Please wait a moment before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  // 5. In-flight concurrency lock: if a generation/upload for this group is already running,
  // await it and return the result rather than triggering a race condition.
  const existingInFlight = inFlightGroupUploads.get(params.groupId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const uploadPromise = (async () => {
    try {
      // 6. Server-side Gate Authorization
      // Independently verifies: user belongs to group or is assigned guide/HOD,
      // HOD pdfPermission === true, and all mandatory sections are 100% complete.
      const { group } = await checkPdfGate(
        { id: user.id, role: user.role },
        params.groupId,
      );

      // 7. Parse request form data
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No PDF file provided in request." },
          { status: 400 },
        );
      }

      // 8. File size checks (HTTP 400 / 413)
      if (file.size < MIN_PDF_BYTES) {
        return NextResponse.json(
          { error: `File is too small (${file.size} bytes) to be a valid PDF document.` },
          { status: 400 },
        );
      }

      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: `PDF file size (${Math.round(file.size / 1024)} KB) exceeds maximum allowed size of 15 MB.` },
          { status: 413 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);

      // 9. Lightweight PDF structural validation (Header, Trailer, Root, Pages, XRef)
      const validation = validatePdfStructure(bytes);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Malformed PDF document." },
          { status: 400 },
        );
      }

      // 10. Server-generated storage path: strictly isolates by group ID, ignores client path
      const slug =
        (group.groupNo ?? group.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) ||
        "group";
      const uniqueSuffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
      const fileName = `groups/${group.id}/${slug}-${uniqueSuffix}.pdf`;

      // 11. Upload to private Supabase Storage bucket
      let storageRef: string;
      try {
        storageRef = await saveGeneratedPdf(fileName, bytes);
      } catch (uploadError) {
        console.error("Supabase storage upload failed:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload PDF to secure storage. Please try again." },
          { status: 503 },
        );
      }

      // 12. Register the export record in Prisma backend API
      try {
        const saved = await backendApi<{
          exportId: string;
          downloadUrl: string;
          fileUrl: string;
        }>("/v1/pdf/exports", {
          method: "POST",
          body: JSON.stringify({
            groupId: params.groupId,
            storageRef,
          }),
        });

        return NextResponse.json({
          success: true,
          exportId: saved.exportId,
          downloadUrl: saved.downloadUrl,
          fileName: `${slug}-logbook.pdf`,
        });
      } catch (dbError) {
        // Orphan cleanup: If database record creation fails, delete the uploaded file
        // from Supabase storage so orphaned files do not accumulate.
        console.error("Database export registration failed; rolling back uploaded storage file:", dbError);
        await deleteGeneratedPdf(storageRef).catch(() => {});
        throw dbError;
      }
    } catch (error) {
      if (error instanceof BackendApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }

      if (error instanceof AppError) {
        const status =
          error.code === "GROUP_NOT_FOUND"
            ? 404
            : error.code === "INCOMPLETE"
              ? 400
              : error.code === "UPLOAD_NOT_CONFIGURED" || error.code === "UPLOAD_FAILED"
                ? 503
                : 403;
        return NextResponse.json({ error: error.message }, { status });
      }

      console.error(
        "PDF upload endpoint error:",
        error instanceof Error ? { name: error.name, message: error.message } : error,
      );

      return NextResponse.json(
        { error: "PDF storage and registration failed. Please try again." },
        { status: 500 },
      );
    } finally {
      inFlightGroupUploads.delete(params.groupId);
    }
  })();

  inFlightGroupUploads.set(params.groupId, uploadPromise);
  return uploadPromise;
}

/**
 * Final PDF download (F16).
 * Checks authentication and authorization.
 * If an archived PDF exists in storage, streams it directly as application/pdf.
 * Otherwise returns a clean JSON error.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  try {
    await checkPdfGate(
      { id: user.id, role: user.role },
      params.groupId,
    );

    const exports = await listPdfExports(params.groupId).catch(() => []);
    if (exports.length > 0) {
      const latest = exports[0];
      const bytes = await readGeneratedPdf(latest.fileUrl);
      const fileName = `logbook-${params.groupId}.pdf`;

      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json(
      { error: "No PDF generated yet. Please generate the PDF from the student portal." },
      { status: 404 },
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof AppError) {
      const status =
        error.code === "GROUP_NOT_FOUND"
          ? 404
          : error.code === "INCOMPLETE"
            ? 400
            : 403;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "PDF access failed. Please try again." },
      { status: 500 },
    );
  }
}
