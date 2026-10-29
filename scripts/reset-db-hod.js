const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

process.loadEnvFile(".env");

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("Clearing seed/test data and configuring HOD...");
  console.log("==================================================");

  const hodEmail = "rama.gaikwad@abmspcoerpune.org";
  const hodName = "Dr.Rama Gaikwad";
  const hodPassword = "hod@apcoer12";

  console.log("1. Deleting child records of groups and users...");

  // Delete all group child data
  await prisma.activityEntryHistory.deleteMany({});
  await prisma.activityEntry.deleteMany({});
  await prisma.reviewScore.deleteMany({});
  await prisma.reviewForm.deleteMany({});
  await prisma.marksSheet.deleteMany({});
  await prisma.examinerFeedback.deleteMany({});
  await prisma.checklist.deleteMany({});
  await prisma.competition.deleteMany({});
  await prisma.paperPublication.deleteMany({});
  await prisma.sponsoredMeeting.deleteMany({});
  await prisma.sponsorFeedback.deleteMany({});
  await prisma.contentPage.deleteMany({});
  await prisma.topicProposal.deleteMany({});
  await prisma.groupInvite.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.pdfExport.deleteMany({});
  await prisma.group.deleteMany({});

  console.log("2. Deleting user tokens, notifications, and audit logs...");
  await prisma.emailVerificationToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log("3. Deleting all users except new HOD target...");
  await prisma.user.deleteMany({
    where: {
      email: { not: hodEmail },
    },
  });

  console.log("4. Upserting HOD account:", hodEmail);
  const passwordHash = await bcrypt.hash(hodPassword, 10);
  const now = new Date();

  const hod = await prisma.user.upsert({
    where: { email: hodEmail },
    update: {
      name: hodName,
      role: "HOD",
      passwordHash,
      active: true,
      emailVerifiedAt: now,
    },
    create: {
      name: hodName,
      email: hodEmail,
      role: "HOD",
      passwordHash,
      active: true,
      emailVerifiedAt: now,
      createdVia: "HOD_CREATED",
    },
  });

  console.log("\n SUCCESS!");
  console.log("--------------------------------------------------");
  console.log(` HOD Name:     ${hod.name}`);
  console.log(` HOD Email:    ${hod.email}`);
  console.log(` HOD Password: ${hodPassword}`);
  console.log(` HOD Role:     ${hod.role}`);
  console.log(` HOD Active:   ${hod.active}`);
  console.log(` Verified At:  ${hod.emailVerifiedAt}`);
  console.log("--------------------------------------------------");

  const remainingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  console.log("\nUsers in database count:", remainingUsers.length);
  console.log(remainingUsers);

  const remainingGroups = await prisma.group.count();
  console.log("Groups in database count:", remainingGroups);

  const templatesCount = {
    scheduleItems: await prisma.scheduleItem.count(),
    activityTemplates: await prisma.activityTemplate.count(),
    reviewTemplates: await prisma.reviewTemplate.count(),
    reviewQuestions: await prisma.reviewQuestion.count(),
  };
  console.log("Templates preserved:", templatesCount);
}

main()
  .catch((err) => {
    console.error("Error during reset:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
