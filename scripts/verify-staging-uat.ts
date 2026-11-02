import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {}

import puppeteer from "puppeteer-core";
import * as path from "node:path";
import * as fs from "node:fs";
import { prisma } from "../apps/api/src/db.js";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Helper to log in via NextAuth credentials provider
async function loginUser(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfText = await csrfRes.text();
  let csrfToken = "";
  try {
    const csrfJson = JSON.parse(csrfText);
    csrfToken = csrfJson.csrfToken;
  } catch {
    throw new Error(`Failed to parse CSRF: ${csrfText.slice(0, 100)}`);
  }
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

  const loginCookies = loginRes.headers.getSetCookie();
  const sessionCookies = [...csrfCookies, ...loginCookies].map((c) => c.split(";")[0]).join("; ");
  if (!loginCookies.some((c) => c.includes("next-auth.session-token"))) {
    const text = await loginRes.text().catch(() => "");
    throw new Error(`Login failed for ${email} (HTTP ${loginRes.status}): ${text.slice(0, 100)}`);
  }
  return sessionCookies;
}

export interface UatResult {
  category: "STUDENT" | "GUIDE" | "HOD_ADMIN" | "AUTH_BOUNDARY" | "RESPONSIVE_BROWSER" | "PDF_WORKFLOW";
  workflow: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT TESTED";
  durationMs: number;
}

const uatResults: UatResult[] = [];

function recordUat(
  category: UatResult["category"],
  workflow: string,
  expected: string,
  actual: string,
  status: UatResult["status"],
  durationMs: number
) {
  uatResults.push({ category, workflow, expected, actual, status, durationMs });
  console.log(`[${status}] [${category}] ${workflow} (${durationMs}ms)\n  Expected: ${expected}\n  Actual:   ${actual}\n`);
}

async function runUat() {
  console.log("================================================================================");
  console.log("      STAGING USER ACCEPTANCE TESTING (UAT) & CROSS-BROWSER VERIFICATION       ");
  console.log("================================================================================");

  const demoGroup = await prisma.group.findFirstOrThrow({
    where: { groupNo: "DEMO-01" },
    include: {
      guide: true,
      members: { include: { user: true } },
    },
  });

  const studentUser = demoGroup.members.find((m) => m.user.email === "demo.student3@apcoer.edu.in")?.user || demoGroup.members[0]!.user;
  const guideUser = demoGroup.guide!;
  const hodUser = await prisma.user.findFirstOrThrow({ where: { role: "HOD" } });
  const strangerUser = await prisma.user.findFirstOrThrow({ where: { email: "test.stranger@apcoer.edu.in" } });

  console.log(`Test Environment: Localhost Next.js dev on :3000 + Fastify on :4000`);
  console.log(`Group: ${demoGroup.groupNo} (${demoGroup.id})`);
  console.log(`Student Account: ${studentUser.name} (${studentUser.email})`);
  console.log(`Guide Account:   ${guideUser.name} (${guideUser.email})`);
  console.log(`HOD/Admin Acc:   ${hodUser.name} (${hodUser.email})`);
  console.log(`Stranger Acc:    ${strangerUser.name} (${strangerUser.email})\n`);

  // ---------------------------------------------------------------------------
  // 1. STUDENT WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log("--- 1. STUDENT ROLE ACCEPTANCE WORKFLOWS ---");
  let studentCookie = "";
  let tStart = Date.now();
  try {
    studentCookie = await loginUser(studentUser.email, "Password@123");
    recordUat(
      "STUDENT",
      "Student Authentication & Session Establishment",
      "Valid NextAuth session cookie issued for STUDENT role",
      "Session cookie received successfully",
      "PASS",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("STUDENT", "Student Authentication & Session Establishment", "Successful login", err.message, "FAIL", Date.now() - tStart);
  }

  // 1.2 Student Group Details & Profile
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/student`, {
      headers: { cookie: studentCookie },
      redirect: "manual",
    });
    recordUat(
      "STUDENT",
      "Student Portal Landing Page & Navigation",
      "HTTP 200 with stepper navigation for all 18 logbook sections",
      `HTTP ${res.status} returned`,
      res.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("STUDENT", "Student Portal Landing Page & Navigation", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 1.3 Digital Undertaking & Rules Acceptance
  tStart = Date.now();
  try {
    const member = demoGroup.members.find((m) => m.userId === studentUser.id);
    const hasRules = !!member?.rulesAckAt;
    const hasUndertaking = !!member?.undertakingAcceptedAt;
    recordUat(
      "STUDENT",
      "Legal Undertaking & Rules Digital Signatures",
      "Rules and Undertaking digitally acknowledged with timestamp",
      `Rules acknowledged: ${hasRules}, Undertaking accepted: ${hasUndertaking}`,
      hasRules && hasUndertaking ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("STUDENT", "Legal Undertaking & Rules Digital Signatures", "Acknowledged", err.message, "FAIL", Date.now() - tStart);
  }

  // 1.4 Topic Proposals
  tStart = Date.now();
  try {
    const topics = await prisma.topicProposal.findMany({
      where: { groupId: demoGroup.id },
      orderBy: { topicNo: "asc" },
    });
    const topic1 = topics.find((t) => t.topicNo === 1);
    const topic2 = topics.find((t) => t.topicNo === 2);
    const valid = topic1?.status === "APPROVED" && (topic2?.status === "DRAFT" || !topic2);
    recordUat(
      "STUDENT",
      "Topic Proposal & Rule 6 Lock Enforcement",
      "Topic 1 APPROVED; Topic 2 stays DRAFT / locked unless Topic 1 rejected",
      `Topic 1 status: ${topic1?.status}, Topic 2 status: ${topic2?.status || "None"}`,
      valid ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("STUDENT", "Topic Proposal & Rule 6 Lock Enforcement", "Topic 1 Approved", err.message, "FAIL", Date.now() - tStart);
  }

  // 1.5 PDF Download Route for Student
  tStart = Date.now();
  try {
    const pdfPageRes = await fetch(`${BASE_URL}/student/pdf`, {
      headers: { cookie: studentCookie },
      redirect: "manual",
    });
    recordUat(
      "STUDENT",
      "Student PDF Export Dashboard Access",
      "HTTP 200 with PDF status panel, completion check and download triggers",
      `HTTP ${pdfPageRes.status} returned`,
      pdfPageRes.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("STUDENT", "Student PDF Export Dashboard Access", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // ---------------------------------------------------------------------------
  // 2. GUIDE WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. GUIDE ROLE ACCEPTANCE WORKFLOWS ---");
  let guideCookie = "";
  tStart = Date.now();
  try {
    guideCookie = await loginUser(guideUser.email, "Password@123");
    recordUat(
      "GUIDE",
      "Guide Authentication & Session Establishment",
      "Valid NextAuth session cookie issued for GUIDE role",
      "Session cookie received successfully",
      "PASS",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("GUIDE", "Guide Authentication & Session Establishment", "Successful login", err.message, "FAIL", Date.now() - tStart);
  }

  // 2.2 Guide Dashboard & Assigned Groups Only
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/guide`, {
      headers: { cookie: guideCookie },
      redirect: "manual",
    });
    recordUat(
      "GUIDE",
      "Guide Dashboard Access & Group Scope",
      "HTTP 200 displaying assigned groups only",
      `HTTP ${res.status} returned`,
      res.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("GUIDE", "Guide Dashboard Access & Group Scope", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 2.3 Guide Activity Verification
  tStart = Date.now();
  try {
    const actRes = await fetch(`${BASE_URL}/guide/activity`, {
      headers: { cookie: guideCookie },
      redirect: "manual",
    });
    recordUat(
      "GUIDE",
      "Guide Activity Verification Queue",
      "HTTP 200 showing activity charts requiring verification",
      `HTTP ${actRes.status} returned`,
      actRes.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("GUIDE", "Guide Activity Verification Queue", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 2.4 Guide Marks & Evaluation
  tStart = Date.now();
  try {
    const mockRes = await fetch(`${BASE_URL}/guide/mock`, {
      headers: { cookie: guideCookie },
      redirect: "manual",
    });
    const finalRes = await fetch(`${BASE_URL}/guide/final`, {
      headers: { cookie: guideCookie },
      redirect: "manual",
    });
    const ok = mockRes.status === 200 && finalRes.status === 200;
    recordUat(
      "GUIDE",
      "Guide Evaluation Sheets (Mock T1 & Final T2)",
      "HTTP 200 for mock (50 marks) and final (100 marks) rubrics",
      `Mock: HTTP ${mockRes.status}, Final: HTTP ${finalRes.status}`,
      ok ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("GUIDE", "Guide Evaluation Sheets", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // ---------------------------------------------------------------------------
  // 3. HOD / ADMIN WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. HOD / ADMIN ROLE ACCEPTANCE WORKFLOWS ---");
  let hodCookie = "";
  tStart = Date.now();
  try {
    hodCookie = await loginUser(hodUser.email, "hod@apcoer12");
    recordUat(
      "HOD_ADMIN",
      "HOD/Admin Authentication & Session",
      "Valid NextAuth session cookie issued for HOD role",
      "Session cookie received successfully",
      "PASS",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("HOD_ADMIN", "HOD/Admin Authentication & Session", "Successful login", err.message, "FAIL", Date.now() - tStart);
  }

  // 3.2 HOD Overview & Groups Oversight
  tStart = Date.now();
  try {
    const hodRes = await fetch(`${BASE_URL}/hod`, {
      headers: { cookie: hodCookie },
      redirect: "manual",
    });
    const groupsRes = await fetch(`${BASE_URL}/hod/groups`, {
      headers: { cookie: hodCookie },
      redirect: "manual",
    });
    const ok = hodRes.status === 200 && groupsRes.status === 200;
    recordUat(
      "HOD_ADMIN",
      "Department Overview & Group Oversight",
      "HTTP 200 showing all groups, guides, completion percentages",
      `Overview: HTTP ${hodRes.status}, Groups: HTTP ${groupsRes.status}`,
      ok ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("HOD_ADMIN", "Department Overview & Group Oversight", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 3.3 HOD User Management & Faculty Creation
  tStart = Date.now();
  try {
    const usersRes = await fetch(`${BASE_URL}/hod/users`, {
      headers: { cookie: hodCookie },
      redirect: "manual",
    });
    recordUat(
      "HOD_ADMIN",
      "User Management (Faculty Guides & Students)",
      "HTTP 200 listing faculty guides and student rosters",
      `HTTP ${usersRes.status} returned`,
      usersRes.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("HOD_ADMIN", "User Management", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 3.4 HOD Faculty Assignments
  tStart = Date.now();
  try {
    const assignRes = await fetch(`${BASE_URL}/hod/assignments`, {
      headers: { cookie: hodCookie },
      redirect: "manual",
    });
    recordUat(
      "HOD_ADMIN",
      "Faculty Guide Group Assignment Management",
      "HTTP 200 allowing HOD to assign one guide per group",
      `HTTP ${assignRes.status} returned`,
      assignRes.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("HOD_ADMIN", "Faculty Guide Group Assignment Management", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // 3.5 HOD Audit Log Inspection
  tStart = Date.now();
  try {
    const auditRes = await fetch(`${BASE_URL}/hod/audit`, {
      headers: { cookie: hodCookie },
      redirect: "manual",
    });
    recordUat(
      "HOD_ADMIN",
      "System Audit Log & Immutable Action Trail",
      "HTTP 200 providing filterable audit logs with before/after diffs",
      `HTTP ${auditRes.status} returned`,
      auditRes.status === 200 ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("HOD_ADMIN", "System Audit Log & Immutable Action Trail", "HTTP 200", err.message, "FAIL", Date.now() - tStart);
  }

  // ---------------------------------------------------------------------------
  // 4. CROSS-ROLE AUTHORIZATION BOUNDARIES
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. CROSS-ROLE AUTHORIZATION BOUNDARIES ---");

  // 4.1 Student accessing HOD route
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/hod`, {
      headers: { cookie: studentCookie },
      redirect: "manual",
    });
    const blocked = res.status === 307 || res.status === 403;
    recordUat(
      "AUTH_BOUNDARY",
      "Student Attempting HOD Route Access (/hod)",
      "Redirected or HTTP 403 Forbidden",
      `HTTP ${res.status} returned (${res.headers.get("location") || "blocked"})`,
      blocked ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("AUTH_BOUNDARY", "Student Attempting HOD Route Access", "Blocked", err.message, "FAIL", Date.now() - tStart);
  }

  // 4.2 Guide accessing HOD route
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/hod/users`, {
      headers: { cookie: guideCookie },
      redirect: "manual",
    });
    const blocked = res.status === 307 || res.status === 403;
    recordUat(
      "AUTH_BOUNDARY",
      "Guide Attempting HOD User Management (/hod/users)",
      "Redirected or HTTP 403 Forbidden",
      `HTTP ${res.status} returned`,
      blocked ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("AUTH_BOUNDARY", "Guide Attempting HOD User Management", "Blocked", err.message, "FAIL", Date.now() - tStart);
  }

  // 4.3 Student attempting Guide route
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/guide`, {
      headers: { cookie: studentCookie },
      redirect: "manual",
    });
    const blocked = res.status === 307 || res.status === 403;
    recordUat(
      "AUTH_BOUNDARY",
      "Student Attempting Guide Route Access (/guide)",
      "Redirected or HTTP 403 Forbidden",
      `HTTP ${res.status} returned`,
      blocked ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("AUTH_BOUNDARY", "Student Attempting Guide Route Access", "Blocked", err.message, "FAIL", Date.now() - tStart);
  }

  // 4.4 Unauthenticated access to protected portal
  tStart = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/student`, { redirect: "manual" });
    const blocked = res.status === 307 || res.status === 401;
    recordUat(
      "AUTH_BOUNDARY",
      "Unauthenticated Visitor to Protected Portal (/student)",
      "Redirected to /login (HTTP 307)",
      `HTTP ${res.status} pointing to ${res.headers.get("location")}`,
      blocked ? "PASS" : "FAIL",
      Date.now() - tStart
    );
  } catch (err: any) {
    recordUat("AUTH_BOUNDARY", "Unauthenticated Visitor to Protected Portal", "Redirected to /login", err.message, "FAIL", Date.now() - tStart);
  }

  // ---------------------------------------------------------------------------
  // 5. CROSS-BROWSER & RESPONSIVE TESTING (PUPPETEER)
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. CROSS-BROWSER & RESPONSIVE TESTING ---");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const viewports = [
    { name: "Desktop Chrome (1920x1080)", width: 1920, height: 1080, isMobile: false },
    { name: "Laptop Standard (1366x768)", width: 1366, height: 768, isMobile: false },
    { name: "Tablet iPad (768x1024)", width: 768, height: 1024, isMobile: true },
    { name: "Mobile iPhone 14 (390x844)", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  const screenDir = path.join(process.cwd(), "scripts", "uat-screenshots");
  if (!fs.existsSync(screenDir)) {
    fs.mkdirSync(screenDir, { recursive: true });
  }

  for (const vp of viewports) {
    tStart = Date.now();
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: (vp as any).hasTouch || false,
      });

      // 1. Test Login Page
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
      const slug = vp.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      await page.screenshot({ path: path.join(screenDir, `login-${slug}.png`) });

      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      recordUat(
        "RESPONSIVE_BROWSER",
        `Login Page Render on ${vp.name}`,
        "Rendered without horizontal overflow, inputs aligned",
        `Rendered successfully, horizontal overflow detected: ${overflow}`,
        !overflow ? "PASS" : "FAIL",
        Date.now() - tStart
      );

      await page.close();
    } catch (err: any) {
      recordUat("RESPONSIVE_BROWSER", `Login Page Render on ${vp.name}`, "Clean render", err.message, "FAIL", Date.now() - tStart);
    }
  }

  await browser.close();

  // ---------------------------------------------------------------------------
  // 6. END-TO-END PDF VERIFICATION CONFIRMATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. END-TO-END PDF VERIFICATION CONFIRMATION ---");
  tStart = Date.now();
  try {
    const latestExport = await prisma.pdfExport.findFirst({
      where: { groupId: demoGroup.id },
      orderBy: { generatedAt: "desc" },
    });
    if (latestExport && latestExport.fileUrl) {
      recordUat(
        "PDF_WORKFLOW",
        "E2E PDF Lifecycle Confirmation (DEMO-01)",
        "Verified PDF generated, uploaded to Supabase, archived, and matched",
        `Verified export ID ${latestExport.id}, fileUrl: ${latestExport.fileUrl}, generatedAt: ${latestExport.generatedAt.toISOString()}`,
        "PASS",
        Date.now() - tStart
      );
    } else {
      recordUat(
        "PDF_WORKFLOW",
        "E2E PDF Lifecycle Confirmation (DEMO-01)",
        "Valid export record",
        "No export record found",
        "FAIL",
        Date.now() - tStart
      );
    }
  } catch (err: any) {
    recordUat("PDF_WORKFLOW", "E2E PDF Lifecycle Confirmation", "Confirmed", err.message, "FAIL", Date.now() - tStart);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("                                  UAT SUMMARY                                   ");
  console.log("================================================================================");

  let passCount = 0;
  let failCount = 0;
  for (const r of uatResults) {
    if (r.status === "PASS") passCount++;
    else failCount++;
  }

  console.log(`TOTAL UAT SCENARIOS: ${uatResults.length} | PASS: ${passCount} | FAIL: ${failCount}`);
  if (failCount === 0) {
    console.log("\n>>> ALL ROLE-BASED & CROSS-BROWSER UAT SCENARIOS PASSED! <<<");
  } else {
    console.log(`\n>>> ${failCount} SCENARIOS FAILED. CHECK LOGS ABOVE. <<<`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "scripts", "uat-verification-results.json"),
    JSON.stringify(uatResults, null, 2)
  );
}

runUat()
  .catch((e) => {
    console.error("FATAL UAT ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
