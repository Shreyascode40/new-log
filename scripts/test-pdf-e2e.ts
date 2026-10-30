import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

async function loginUser(email: string, password = "Password@123") {
  const csrfRes = await fetch("http://localhost:3000/api/auth/csrf");
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = csrfRes.headers.getSetCookie();
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");

  const loginRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
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

async function main() {
  console.log("=== Running End-to-End Test for PDF Allow/Revoke & Download ===");

  const g1 = await prisma.group.findFirstOrThrow({
    where: { groupNo: "COMP-BE-2025-02" },
    include: { members: { include: { user: true } } },
  });
  const hod = await prisma.user.findFirstOrThrow({ where: { role: "HOD" } });
  const student = g1.members[0]!.user;

  console.log(`Group: ${g1.groupNo} (${g1.id})`);
  console.log(`HOD: ${hod.name} (${hod.email})`);
  console.log(`Student: ${student.name} (${student.email})`);

  // Log in as HOD
  console.log("\nLogging in as HOD...");
  const hodCookie = await loginUser(hod.email, "hod@apcoer12");
  console.log("✓ Logged in as HOD");

  // Log in as Student
  console.log("Logging in as Student...");
  const studentCookie = await loginUser(student.email);
  console.log("✓ Logged in as Student");

  // 1. Test Revoke PDF via backend API (or HOD action)
  console.log("\n1. Testing Revoke PDF (setting allowed = false)...");
  // We call the backend directly or via the action
  const revokeRes = await fetch("http://localhost:4000/v1/admin/groups/pdf-permission", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // internal token
      authorization: `Bearer ${generateInternalToken(hod.id)}`,
    },
    body: JSON.stringify({ groupId: g1.id, allowed: false }),
  });
  console.log("Revoke response status:", revokeRes.status);
  const revokeJson = await revokeRes.json();
  console.log("Revoke response:", revokeJson);
  if (!revokeRes.ok) {
    throw new Error(`Revoke failed: ${JSON.stringify(revokeJson)}`);
  }

  const dbAfterRevoke = await prisma.group.findUniqueOrThrow({ where: { id: g1.id } });
  console.log(`DB after revoke: status = ${dbAfterRevoke.status}, pdfPermission = ${dbAfterRevoke.pdfPermission}`);
  if (dbAfterRevoke.pdfPermission !== false) {
    throw new Error("pdfPermission is not false after revoke!");
  }
  console.log("✓ HOD Revoke verified in DB!");

  // 2. Test Student Download while Revoked (Expect 403)
  console.log("\n2. Student attempts to download PDF while revoked...");
  const blockedPdfRes = await fetch(`http://localhost:3000/api/groups/${g1.id}/pdf`, {
    headers: { cookie: studentCookie },
  });
  console.log("Response status:", blockedPdfRes.status);
  const blockedBody = await blockedPdfRes.json();
  console.log("Response body:", blockedBody);
  if (blockedPdfRes.status !== 403) {
    throw new Error(`Expected HTTP 403, got ${blockedPdfRes.status}`);
  }
  console.log("✓ Correctly rejected with 403:", blockedBody.error);

  // 3. Test Allow PDF via backend API
  console.log("\n3. Testing Allow PDF (setting allowed = true)...");
  const allowRes = await fetch("http://localhost:4000/v1/admin/groups/pdf-permission", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${generateInternalToken(hod.id)}`,
    },
    body: JSON.stringify({ groupId: g1.id, allowed: true }),
  });
  console.log("Allow response status:", allowRes.status);
  const allowJson = await allowRes.json();
  console.log("Allow response:", allowJson);
  if (!allowRes.ok) {
    throw new Error(`Allow failed: ${JSON.stringify(allowJson)}`);
  }

  const dbAfterAllow = await prisma.group.findUniqueOrThrow({ where: { id: g1.id } });
  console.log(`DB after allow: status = ${dbAfterAllow.status}, pdfPermission = ${dbAfterAllow.pdfPermission}`);
  if (dbAfterAllow.pdfPermission !== true) {
    throw new Error("pdfPermission is not true after allow!");
  }
  console.log("✓ HOD Allow verified in DB!");

  // 4. Test Student Download while Allowed (Expect 200 and PDF bytes)
  console.log("\n4. Student attempts to download PDF while allowed...");
  const startDownload = Date.now();
  const pdfRes = await fetch(`http://localhost:3000/api/groups/${g1.id}/pdf`, {
    headers: { cookie: studentCookie },
  });
  const duration = (Date.now() - startDownload) / 1000;
  console.log(`Download response status: ${pdfRes.status} (took ${duration.toFixed(2)}s)`);
  console.log("Download headers:", {
    contentType: pdfRes.headers.get("content-type"),
    contentDisposition: pdfRes.headers.get("content-disposition"),
  });

  if (!pdfRes.ok) {
    const errorText = await pdfRes.text();
    throw new Error(`PDF download failed (${pdfRes.status}): ${errorText}`);
  }

  const pdfBuffer = await pdfRes.arrayBuffer();
  console.log(`PDF size: ${pdfBuffer.byteLength} bytes (${(pdfBuffer.byteLength / 1024).toFixed(1)} KB)`);
  const magicBytes = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf-8");
  console.log(`PDF magic bytes: ${magicBytes}`);
  if (!magicBytes.startsWith("%PDF")) {
    throw new Error(`Invalid PDF header: ${magicBytes}`);
  }

  // 5. Verify Group status locked to PDF_GENERATED
  const dbFinal = await prisma.group.findUniqueOrThrow({ where: { id: g1.id } });
  console.log(`DB final group status: ${dbFinal.status}`);
  if (dbFinal.status !== "PDF_GENERATED") {
    throw new Error(`Expected group status PDF_GENERATED, got ${dbFinal.status}`);
  }

  // Verify AuditLog was recorded
  const audit = await prisma.auditLog.findFirst({
    where: { entity: "PdfExport", action: "PDF_GENERATE" },
    orderBy: { timestamp: "desc" },
  });
  console.log(`Audit log recorded: action = ${audit?.action}, userId = ${audit?.userId}`);
  if (!audit) {
    throw new Error("PDF_GENERATE audit log was not created!");
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! PDF ALLOW, REVOKE, AND DOWNLOAD FULLY WORKING!");
}

import { createHmac } from "node:crypto";
function generateInternalToken(userId: string): string {
  const secret = process.env.API_INTERNAL_SECRET?.trim() ?? "";
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, aud: "be-logbook-api", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
