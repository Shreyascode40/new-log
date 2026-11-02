import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

try { loadEnvFile(".env"); } catch {}

// Prefer direct connection for backups to bypass connection pool timeouts
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});

async function main() {
  console.log("Starting database backup...");

  const [
    users,
    groups,
    groupMembers,
    groupInvites,
    topicProposals,
    scheduleItems,
    activityTemplates,
    activityEntries,
    activityEntryHistories,
    reviewTemplates,
    reviewQuestions,
    reviewForms,
    reviewScores,
    marksSheets,
    examinerFeedbacks,
    checklists,
    competitions,
    paperPublications,
    sponsoredMeetings,
    sponsorFeedbacks,
    contentPages,
    pdfExports,
    auditLogs,
    notifications,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.group.findMany(),
    prisma.groupMember.findMany(),
    prisma.groupInvite.findMany(),
    prisma.topicProposal.findMany(),
    prisma.scheduleItem.findMany(),
    prisma.activityTemplate.findMany(),
    prisma.activityEntry.findMany(),
    prisma.activityEntryHistory.findMany(),
    prisma.reviewTemplate.findMany(),
    prisma.reviewQuestion.findMany(),
    prisma.reviewForm.findMany(),
    prisma.reviewScore.findMany(),
    prisma.marksSheet.findMany(),
    prisma.examinerFeedback.findMany(),
    prisma.checklist.findMany(),
    prisma.competition.findMany(),
    prisma.paperPublication.findMany(),
    prisma.sponsoredMeeting.findMany(),
    prisma.sponsorFeedback.findMany(),
    prisma.contentPage.findMany(),
    prisma.pdfExport.findMany(),
    prisma.auditLog.findMany(),
    prisma.notification.findMany(),
  ]);

  const backupData = {
    exportedAt: new Date().toISOString(),
    sourceDatabase: "Supabase PostgreSQL (aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres)",
    counts: {
      users: users.length,
      groups: groups.length,
      groupMembers: groupMembers.length,
      groupInvites: groupInvites.length,
      topicProposals: topicProposals.length,
      scheduleItems: scheduleItems.length,
      activityTemplates: activityTemplates.length,
      activityEntries: activityEntries.length,
      activityEntryHistories: activityEntryHistories.length,
      reviewTemplates: reviewTemplates.length,
      reviewQuestions: reviewQuestions.length,
      reviewForms: reviewForms.length,
      reviewScores: reviewScores.length,
      marksSheets: marksSheets.length,
      examinerFeedbacks: examinerFeedbacks.length,
      checklists: checklists.length,
      competitions: competitions.length,
      paperPublications: paperPublications.length,
      sponsoredMeetings: sponsoredMeetings.length,
      sponsorFeedbacks: sponsorFeedbacks.length,
      contentPages: contentPages.length,
      pdfExports: pdfExports.length,
      auditLogs: auditLogs.length,
      notifications: notifications.length,
    },
    data: {
      users,
      groups,
      groupMembers,
      groupInvites,
      topicProposals,
      scheduleItems,
      activityTemplates,
      activityEntries,
      activityEntryHistories,
      reviewTemplates,
      reviewQuestions,
      reviewForms,
      reviewScores,
      marksSheets,
      examinerFeedbacks,
      checklists,
      competitions,
      paperPublications,
      sponsoredMeetings,
      sponsorFeedbacks,
      contentPages,
      pdfExports,
      auditLogs,
      notifications,
    },
  };

  const backupDir = path.join(process.cwd(), "backups");
  await mkdir(backupDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `database-backup-${dateStr}-${Date.now()}.json`;
  const latestFileName = "database-backup-latest.json";

  const fullPath = path.join(backupDir, fileName);
  const latestFullPath = path.join(backupDir, latestFileName);

  const jsonContent = JSON.stringify(backupData, null, 2);
  await writeFile(fullPath, jsonContent, "utf8");
  await writeFile(latestFullPath, jsonContent, "utf8");

  console.log("=== BACKUP COMPLETED SUCCESSFULLY ===");
  console.log(`Saved to: ${fullPath}`);
  console.log(`Saved to: ${latestFullPath}`);
  console.log("Counts Summary:", JSON.stringify(backupData.counts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
