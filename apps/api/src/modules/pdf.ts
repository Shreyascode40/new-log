import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import { getGroupCompletion, type GroupCompletion } from "../completion/index.js";
import { getTopicSheet } from "./topic.js";
import { getMonthChart, ACTIVITY_MONTHS, type ActivityMonth } from "./activity-chart.js";
import { getContentPage, getChecklist, listCompetitions, listPapers, listNotes } from "./records.js";
import { getReviewSheet } from "./review.js";
import { getEvaluationSheet } from "./evaluation.js";
import { getExaminerSheet } from "./examiner.js";
import { getSponsoredSheet } from "./sponsored.js";

/**
 * Final PDF Service & Gate (F16, SPEC.md A2/A6).
 *
 * Rules:
 * - PDF permission allowed by HOD
 * - All mandatory sections complete
 * - User belongs to group, or is assigned guide, or is HOD
 * - Generating locks the group to PDF_GENERATED and audits PDF_GENERATE
 */

export type PdfActor = { id: string; role: string; name?: string };

export type PdfGateResult = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
    pdfPermission: boolean;
    isSponsored: boolean;
  };
  completion: GroupCompletion;
};

export type PdfExportResult = {
  exportId: string;
  downloadUrl: string;
  fileUrl: string;
};

function canGeneratePdf(
  user: PdfActor,
  group: { guideId?: string | null; members?: { userId: string }[]; pdfPermission?: boolean },
  allSectionsComplete: boolean,
): boolean {
  const permitted =
    user.role === "HOD" ||
    Boolean(group.members?.some((m) => m.userId === user.id)) ||
    group.guideId === user.id;
  return permitted && group.pdfPermission === true && allSectionsComplete === true;
}

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

export async function checkPdfGate(actor: PdfActor, groupId: string): Promise<PdfGateResult> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  const roleOk =
    actor.role === "HOD" ||
    group.members.some((member) => member.userId === actor.id) ||
    group.guideId === actor.id;
  if (!roleOk) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's PDF", 403);
  }

  const completion = await getGroupCompletion(groupId);
  const gate = canGeneratePdf(
    actor,
    {
      guideId: group.guideId,
      members: group.members,
      pdfPermission: group.pdfPermission,
    },
    completion.complete,
  );
  if (!gate) {
    if (!completion.complete) {
      throw new ApiDomainError(
        "INCOMPLETE",
        `Cannot generate the PDF: ${completion.missing.join(", ")} still incomplete`,
        400,
      );
    }
    throw new ApiDomainError("FORBIDDEN", "The HOD has not allowed PDF generation for this group yet", 403);
  }
  return { group, completion };
}

export async function recordPdfExport(
  actor: PdfActor,
  groupId: string,
  storageRef: string,
): Promise<PdfExportResult> {
  await checkPdfGate(actor, groupId);

  // Duplicate-generation protection: if an export for this group was recorded within the last 15 seconds, return it
  const recent = await prisma.pdfExport.findFirst({
    where: {
      groupId,
      generatedAt: { gte: new Date(Date.now() - 15000) },
    },
    orderBy: { generatedAt: "desc" },
  });
  if (recent) {
    return {
      exportId: recent.id,
      downloadUrl: `/api/pdf/${recent.id}`,
      fileUrl: recent.fileUrl,
    };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const saved = await tx.pdfExport.create({
        data: { groupId, generatedById: actor.id, fileUrl: storageRef },
      });
      const downloadUrl = `/api/pdf/${saved.id}`;
      await tx.group.update({ where: { id: groupId }, data: { status: "PDF_GENERATED" } });
      await logAction(
        {
          userId: actor.id,
          action: "PDF_GENERATE",
          entity: "PdfExport",
          entityId: saved.id,
          after: { url: downloadUrl },
        },
        tx,
      );
      return { exportId: saved.id, downloadUrl, fileUrl: storageRef };
    },
    { maxWait: 20000, timeout: 45000 },
  );

  return result;
}

const REVIEW_ORDER = [
  "REVIEW_I",
  "REVIEW_II",
  "FINAL_DESIGN",
  "REVIEW_I_MODELING",
  "REVIEW_II_CODING",
  "FINAL_VALIDATION",
  "REPORT_WRITING",
] as const;

const SCHEDULE_TERMS = [
  { term: "SEMESTER_I", label: "Semester I" },
  { term: "SEMESTER_II", label: "Semester II" },
] as const;

export async function getGroupLogbookBundle(actor: PdfActor, groupId: string) {
  const { group } = await checkPdfGate(actor, groupId);

  const [
    groupRecord,
    scheduleItems,
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
    prisma.group.findUnique({
      where: { id: groupId },
      include: {
        guide: { select: { name: true } },
        members: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.scheduleItem.findMany({ orderBy: { sortOrder: "asc" } }),
    getTopicSheet(actor, groupId),
    Promise.all(
      (ACTIVITY_MONTHS as readonly ActivityMonth[]).map((month) =>
        getMonthChart(actor, groupId, month),
      ),
    ),
    getContentPage(groupId, "RTM"),
    getContentPage(groupId, "COST"),
    Promise.all(
      REVIEW_ORDER.map((reviewType) => getReviewSheet(groupId, reviewType)),
    ),
    getEvaluationSheet(groupId, "MOCK_T1"),
    getEvaluationSheet(groupId, "FINAL_T2"),
    getExaminerSheet(groupId, "TERM_I"),
    getExaminerSheet(groupId, "TERM_II"),
    getChecklist(groupId, "TERM_I"),
    getChecklist(groupId, "TERM_II"),
    listCompetitions(groupId),
    listPapers(groupId),
    listNotes(groupId),
    group.isSponsored ? getSponsoredSheet(groupId) : Promise.resolve(null),
  ]);

  if (!groupRecord) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  const terms = SCHEDULE_TERMS.map(({ term, label }) => ({
    term,
    title: label,
    items: scheduleItems
      .filter((item) => item.term === term)
      .map((item) => ({
        id: item.id,
        term: item.term,
        sortOrder: item.sortOrder,
        description: item.description,
        targetDate: item.date ?? null,
        completionDate: item.note ?? null,
      })),
  }));

  return {
    groupInfo: {
      ...groupRecord,
      guide: groupRecord.guide,
      members: groupRecord.members,
    },
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

export async function getPdfExport(actor: PdfActor, exportId: string) {
  const pdf = await prisma.pdfExport.findUnique({
    where: { id: exportId },
    select: {
      fileUrl: true,
      group: {
        select: {
          groupNo: true,
          guideId: true,
          pdfPermission: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!pdf) throw new ApiDomainError("NOT_FOUND", "PDF not found", 404);

  const canView =
    actor.role === "HOD" ||
    pdf.group.members.some((m) => m.userId === actor.id) ||
    pdf.group.guideId === actor.id;
  if (!canView) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's PDF", 403);
  }
  if (!pdf.group.pdfPermission && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "The HOD has revoked PDF access", 403);
  }

  return { fileUrl: pdf.fileUrl, groupNo: pdf.group.groupNo };
}

export async function listGroupPdfExports(actor: PdfActor, groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      guideId: true,
      members: { select: { userId: true } },
    },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  const canView =
    actor.role === "HOD" ||
    group.members.some((m) => m.userId === actor.id) ||
    group.guideId === actor.id;
  if (!canView) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's PDF exports", 403);
  }
  return prisma.pdfExport.findMany({
    where: { groupId },
    orderBy: { generatedAt: "desc" },
  });
}

function possibleUrls(fileUrl: string): string[] {
  const set = new Set<string>([fileUrl]);
  const match = /^\/api\/files\/([A-Za-z0-9_-]+)(?:\.(?:jpe?g|png|pdf))?$/i.exec(fileUrl);
  if (match) {
    try {
      const decoded = Buffer.from(match[1], "base64url").toString("utf8");
      const slash = decoded.indexOf("/");
      if (slash > 0) {
        const objectPath = decoded.slice(slash + 1);
        set.add(`/media/${objectPath}`);
        set.add(objectPath);
      }
    } catch {}
  } else if (fileUrl.startsWith("/media/")) {
    const objectPath = fileUrl.slice("/media/".length);
    set.add(objectPath);
  }
  return Array.from(set);
}

export async function authorizeFileAccess(actor: PdfActor, fileUrl: string) {
  const groupAccess = {
    select: { guideId: true, members: { select: { userId: true } } },
  } as const;

  const urls = possibleUrls(fileUrl);
  const [members, competitions, papers, contents, sponsors] = await Promise.all([
    prisma.groupMember.findMany({ where: { photoUrl: { in: urls } }, select: { userId: true, group: groupAccess } }),
    prisma.competition.findMany({ where: { certificateUrl: { in: urls } }, select: { group: groupAccess } }),
    prisma.paperPublication.findMany({ where: { fileUrl: { in: urls } }, select: { group: groupAccess } }),
    prisma.contentPage.findMany({ where: { fileUrl: { in: urls } }, select: { group: groupAccess } }),
    prisma.sponsorFeedback.findMany({ where: { sealUrl: { in: urls } }, select: { group: groupAccess } }),
  ]);
  const owners = [...members, ...competitions, ...papers, ...contents, ...sponsors];
  if (owners.length === 0) throw new ApiDomainError("NOT_FOUND", "File not found", 404);

  const canView =
    actor.role === "HOD" ||
    actor.role === "SYSTEM" ||
    actor.id === "system" ||
    members.some((m) => m.userId === actor.id) ||
    owners.some(
      (owner) =>
        owner.group &&
        (owner.group.members.some((m) => m.userId === actor.id) || owner.group.guideId === actor.id),
    );
  if (!canView) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's file", 403);
  }

  return { allowed: true };
}

export async function authorizeMediaPdf(actor: PdfActor, fileUrl: string) {
  const pdf = await prisma.pdfExport.findFirst({
    where: { fileUrl },
    select: {
      group: {
        select: {
          guideId: true,
          pdfPermission: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!pdf) throw new ApiDomainError("NOT_FOUND", "Not found", 404);

  const canView =
    actor.role === "HOD" ||
    pdf.group.members.some((m) => m.userId === actor.id) ||
    pdf.group.guideId === actor.id;
  const permissionOpen = pdf.group.pdfPermission || actor.role === "HOD";
  if (!canView || !permissionOpen) {
    throw new ApiDomainError("FORBIDDEN", "You cannot download this PDF.", 403);
  }

  return { allowed: true };
}
