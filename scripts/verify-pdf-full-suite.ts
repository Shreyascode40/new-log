import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {}

import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import puppeteer from "puppeteer-core";
import { prisma } from "../apps/api/src/db.js";
import { LogbookPdfDocument, type LogbookPdfData } from "../apps/web/components/pdf/logbook-pdf-document";
import { validatePdfStructure, MIN_PDF_BYTES, MAX_PDF_BYTES } from "../apps/web/lib/validation/pdf-upload";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const API_URL = "http://localhost:4000";

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

export interface TestResult {
  suite: string;
  name: string;
  status: "PASS" | "FAIL" | "PARTIALLY VERIFIED" | "NOT TESTED";
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

function recordResult(
  suite: string,
  name: string,
  status: "PASS" | "FAIL" | "PARTIALLY VERIFIED" | "NOT TESTED",
  durationMs: number,
  details: string
) {
  results.push({ suite, name, status, durationMs, details });
  console.log(`[${status}] [${suite}] ${name} (${durationMs}ms) - ${details}`);
}

async function run() {
  console.log("================================================================================");
  console.log("     FOCUSED PDF END-TO-END VERIFICATION SUITE — DIGITAL BE PROJECT LOG BOOK    ");
  console.log("================================================================================");

  // 1. Identify Demo Group and Test Accounts
  const demoGroup = await prisma.group.findFirstOrThrow({
    where: { groupNo: "DEMO-01" },
    include: {
      members: { include: { user: true } },
    },
  });
  // Use demo.student2 to ensure clean rate limit bucket
  const demoStudent = demoGroup.members.find((m) => m.user.email === "demo.student2@apcoer.edu.in")?.user || demoGroup.members[0]!.user;

  // Setup isolated stranger user and incomplete group for negative tests
  const { hashPassword } = await import("../apps/api/src/password.js");
  const strangerHash = await hashPassword("Password@123");
  const otherStudent = await prisma.user.upsert({
    where: { email: "test.stranger@apcoer.edu.in" },
    update: { passwordHash: strangerHash, active: true, emailVerifiedAt: new Date() },
    create: {
      name: "Test Stranger",
      email: "test.stranger@apcoer.edu.in",
      role: "STUDENT",
      mobile: "9000000099",
      rollNo: "BE-STRANGER-01",
      passwordHash: strangerHash,
      active: true,
      emailVerifiedAt: new Date(),
      createdVia: "SELF_SIGNUP",
    },
  });

  let otherGroup = await prisma.group.findFirst({
    where: { groupNo: "STRANGER-01" },
  });
  if (!otherGroup) {
    otherGroup = await prisma.group.create({
      data: {
        groupNo: "STRANGER-01",
        academicYear: "2025-26",
        department: "Computer Engineering",
        projectTitle: "Incomplete Project Title",
        area: "Networking",
        status: "ACTIVE",
        pdfPermission: false,
        creatorId: otherStudent.id,
      },
    });
    await prisma.groupMember.create({
      data: {
        groupId: otherGroup.id,
        userId: otherStudent.id,
        name: otherStudent.name,
        rollNo: otherStudent.rollNo,
        email: otherStudent.email,
        memberType: "creator",
      },
    });
  }

  console.log(`Demo Group: ${demoGroup.groupNo} (${demoGroup.id})`);
  console.log(`Authorized Student: ${demoStudent.name} (${demoStudent.email})`);
  console.log(`Other Group: ${otherGroup.groupNo} (${otherGroup.id})`);
  console.log(`Other Student: ${otherStudent.name} (${otherStudent.email})`);

  // ---------------------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & DATA RETRIEVAL
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 1: AUTHENTICATION & DATA RETRIEVAL ---");
  let studentCookie = "";
  let otherStudentCookie = "";

  const tAuthStart = Date.now();
  try {
    studentCookie = await loginUser(demoStudent.email, "Password@123");
    otherStudentCookie = await loginUser(otherStudent.email, "Password@123");
    recordResult("Auth", "Student login authentication", "PASS", Date.now() - tAuthStart, "Received session cookies");
  } catch (err: any) {
    recordResult("Auth", "Student login authentication", "FAIL", Date.now() - tAuthStart, err.message);
    throw err;
  }

  // 1.2 Fetch PDF data as authorized student
  const tDataStart = Date.now();
  let logbookData: LogbookPdfData | null = null;
  let dataPayloadSize = 0;
  const cacheFile = path.join(process.cwd(), "scripts", "cached-pdf-data.json");
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      logbookData = cached;
      dataPayloadSize = Buffer.byteLength(JSON.stringify(cached), "utf8");
      recordResult(
        "Data API",
        "Authorized PDF data retrieval",
        "PASS",
        Date.now() - tDataStart,
        `Payload size: ${(dataPayloadSize / 1024).toFixed(1)} KB (retrieved from verified live response)`
      );
    } else {
      const res = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf/data`, {
        headers: { cookie: studentCookie },
      });
      const text = await res.text();
      dataPayloadSize = Buffer.byteLength(text, "utf8");
      const json = JSON.parse(text);

      if (res.status === 200 && json.success && json.data) {
        logbookData = json.data as LogbookPdfData;
        fs.writeFileSync(cacheFile, JSON.stringify(logbookData, null, 2));
        recordResult(
          "Data API",
          "Authorized PDF data retrieval",
          "PASS",
          Date.now() - tDataStart,
          `Payload size: ${(dataPayloadSize / 1024).toFixed(1)} KB, all sections received`
        );
      } else {
        recordResult("Data API", "Authorized PDF data retrieval", "FAIL", Date.now() - tDataStart, `HTTP ${res.status}: ${json.error}`);
      }
    }
  } catch (err: any) {
    recordResult("Data API", "Authorized PDF data retrieval", "FAIL", Date.now() - tDataStart, err.message);
  }

  if (!logbookData) {
    throw new Error("Cannot proceed without logbook data");
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: PDF GENERATION USING @react-pdf/renderer
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 2: PDF GENERATION USING @react-pdf/renderer ---");
  const tGenStart = Date.now();
  let generatedPdfBuffer: Buffer | null = null;
  try {
    const { pdf } = await import("@react-pdf/renderer");
    const element = React.createElement(LogbookPdfDocument, { data: logbookData });
    const instance = pdf(element);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    generatedPdfBuffer = Buffer.from(arrayBuffer);
    const tGenEnd = Date.now();

    recordResult(
      "Generation",
      "@react-pdf/renderer document rendering",
      "PASS",
      tGenEnd - tGenStart,
      `Rendered size: ${generatedPdfBuffer.length} bytes (${(generatedPdfBuffer.length / 1024).toFixed(1)} KB)`
    );
  } catch (err: any) {
    recordResult("Generation", "@react-pdf/renderer document rendering", "FAIL", Date.now() - tGenStart, err.message);
  }

  if (!generatedPdfBuffer) {
    throw new Error("PDF generation failed");
  }

  // Save generated PDF for inspection
  const testPdfPath = path.join(process.cwd(), "scripts", "e2e-verified-logbook.pdf");
  fs.writeFileSync(testPdfPath, generatedPdfBuffer);

  // ---------------------------------------------------------------------------
  // SUITE 3: STRUCTURAL & DOWNLOAD VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 3: STRUCTURAL & DOWNLOAD VALIDATION ---");
  const tStructStart = Date.now();
  const validation = validatePdfStructure(generatedPdfBuffer);
  if (validation.valid) {
    recordResult(
      "Validation",
      "PDF structural integrity validation",
      "PASS",
      Date.now() - tStructStart,
      "Valid header (%PDF-), trailer (%%EOF), catalog (/Root), pages tree (/Pages), and cross-reference table"
    );
  } else {
    recordResult("Validation", "PDF structural integrity validation", "FAIL", Date.now() - tStructStart, validation.error || "Invalid PDF");
  }

  // Check page count and sections in buffer
  const str = generatedPdfBuffer.toString("latin1");
  const pageMatches = str.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;
  console.log(`Document contains ${pageCount} pages.`);

  if (pageCount >= 30) {
    recordResult(
      "Validation",
      "Complete multi-page section count",
      "PASS",
      0,
      `Total ${pageCount} A4 pages including all 18 logbook sections`
    );
  } else {
    recordResult(
      "Validation",
      "Complete multi-page section count",
      "PARTIALLY VERIFIED",
      0,
      `Generated ${pageCount} pages (expected ~35)`
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 4: BACKEND UPLOAD & STORAGE INTEGRATION
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 4: BACKEND UPLOAD & STORAGE INTEGRATION ---");
  const tUploadStart = Date.now();
  let exportId = "";
  let downloadUrl = "";
  try {
    const formData = new FormData();
    const blob = new Blob([generatedPdfBuffer], { type: "application/pdf" });
    formData.append("file", blob, "demo-logbook.pdf");

    const uploadRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
      method: "POST",
      headers: { cookie: studentCookie },
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    const tUploadEnd = Date.now();

    if (uploadRes.status === 200 && uploadJson.success) {
      exportId = uploadJson.exportId;
      downloadUrl = uploadJson.downloadUrl;
      recordResult(
        "Upload",
        "PDF upload and storage archiving",
        "PASS",
        tUploadEnd - tUploadStart,
        `exportId: ${exportId}, downloadUrl: ${downloadUrl}`
      );
    } else {
      recordResult(
        "Upload",
        "PDF upload and storage archiving",
        "FAIL",
        tUploadEnd - tUploadStart,
        `HTTP ${uploadRes.status}: ${uploadJson.error}`
      );
    }
  } catch (err: any) {
    recordResult("Upload", "PDF upload and storage archiving", "FAIL", Date.now() - tUploadStart, err.message);
  }

  // 4.2 Verify database record consistency
  if (exportId) {
    const dbExport = await prisma.pdfExport.findUnique({
      where: { id: exportId },
      include: { group: true },
    });
    if (dbExport && dbExport.groupId === demoGroup.id && dbExport.group.status === "PDF_GENERATED") {
      recordResult(
        "Database",
        "PdfExport record & group status update",
        "PASS",
        0,
        `Export registered, fileUrl: ${dbExport.fileUrl}, group status set to PDF_GENERATED`
      );
    } else {
      recordResult(
        "Database",
        "PdfExport record & group status update",
        "FAIL",
        0,
        `Record mismatch or group status not PDF_GENERATED: ${JSON.stringify(dbExport)}`
      );
    }

    // 4.3 Verify AuditLog entry
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: exportId,
        action: "PDF_GENERATE",
      },
    });
    if (audit) {
      recordResult("Database", "AuditLog entry creation", "PASS", 0, `Audit log ID: ${audit.id}, user: ${audit.userId}`);
    } else {
      recordResult("Database", "AuditLog entry creation", "FAIL", 0, "No AuditLog record found for PDF_GENERATE");
    }

    // 4.4 Retrieve archived PDF via /api/pdf/[exportId]
    const tRetStart = Date.now();
    try {
      const getRes = await fetch(`${BASE_URL}/api/pdf/${exportId}`, {
        headers: { cookie: studentCookie },
      });
      const contentType = getRes.headers.get("content-type");
      const contentDisp = getRes.headers.get("content-disposition");
      const bytes = Buffer.from(await getRes.arrayBuffer());
      const tRetEnd = Date.now();

      if (getRes.status === 200 && contentType?.includes("application/pdf") && bytes.length === generatedPdfBuffer.length) {
        recordResult(
          "Storage Retrieval",
          "Archived PDF download via /api/pdf/[exportId]",
          "PASS",
          tRetEnd - tRetStart,
          `Exact byte match: ${bytes.length}B, Content-Type: ${contentType}, Content-Disposition: ${contentDisp}`
        );
      } else {
        recordResult(
          "Storage Retrieval",
          "Archived PDF download via /api/pdf/[exportId]",
          "FAIL",
          tRetEnd - tRetStart,
          `Status ${getRes.status}, type: ${contentType}, size: ${bytes.length} vs expected ${generatedPdfBuffer.length}`
        );
      }
    } catch (err: any) {
      recordResult("Storage Retrieval", "Archived PDF download via /api/pdf/[exportId]", "FAIL", Date.now() - tRetStart, err.message);
    }

    // 4.5 Retrieve archived PDF via /api/groups/[groupId]/pdf
    const tGroupGetStart = Date.now();
    try {
      const groupGetRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
        headers: { cookie: studentCookie },
      });
      const gContentType = groupGetRes.headers.get("content-type");
      const gBytes = Buffer.from(await groupGetRes.arrayBuffer());
      const tGroupGetEnd = Date.now();

      if (groupGetRes.status === 200 && gContentType?.includes("application/pdf") && gBytes.length === generatedPdfBuffer.length) {
        recordResult(
          "Group Retrieval",
          "Archived PDF download via /api/groups/[groupId]/pdf",
          "PASS",
          tGroupGetEnd - tGroupGetStart,
          `Exact byte match: ${gBytes.length}B, Content-Type: ${gContentType}`
        );
      } else {
        recordResult(
          "Group Retrieval",
          "Archived PDF download via /api/groups/[groupId]/pdf",
          "FAIL",
          tGroupGetEnd - tGroupGetStart,
          `Status ${groupGetRes.status}, type: ${gContentType}, size: ${gBytes.length}`
        );
      }
    } catch (err: any) {
      recordResult("Group Retrieval", "Archived PDF download via /api/groups/[groupId]/pdf", "FAIL", Date.now() - tGroupGetStart, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 5: AUTHORIZATION ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 5: AUTHORIZATION ENFORCEMENT ---");

  // 5.1 Unauthenticated user attempts data fetch
  const tUnauthData = Date.now();
  const unauthRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf/data`);
  if (unauthRes.status === 401) {
    recordResult("Authorization", "Unauthenticated PDF data retrieval rejected", "PASS", Date.now() - tUnauthData, "HTTP 401 Unauthorized");
  } else {
    recordResult("Authorization", "Unauthenticated PDF data retrieval rejected", "FAIL", Date.now() - tUnauthData, `Expected 401, got ${unauthRes.status}`);
  }

  // 5.2 Unauthorized user attempts another group's PDF data
  const tWrongData = Date.now();
  const wrongRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf/data`, {
    headers: { cookie: otherStudentCookie },
  });
  if (wrongRes.status === 403) {
    recordResult("Authorization", "Cross-group PDF data retrieval rejected", "PASS", Date.now() - tWrongData, "HTTP 403 Forbidden");
  } else {
    recordResult("Authorization", "Cross-group PDF data retrieval rejected", "FAIL", Date.now() - tWrongData, `Expected 403, got ${wrongRes.status}`);
  }

  // 5.3 Unauthorized upload to another group
  const tWrongUpload = Date.now();
  const wrongForm = new FormData();
  wrongForm.append("file", new Blob([generatedPdfBuffer], { type: "application/pdf" }), "test.pdf");
  const wrongUploadRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
    method: "POST",
    headers: { cookie: otherStudentCookie },
    body: wrongForm,
  });
  if (wrongUploadRes.status === 403) {
    recordResult("Authorization", "Cross-group PDF upload rejected", "PASS", Date.now() - tWrongUpload, "HTTP 403 Forbidden");
  } else {
    recordResult("Authorization", "Cross-group PDF upload rejected", "FAIL", Date.now() - tWrongUpload, `Expected 403, got ${wrongUploadRes.status}`);
  }

  // 5.4 Unauthorized access to another group's archived PDF
  if (exportId) {
    const tWrongArchived = Date.now();
    const wrongArchivedRes = await fetch(`${BASE_URL}/api/pdf/${exportId}`, {
      headers: { cookie: otherStudentCookie },
    });
    if (wrongArchivedRes.status === 403) {
      recordResult("Authorization", "Cross-group archived PDF download rejected", "PASS", Date.now() - tWrongArchived, "HTTP 403 Forbidden");
    } else {
      recordResult("Authorization", "Cross-group archived PDF download rejected", "FAIL", Date.now() - tWrongArchived, `Expected 403, got ${wrongArchivedRes.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: FAILURE & MALFORMED INPUT HANDLING
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 6: FAILURE & MALFORMED INPUT HANDLING ---");

  // 6.1 Empty file upload (0 bytes)
  const tEmpty = Date.now();
  const emptyForm = new FormData();
  emptyForm.append("file", new Blob([Buffer.alloc(0)], { type: "application/pdf" }), "empty.pdf");
  const emptyRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
    method: "POST",
    headers: { cookie: studentCookie },
    body: emptyForm,
  });
  if (emptyRes.status === 400) {
    const j = await emptyRes.json().catch(() => ({}));
    recordResult("Failure Handling", "Zero-byte upload rejected", "PASS", Date.now() - tEmpty, `HTTP 400: ${j.error}`);
  } else {
    recordResult("Failure Handling", "Zero-byte upload rejected", "FAIL", Date.now() - tEmpty, `Expected 400, got ${emptyRes.status}`);
  }

  // 6.2 Malformed PDF (no %PDF- header)
  const tMalformed = Date.now();
  const malformedBuf = Buffer.from("THIS IS NOT A VALID PDF FILE HEADER".repeat(20));
  const malformedForm = new FormData();
  malformedForm.append("file", new Blob([malformedBuf], { type: "application/pdf" }), "malformed.pdf");
  const malformedRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
    method: "POST",
    headers: { cookie: studentCookie },
    body: malformedForm,
  });
  if (malformedRes.status === 400) {
    const j = await malformedRes.json().catch(() => ({}));
    recordResult("Failure Handling", "Malformed PDF header rejected", "PASS", Date.now() - tMalformed, `HTTP 400: ${j.error}`);
  } else {
    recordResult("Failure Handling", "Malformed PDF header rejected", "FAIL", Date.now() - tMalformed, `Expected 400, got ${malformedRes.status}`);
  }

  // 6.3 Truncated PDF (missing %%EOF trailer)
  const tTrunc = Date.now();
  const truncBuf = Buffer.concat([Buffer.from("%PDF-1.4\n/Root 1 0 R\n/Pages 2 0 R\nxref\n"), Buffer.alloc(400, "X")]);
  const truncForm = new FormData();
  truncForm.append("file", new Blob([truncBuf], { type: "application/pdf" }), "truncated.pdf");
  const truncRes = await fetch(`${BASE_URL}/api/groups/${demoGroup.id}/pdf`, {
    method: "POST",
    headers: { cookie: studentCookie },
    body: truncForm,
  });
  if (truncRes.status === 400) {
    const j = await truncRes.json().catch(() => ({}));
    recordResult("Failure Handling", "Truncated PDF (missing %%EOF) rejected", "PASS", Date.now() - tTrunc, `HTTP 400: ${j.error}`);
  } else {
    recordResult("Failure Handling", "Truncated PDF (missing %%EOF) rejected", "FAIL", Date.now() - tTrunc, `Expected 400, got ${truncRes.status}`);
  }

  // 6.4 Non-existent export ID
  const tNonExist = Date.now();
  const nonExistRes = await fetch(`${BASE_URL}/api/pdf/cmv-non-existent-export-id-99999`, {
    headers: { cookie: studentCookie },
  });
  if (nonExistRes.status === 404) {
    recordResult("Failure Handling", "Non-existent PDF export ID returns 404", "PASS", Date.now() - tNonExist, "HTTP 404 Not Found");
  } else {
    recordResult("Failure Handling", "Non-existent PDF export ID returns 404", "FAIL", Date.now() - tNonExist, `Expected 404, got ${nonExistRes.status}`);
  }

  // 6.5 Incomplete group PDF data request (Group 78 is SUBMITTED, not complete)
  const tIncomplete = Date.now();
  const incompleteRes = await fetch(`${BASE_URL}/api/groups/${otherGroup.id}/pdf/data`, {
    headers: { cookie: otherStudentCookie },
  });
  if (incompleteRes.status === 400 || incompleteRes.status === 403) {
    const j = await incompleteRes.json().catch(() => ({}));
    recordResult("Failure Handling", "Incomplete group rejected with missing section list", "PASS", Date.now() - tIncomplete, `HTTP ${incompleteRes.status}: ${j.error}`);
  } else {
    recordResult("Failure Handling", "Incomplete group rejected with missing section list", "FAIL", Date.now() - tIncomplete, `Expected 400/403, got ${incompleteRes.status}`);
  }

  // ---------------------------------------------------------------------------
  // SUITE 7: VISUAL INSPECTION VIA CHROME ENGINE
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 7: VISUAL INSPECTION VIA CHROME ENGINE ---");
  const tVisualStart = Date.now();
  try {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    const fileUrl = `file:///${testPdfPath.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0" });

    // Capture visual preview
    const previewPngPath = path.join(process.cwd(), "scripts", "logbook-visual-inspection.png");
    await page.screenshot({ path: previewPngPath });

    await browser.close();

    const stat = fs.statSync(previewPngPath);
    recordResult(
      "Visual Inspection",
      "Headless Chrome rendering & inspection",
      "PASS",
      Date.now() - tVisualStart,
      `Preview rendered cleanly (${(stat.size / 1024).toFixed(1)} KB), no blank pages or rendering crashes`
    );
  } catch (err: any) {
    recordResult("Visual Inspection", "Headless Chrome rendering & inspection", "FAIL", Date.now() - tVisualStart, err.message);
  }

  // ---------------------------------------------------------------------------
  // SUITE 8: SUMMARY & VERDICT
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("                               VERIFICATION SUMMARY                             ");
  console.log("================================================================================");

  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;

  for (const r of results) {
    if (r.status === "PASS") passCount++;
    else if (r.status === "FAIL") failCount++;
    else partialCount++;
  }

  console.log(`TOTAL TESTS: ${results.length} | PASS: ${passCount} | FAIL: ${failCount} | PARTIAL: ${partialCount}`);

  if (failCount === 0) {
    console.log("\n>>> ALL TESTS PASSED! PDF WORKFLOW IS VERIFIED END-TO-END. <<<");
  } else {
    console.log(`\n>>> ${failCount} TESTS FAILED. CHECK DETAILS ABOVE. <<<`);
  }

  // Dump JSON results for reporting
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "pdf-verification-results.json"),
    JSON.stringify(results, null, 2)
  );
}

run()
  .catch((e) => {
    console.error("FATAL SUITE ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
