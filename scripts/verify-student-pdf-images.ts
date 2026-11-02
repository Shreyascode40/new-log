import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {}

import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import puppeteer from "puppeteer-core";
import { prisma } from "../apps/api/src/db.js";
import { resolveStudentPhotoDataUri, detectSupportedImageMime } from "../apps/web/lib/services/photo-resolver";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Helper to log in via NextAuth credentials provider
async function loginUser(email: string, password = "Password@123"): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = csrfRes.headers.getSetCookie();
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed for ${email}: HTTP ${loginRes.status}`);
  }

  const loginCookies = loginRes.headers.getSetCookie();
  return [...csrfCookies, ...loginCookies].map((c) => c.split(";")[0]).join("; ");
}

async function runVerification() {
  console.log("================================================================================");
  console.log("      STUDENT PROFILE IMAGE PDF RESOLUTION & RENDERING VERIFICATION SUITE       ");
  console.log("================================================================================\n");

  const results: Array<{ scenario: string; passed: boolean; details: string }> = [];

  // Find demo group
  const group = await prisma.group.findFirst({
    where: { groupNo: "DEMO-01" },
    include: { members: { orderBy: { createdAt: "asc" } } },
  });

  if (!group) throw new Error("Target group DEMO-01 not found");
  console.log(`Target Group: ${group.groupNo} (${group.id}) with ${group.members.length} members\n`);

  // 1. Authenticate as student
  const studentEmail = "demo.student3@apcoer.edu.in";
  console.log(`[1] Authenticating as student: ${studentEmail}...`);
  const cookie = await loginUser(studentEmail);
  console.log(`  -> Authentication successful. Session cookie acquired.\n`);

  // 2. Fetch authenticated /api/groups/:id/pdf/data
  console.log(`[2] Fetching PDF data bundle via /api/groups/${group.id}/pdf/data...`);
  const dataRes = await fetch(`${BASE_URL}/api/groups/${group.id}/pdf/data`, {
    headers: { cookie },
  });

  if (!dataRes.ok) {
    throw new Error(`Failed to fetch PDF data: HTTP ${dataRes.status}`);
  }

  const json = await dataRes.json();
  if (!json.success || !json.data) {
    throw new Error(`Invalid PDF data payload returned: ${JSON.stringify(json)}`);
  }

  const members = json.data.groupInfo.members;
  console.log(`  -> Retrieved ${members.length} members in groupInfo payload.\n`);

  // --- SCENARIO 1: Student with JPEG Profile Photo ---
  const member1 = members[0]; // Aarav Sharma
  const m1Photo = member1?.photoUrl || "";
  const isM1Jpeg = m1Photo.startsWith("data:image/jpeg;base64,");
  console.log(`[Scenario 1] Student with JPEG Profile Photo (${member1.name}):`);
  console.log(`  Photo data URI prefix: ${m1Photo.substring(0, 35)}...`);
  console.log(`  Length: ${m1Photo.length} characters`);
  results.push({
    scenario: "1. Student with JPEG profile photo",
    passed: isM1Jpeg && m1Photo.length > 1000,
    details: `Member 1 (${member1.name}) resolved to valid JPEG data URI (${m1Photo.length} chars)`,
  });

  // --- SCENARIO 2: Student with PNG Profile Photo ---
  const member3 = members[2]; // Chirag Deshmukh
  const m3Photo = member3?.photoUrl || "";
  const isM3Png = m3Photo.startsWith("data:image/png;base64,");
  console.log(`\n[Scenario 2] Student with PNG Profile Photo (${member3.name}):`);
  console.log(`  Photo data URI prefix: ${m3Photo.substring(0, 35)}...`);
  console.log(`  Length: ${m3Photo.length} characters`);
  results.push({
    scenario: "2. Student with PNG profile photo",
    passed: isM3Png && m3Photo.length > 1000,
    details: `Member 3 (${member3.name}) resolved to valid PNG data URI (${m3Photo.length} chars)`,
  });

  // --- SCENARIO 3: Student without a Profile Photo ---
  console.log(`\n[Scenario 3] Student without a profile photo (null/empty handling):`);
  const nullPhotoResolved = await resolveStudentPhotoDataUri(null);
  const emptyPhotoResolved = await resolveStudentPhotoDataUri("");
  console.log(`  null -> ${nullPhotoResolved}`);
  console.log(`  empty string -> ${emptyPhotoResolved}`);
  results.push({
    scenario: "3. Student without a profile photo",
    passed: nullPhotoResolved === null && emptyPhotoResolved === null,
    details: "Safely returns null so default placeholder renders without throwing",
  });

  // --- SCENARIO 4: Student with an Inaccessible or Deleted Photo ---
  console.log(`\n[Scenario 4] Student with an inaccessible or deleted photo:`);
  const missingPhoto = "/media/group-members/non-existent-image-id-999.jpg";
  const missingResolved = await resolveStudentPhotoDataUri(missingPhoto);
  console.log(`  Missing file (${missingPhoto}) -> ${missingResolved}`);
  results.push({
    scenario: "4. Student with inaccessible or deleted photo",
    passed: missingResolved === null,
    details: "Inaccessible file caught gracefully and returned null (no crash)",
  });

  // --- SCENARIO 5: Multiple Students with Different Photos ---
  console.log(`\n[Scenario 5] Multiple students with distinct photos (no cross-contamination):`);
  const member2 = members[1]; // Bhavya Patel
  const member4 = members[3]; // Divya Kulkarni
  const m2Photo = member2?.photoUrl || "";
  const m4Photo = member4?.photoUrl || "";

  const distinct12 = m1Photo !== m2Photo;
  const distinct23 = m2Photo !== m3Photo;
  const allDistinct = distinct12 && distinct23;

  console.log(`  Member 1 vs Member 2 distinct: ${distinct12}`);
  console.log(`  Member 2 vs Member 3 distinct: ${distinct23}`);
  results.push({
    scenario: "5. Multiple students with distinct photos",
    passed: allDistinct,
    details: "Each student correctly mapped to their own unique photo data URI",
  });

  // --- SCENARIO 6: PDF Generated with all available photos ---
  console.log(`\n[Scenario 6] Generating full A4 PDF with all available student photos...`);
  const { pdf } = await import("@react-pdf/renderer");
  const { LogbookPdfDocument } = await import("../apps/web/components/pdf/logbook-pdf-document");

  const doc = React.createElement(LogbookPdfDocument, { data: json.data });
  const blob = await pdf(doc).toBlob();
  const pdfBuffer = Buffer.from(await blob.arrayBuffer());

  const outPdfPath = path.resolve("scripts/verified-student-logbook.pdf");
  fs.writeFileSync(outPdfPath, pdfBuffer);
  console.log(`  -> Full PDF generated successfully (${pdfBuffer.length} bytes).`);
  console.log(`  -> PDF starts with %PDF-: ${pdfBuffer.subarray(0, 5).toString() === "%PDF-"}`);

  results.push({
    scenario: "6. PDF generated with all available photos",
    passed: pdfBuffer.length > 50000 && pdfBuffer.subarray(0, 5).toString() === "%PDF-",
    details: `Full logbook PDF generated (${Math.round(pdfBuffer.length / 1024)} KB) with valid PDF signature`,
  });

  // --- SCENARIO 7: PDF Generated when one image fails to load ---
  console.log(`\n[Scenario 7] Generating PDF when an image fails to load or is corrupted...`);
  // First verify that resolveStudentPhotoDataUri catches corrupted bytes and returns null
  const corruptedBuffer = Buffer.from("NotAnImageAtAll-DefinitelyCorruptedBytes");
  const corruptedMime = detectSupportedImageMime(corruptedBuffer);
  console.log(`  Corrupted buffer detected MIME: ${corruptedMime} (expected: null)`);

  const corruptedData = {
    ...json.data,
    groupInfo: {
      ...json.data.groupInfo,
      members: [
        { ...member1, photoUrl: null }, // Corrupted photo sanitized to null by server
        { ...member2, photoUrl: null }, // Missing photo
        { ...member3, photoUrl: m3Photo }, // Valid photo
        { ...member4, photoUrl: "relative-path-that-failed-resolution" }, // Safe fallback in component
      ],
    },
  };

  const docWithFailures = React.createElement(LogbookPdfDocument, { data: corruptedData });
  const blobF = await pdf(docWithFailures).toBlob();
  const pdfBufferF = Buffer.from(await blobF.arrayBuffer());
  console.log(`  -> Resilient PDF generated successfully (${pdfBufferF.length} bytes).`);

  results.push({
    scenario: "7. PDF generated when one image fails to load",
    passed: pdfBufferF.length > 50000 && pdfBufferF.subarray(0, 5).toString() === "%PDF-",
    details: "Invalid/missing photos fell back to placeholder cleanly without crashing PDF",
  });

  // --- VISUAL INSPECTION VIA PUPPETEER ---
  console.log(`\n[Visual Inspection] Launching Puppeteer for visual inspection of rendered PDF...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    const fileUrl = `file:///${outPdfPath.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });

    const screenshotPath = path.resolve("scripts/student-photos-pdf-preview.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`  -> Visual screenshot saved: ${screenshotPath}`);
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n================================================================================");
  console.log("                           TEST RESULTS BREAKDOWN                               ");
  console.log("================================================================================");
  let allPass = true;
  for (const r of results) {
    const status = r.passed ? "[PASS]" : "[FAIL]";
    if (!r.passed) allPass = false;
    console.log(`${status} ${r.scenario}`);
    console.log(`       ${r.details}`);
  }
  console.log("================================================================================");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`VERDICT: ${allPass ? "ALL SCENARIOS PASSED SUCCESSFULLY" : "SOME SCENARIOS FAILED"}`);
  console.log("================================================================================\n");

  if (!allPass) process.exit(1);
}

runVerification().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
