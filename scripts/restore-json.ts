import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

const backupPath = "D:/be/backups/database-backup-latest.json";
const backup = JSON.parse(readFileSync(backupPath, "utf8"));
const data = backup.data;

async function main() {
  const counts = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
    groupMembers: await prisma.groupMember.count(),
    scheduleItems: await prisma.scheduleItem.count(),
    activityTemplates: await prisma.activityTemplate.count(),
    reviewTemplates: await prisma.reviewTemplate.count(),
    reviewQuestions: await prisma.reviewQuestion.count(),
    checklists: await prisma.checklist.count(),
    contentPages: await prisma.contentPage.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("Destination row counts:");
  console.table(counts);

  const occupied = Object.entries(counts).filter(([, count]) => count !== 0);

  if (occupied.length > 0) {
    throw new Error(
      `Restore stopped: destination tables are not empty: ${occupied
        .map(([name, count]) => `${name}=${count}`)
        .join(", ")}`
    );
  }

  console.log("Destination is empty. Starting restore...");

  await prisma.$transaction(
    async (tx) => {
      await tx.user.createMany({ data: data.users });
      await tx.group.createMany({ data: data.groups });
      await tx.groupMember.createMany({ data: data.groupMembers });

      await tx.scheduleItem.createMany({ data: data.scheduleItems });
      await tx.activityTemplate.createMany({
        data: data.activityTemplates,
      });

      await tx.reviewTemplate.createMany({
        data: data.reviewTemplates,
      });
      await tx.reviewQuestion.createMany({
        data: data.reviewQuestions,
      });

      await tx.checklist.createMany({ data: data.checklists });
      await tx.contentPage.createMany({ data: data.contentPages });
      await tx.auditLog.createMany({ data: data.auditLogs });
    },
    {
      maxWait: 10000,
      timeout: 120000,
    }
  );

  console.log("Restore transaction completed.");
}

main()
  .catch((error) => {
    console.error("Restore failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
