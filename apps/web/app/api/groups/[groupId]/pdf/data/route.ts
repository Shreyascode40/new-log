import { NextResponse, type NextRequest } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/permissions";
import { checkPdfGate } from "@/lib/services/pdf";
import { AppError } from "@/lib/errors";
import { backendApi, BackendApiError } from "@/lib/backend-api";
import { getGroupInfoById } from "@/lib/services/group-info";
import { ACTIVITY_MONTHS, type ActivityMonth } from "@/lib/constants";
import { getSchedule } from "@/lib/services/schedule";
import { getTopicSheet } from "@/lib/services/topic";
import { getMonthChart } from "@/lib/services/activity-chart";
import {
  getChecklist,
  getContentPage,
  listCompetitions,
  listNotes,
  listPapers,
} from "@/lib/services/records";
import { getReviewSheet } from "@/lib/services/review";
import { getMockSheet } from "@/lib/services/mock";
import { getFinalSheet } from "@/lib/services/final";
import { getExaminerSheet } from "@/lib/services/examiner";
import { getSponsoredSheet } from "@/lib/services/sponsored";
import { rateLimit } from "@/lib/rate-limit";
import { resolveStudentPhotoDataUri } from "@/lib/services/photo-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEW_ORDER = [
  "REVIEW_I",
  "REVIEW_II",
  "FINAL_DESIGN",
  "REVIEW_I_MODELING",
  "REVIEW_II_CODING",
  "FINAL_VALIDATION",
  "REPORT_WRITING",
];

// In-memory cache for static logos so disk files are only read once per process
const logoCache = new Map<string, string | null>();

function getLogoBase64(relativePublicPath: string): string | null {
  if (logoCache.has(relativePublicPath)) {
    return logoCache.get(relativePublicPath)!;
  }

  try {
    const candidates = [
      path.join(process.cwd(), "public", relativePublicPath),
      path.join(process.cwd(), "apps", "web", "public", relativePublicPath),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        const buffer = readFileSync(filePath);
        const ext = path.extname(filePath).replace(".", "").toLowerCase();
        const mime =
          ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "image/webp";
        const result = `data:${mime};base64,${buffer.toString("base64")}`;
        logoCache.set(relativePublicPath, result);
        return result;
      }
    }
    logoCache.set(relativePublicPath, null);
    return null;
  } catch {
    logoCache.set(relativePublicPath, null);
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  // Rate limit: max 15 PDF data fetches per minute per user
  const rl = await rateLimit(`pdf-data:${user.id}`, 15, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many PDF data requests. Please wait a moment before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    // 1. Authorization & PDF gate checks (F16)
    // Server independently validates: user belongs to group, or is guide/HOD;
    // HOD pdfPermission === true; all mandatory sections are 100% complete
    console.log(`[pdf/data] Step 1: user ${user.id} (${user.role}), checking gate for group ${params.groupId}...`);
    const { group } = await checkPdfGate(
      { id: user.id, role: user.role },
      params.groupId,
    );
    console.log(`[pdf/data] Step 2: checkPdfGate OK for group ${group.id}`);

    // 2. Fetch full logbook data:
    // First attempt the single consolidated bundle endpoint from backendApi (1 network hop),
    // and gracefully fall back to individual service requests if unavailable.
    console.log(`[pdf/data] Step 3: fetching logbook bundle from backend...`);
    let bundleData: unknown = null;
    try {
      bundleData = await backendApi(
        `/v1/pdf/groups/${encodeURIComponent(params.groupId)}/bundle`,
      );
      console.log(`[pdf/data] Step 4: bundle received from backendApi.`);
    } catch (bundleErr) {
      console.warn(`[pdf/data] Step 4: bundle failed, falling back to services:`, bundleErr);
      bundleData = null;
    }

    let payload: Record<string, unknown>;

    if (bundleData && typeof bundleData === "object") {
      payload = bundleData as Record<string, unknown>;
    } else {
      const groupInfo = await getGroupInfoById(params.groupId);
      if (!groupInfo) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const [
        terms,
        topics,
        monthCharts,
        rtm,
        cost,
        reviews,
        mock,
        finall,
        examinerI,
        examinerII,
        checklistI,
        checklistII,
        competitions,
        papers,
        notes,
        sponsored,
      ] = await Promise.all([
        getSchedule(),
        getTopicSheet(group.id),
        Promise.all(
          (ACTIVITY_MONTHS as readonly ActivityMonth[]).map((month) =>
            getMonthChart(group.id, month),
          ),
        ),
        getContentPage(group.id, "RTM"),
        getContentPage(group.id, "COST"),
        Promise.all(
          REVIEW_ORDER.map((reviewType) => getReviewSheet(group.id, reviewType)),
        ),
        getMockSheet(group.id),
        getFinalSheet(group.id),
        getExaminerSheet(group.id, "TERM_I"),
        getExaminerSheet(group.id, "TERM_II"),
        getChecklist(group.id, "TERM_I"),
        getChecklist(group.id, "TERM_II"),
        listCompetitions(group.id),
        listPapers(group.id),
        listNotes(group.id),
        group.isSponsored ? getSponsoredSheet(group.id) : Promise.resolve(null),
      ]);

      payload = {
        groupInfo,
        terms,
        topics,
        monthCharts,
        rtm,
        cost,
        reviews,
        mock,
        final: finall,
        examinerI,
        examinerII,
        checklistI,
        checklistII,
        competitions,
        papers,
        notes,
        sponsored,
      };
    }

    // 3. Pre-load static logos as base64 data URLs for seamless rendering in @react-pdf/renderer
    const logos = {
      collegeCrest:
        getLogoBase64("logos/college-crest.png") ||
        getLogoBase64("logos/college-crest.webp"),
      founderPortrait:
        getLogoBase64("logos/founder-portrait.png") ||
        getLogoBase64("logos/founder-portrait.webp"),
      collegeBuilding:
        getLogoBase64("cover/college-building.png") ||
        getLogoBase64("cover/college-building.webp"),
    };

    // 4. Pre-resolve student profile photos to base64 Data URIs so @react-pdf/renderer
    // embeds them directly in memory without making client-side requests or failing on private/relative URLs.
    if (
      payload.groupInfo &&
      typeof payload.groupInfo === "object" &&
      Array.isArray((payload.groupInfo as Record<string, unknown>).members)
    ) {
      const rawMembers = (payload.groupInfo as { members: Array<Record<string, unknown>> }).members;
      const resolvedMembers = await Promise.all(
        rawMembers.map(async (member) => {
          const rawPhotoUrl = typeof member.photoUrl === "string" ? member.photoUrl : null;
          const photoDataUri = await resolveStudentPhotoDataUri(rawPhotoUrl);
          return {
            ...member,
            photoUrl: photoDataUri,
          };
        }),
      );
      (payload.groupInfo as { members: unknown[] }).members = resolvedMembers;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...payload,
        logos,
      },
    });
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
    const message =
      error instanceof Error ? error.message : "Failed to load logbook data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
