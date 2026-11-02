import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { DEMO_CONFIG } from "./seed-demo-group.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

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

async function testUrl(url: string, description: string): Promise<number> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`FAILED to fetch ${description} at ${url}: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  console.log(`  ✓ ${description}: HTTP 200 OK | Type: ${res.headers.get("content-type")} | Size: ${buf.byteLength} bytes`);
  return buf.byteLength;
}

async function main() {
  console.log("==================================================================");
  console.log("Testing Demo Group Photos, Certificates, Paper & PDF Generation...");
  console.log("==================================================================");

  // 1. Verify demo group exists in DB
  const group = await prisma.group.findFirst({
    where: { groupNo: DEMO_CONFIG.groupNo },
    include: {
      members: true,
      competitions: true,
      papers: true,
      contentPages: true,
    },
  });

  if (!group) {
    throw new Error(`Demo group ${DEMO_CONFIG.groupNo} not found in database! Please run scripts/seed-demo-group.ts first.`);
  }

  console.log(`[OK] Found Demo Group: ${group.groupNo} (id: ${group.id})`);
  console.log(`     Status: ${group.status}, PDF Allowed: ${group.pdfPermission}`);

  // 2. Test Student Photos
  console.log("\n1. Testing Student Photos:");
  for (let i = 0; i < group.members.length; i++) {
    const mem = group.members[i]!;
    if (!mem.photoUrl) throw new Error(`Member ${mem.name} missing photoUrl!`);
    await testUrl(mem.photoUrl, `Student Photo #${i + 1} (${mem.name})`);
  }

  // 3. Test Competitions Certificates
  console.log("\n2. Testing Competition Certificates:");
  for (let i = 0; i < group.competitions.length; i++) {
    const comp = group.competitions[i]!;
    if (!comp.certificateUrl) throw new Error(`Competition ${comp.name} missing certificateUrl!`);
    await testUrl(comp.certificateUrl, `Certificate #${i + 1} (${comp.name})`);
  }

  // 4. Test Paper Publications
  console.log("\n3. Testing Paper Publication Files:");
  for (let i = 0; i < group.papers.length; i++) {
    const p = group.papers[i]!;
    if (!p.fileUrl) throw new Error(`Paper ${p.title} missing fileUrl!`);
    await testUrl(p.fileUrl, `Paper File #${i + 1} (${p.title})`);
  }

  // 5. Test Content Page Files (RTM, Cost)
  console.log("\n4. Testing Content Files (RTM & Cost Estimation):");
  for (const cp of group.contentPages) {
    if (cp.fileUrl) {
      await testUrl(cp.fileUrl, `Content File (${cp.type})`);
    }
  }

  // 6. Test Completion Gate
  console.log("\n5. Testing Completion Gate on Backend API:");
  const { getGroupCompletion } = await import("../apps/api/src/completion/index.js");
  const comp = await getGroupCompletion(group.id);
  console.log(`  Completion: ${comp.percent}% | Complete: ${comp.complete} | Missing: [${comp.missing.join(", ")}]`);
  if (!comp.complete) {
    throw new Error(`Group completion is incomplete! Missing sections: ${comp.missing.join(", ")}`);
  }
  console.log("  ✓ All mandatory sections are 100% complete!");

  // 7. Test PDF Generation and Downloading
  console.log("\n6. Testing PDF Generation and Downloading via /api/groups/[groupId]/pdf:");
  const student = DEMO_CONFIG.students[0]!;
  console.log(`  Logging in as Demo Student: ${student.email}...`);
  const studentCookie = await loginUser(student.email);
  console.log("  ✓ Authenticated as Demo Student.");

  console.log(`  Requesting PDF generation for group ${group.id}...`);
  const start = Date.now();
  const pdfRes = await fetch(`${BASE_URL}/api/groups/${group.id}/pdf`, {
    headers: { cookie: studentCookie },
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    throw new Error(`PDF generation failed (HTTP ${pdfRes.status}): ${errText}`);
  }

  const pdfBuffer = await pdfRes.arrayBuffer();
  const contentType = pdfRes.headers.get("content-type");
  const contentDisposition = pdfRes.headers.get("content-disposition");
  const magic = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8");

  console.log(`  ✓ PDF Generation Succeeded in ${elapsed}s!`);
  console.log(`  ✓ Content-Type: ${contentType}`);
  console.log(`  ✓ Content-Disposition: ${contentDisposition}`);
  console.log(`  ✓ File Size: ${pdfBuffer.byteLength} bytes (${(pdfBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`  ✓ Magic Header: ${magic}`);

  if (!magic.startsWith("%PDF")) {
    throw new Error(`Invalid PDF header received: ${magic}`);
  }

  console.log("\n==================================================================");
  console.log("🎉 ALL TESTS PASSED! PHOTOS, CERTIFICATES, PAPERS & PDF VERIFIED!");
  console.log("==================================================================");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
