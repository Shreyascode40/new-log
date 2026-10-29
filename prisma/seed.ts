/**
 * Seed: HOD and system templates (schedule, activity templates, review templates + questions).
 * Run with: npm run db:seed
 */
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../apps/api/src/password";
import { SCHEDULE_SEED } from "./seed-data/schedule";
import { ACTIVITY_SEED } from "./seed-data/activity";
import { REVIEW_SEED } from "./seed-data/reviews";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

const HOD_CONFIG = {
  name: "Dr.Rama Gaikwad",
  email: "rama.gaikwad@abmspcoerpune.org",
  password: process.env.SEED_HOD_PASSWORD || "hod@apcoer12",
  mobile: "9000000001",
};

async function main() {
  console.log("Starting seed script...");
  const passwordHash = await hashPassword(HOD_CONFIG.password);
  console.log("Password hashed. Upserting HOD...");
  const now = new Date();

  await prisma.user.upsert({
    where: { email: HOD_CONFIG.email },
    update: {
      name: HOD_CONFIG.name,
      role: "HOD",
      mobile: HOD_CONFIG.mobile,
      passwordHash,
      active: true,
      emailVerifiedAt: now,
    },
    create: {
      name: HOD_CONFIG.name,
      email: HOD_CONFIG.email,
      role: "HOD",
      mobile: HOD_CONFIG.mobile,
      passwordHash,
      emailVerifiedAt: now,
      createdVia: "HOD_CREATED",
      active: true,
    },
  });
  console.log(`HOD upserted: ${HOD_CONFIG.email}`);

  // ------------------------------------------------------------------ schedule
  for (const row of SCHEDULE_SEED) {
    await prisma.scheduleItem.upsert({
      where: { term_sortOrder: { term: row.term, sortOrder: row.sortOrder } },
      update: { description: row.description },
      create: { term: row.term, sortOrder: row.sortOrder, description: row.description },
    });
  }

  // ------------------------------------------------------------------ activity
  for (const row of ACTIVITY_SEED) {
    await prisma.activityTemplate.upsert({
      where: { month_sortOrder: { month: row.month, sortOrder: row.sortOrder } },
      update: { text: row.text },
      create: { month: row.month, sortOrder: row.sortOrder, text: row.text },
    });
  }

  // ------------------------------------------------------------------ reviews
  for (const template of REVIEW_SEED) {
    const saved = await prisma.reviewTemplate.upsert({
      where: { reviewType: template.reviewType },
      update: { title: template.title, term: template.term, order: template.order, hasDateColumn: template.hasDateColumn },
      create: {
        term: template.term,
        reviewType: template.reviewType,
        title: template.title,
        order: template.order,
        hasDateColumn: template.hasDateColumn,
      },
    });
    for (let index = 0; index < template.questions.length; index += 1) {
      const text = template.questions[index]!;
      await prisma.reviewQuestion.upsert({
        where: { templateId_questionNo: { templateId: saved.id, questionNo: index + 1 } },
        update: { text },
        create: { templateId: saved.id, questionNo: index + 1, text },
      });
    }
  }

  console.log(`Seeding complete. HOD: ${HOD_CONFIG.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
