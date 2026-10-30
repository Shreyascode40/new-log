import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { checkPdfGate } from "../apps/api/src/modules/pdf.js";
import { setPdfPermission } from "../apps/api/src/modules/admin.js";
import { getGroupCompletion } from "../apps/api/src/completion/index.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

async function testWorkflow() {
  console.log("==================================================");
  console.log("Verifying PDF Gate and HOD PDF Toggle Workflows...");
  console.log("==================================================");

  const hod = await prisma.user.findFirstOrThrow({ where: { role: "HOD" } });
  const g1 = await prisma.group.findFirstOrThrow({
    where: { groupNo: "COMP-BE-2025-01" },
    include: { members: true, guide: true },
  });
  const g2 = await prisma.group.findFirstOrThrow({
    where: { groupNo: "COMP-BE-2025-02" },
    include: { members: true, guide: true },
  });

  const studentG1 = await prisma.user.findFirstOrThrow({ where: { id: g1.members[0]!.userId } });
  const studentG2 = await prisma.user.findFirstOrThrow({ where: { id: g2.members[0]!.userId } });

  console.log(`[TEST 1] Testing Group 1 PDF Gate for Student ${studentG1.name}...`);
  const gateG1 = await checkPdfGate({ id: studentG1.id, role: studentG1.role }, g1.id);
  console.log(`  -> Gate result: Allowed! Project: "${gateG1.group.projectTitle}" (Completion: ${gateG1.completion.percent}%)`);

  console.log(`\n[TEST 2] Testing Group 2 PDF Gate for Student ${studentG2.name} BEFORE HOD permission...`);
  try {
    await checkPdfGate({ id: studentG2.id, role: studentG2.role }, g2.id);
    console.error("  -> FAILED: Expected gate to block since PDF permission is not granted yet!");
  } catch (err: any) {
    console.log(`  -> Correctly blocked by gate: "${err.message}" (code: ${err.code})`);
  }

  console.log(`\n[TEST 3] HOD toggles PDF Permission for Group 2...`);
  await setPdfPermission({ id: hod.id, role: "HOD", name: hod.name }, { groupId: g2.id, allowed: true });
  const updatedG2 = await prisma.group.findUniqueOrThrow({ where: { id: g2.id } });
  console.log(`  -> Group 2 status now: ${updatedG2.status}, pdfPermission: ${updatedG2.pdfPermission}`);

  console.log(`\n[TEST 4] Testing Group 2 PDF Gate for Student ${studentG2.name} AFTER HOD permission...`);
  const gateG2 = await checkPdfGate({ id: studentG2.id, role: studentG2.role }, g2.id);
  console.log(`  -> Gate result: Allowed! Project: "${gateG2.group.projectTitle}" (Completion: ${gateG2.completion.percent}%)`);

  console.log(`\n[TEST 5] HOD revokes PDF Permission for Group 2 back to READY_FOR_PDF...`);
  await setPdfPermission({ id: hod.id, role: "HOD", name: hod.name }, { groupId: g2.id, allowed: false });
  const revertedG2 = await prisma.group.findUniqueOrThrow({ where: { id: g2.id } });
  console.log(`  -> Group 2 status reverted to: ${revertedG2.status}, pdfPermission: ${revertedG2.pdfPermission}`);

  console.log("\n==================================================");
  console.log("ALL PDF ALLOW & GATE WORKFLOW VERIFICATIONS PASSED!");
  console.log("==================================================");
}

testWorkflow()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
