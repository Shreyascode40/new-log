# Comprehensive Application Security Audit Report
**Target Application:** Digital BE Project Log Book  
**Institution:** Anantrao Pawar College of Engineering & Research (Record No. ACA/D/003B, Revision 00, DoI 01/02/2025)  
**Date:** November 3, 2026  
**Auditor:** Senior Application Security Engineer  
**Audit Phase:** Phase 1 — Read-Only Security Audit  

---

## 1. Executive Summary

A comprehensive, read-only application security audit of the **Digital BE Project Log Book** web application was performed. The audit examined all layers of the codebase: Next.js frontend, Node.js HTTP backend API, Prisma ORM queries, PostgreSQL/Supabase database schema, NextAuth authentication, role-based authorization, client-side `@react-pdf/renderer` pipeline, file upload handling, and operational dependencies.

### Key Audit Findings:
- **Zero SQL Injection Risk:** All database operations strictly utilize Prisma ORM client builders (`findUnique`, `findFirst`, `findMany`, `create`, `update`, `delete`, `$transaction`) with zero raw SQL queries (`$queryRaw` / `$executeRaw`).
- **Strong PDF Gate & Upload Controls:** The newly optimized PDF generation and upload architecture enforces strict file size boundaries (300B–15MB), rate limiting (15 data req/min, 6 upload req/min), in-flight deduplication, storage path isolation, and structural binary marker validation (`%PDF-`, `%%EOF`, `/Root`, `/Pages`, `xref`).
- **5 High-Priority Vulnerabilities Discovered:**
  1. **Open Redirect** in NextAuth redirect callback allowing any arbitrary external `*.vercel.app` domain.
  2. **Broken Object Level Authorization (BOLA/IDOR)** on student records read endpoints (`listCompetitions`, `listPapers`, `listNotes`, `getContentPage`, `getChecklist`).
  3. **Digital Signature Impersonation** on student legal undertaking and rules acknowledgement allowing teammates to sign for each other.
  4. **Unauthenticated Media Access** for student photos, certificates, papers, and seals via `/media/[...path]`.
  5. **MIME-Type Spoofing / Missing Magic-Byte Validation** on student photo, paper, certificate, and seal uploads.

---

## 2. Overall Security Assessment

| Domain | Status | Rating | Notes |
| :--- | :--- | :--- | :--- |
| **Authentication (NextAuth + JWT)** | Substantial with minor gaps | **Good (B+)** | Bcrypt (10 rounds), SHA-256 hashed tokens, rate limiting on login/signup/reset. Open redirect issue on `.vercel.app`. |
| **Role-Based Access Control (RBAC)** | Strong in core workflows | **Good (A-)** | Server-side role enforcement on marks, guide assignments, HOD unlock, and PDF permission. BOLA flaw in records module. |
| **Database & ORM Security** | Hardened | **Excellent (A)** | 100% parameterized Prisma queries; no raw SQL injection vectors. Sensitive hashes filtered from responses. |
| **PDF Architecture & Uploads** | Hardened | **Excellent (A)** | 5-stage binary validation, in-flight coalescing, isolated server paths, orphan rollback, rate limits. |
| **File Storage & Media Routing** | Needs Remediation | **Fair (C+)** | Private Supabase bucket used in prod, but `/media/[...path]` route bypasses auth for non-PDFs; magic bytes unverified on photo/cert uploads. |
| **HTTP & Application Security** | Needs Remediation | **Fair (C)** | Missing standard security headers (CSP, HSTS, X-Frame-Options); NextAuth callback allows open redirect. |

---

## 3. Vulnerability Findings Table

| Vulnerability | Severity | Affected File | Code Location | Evidence | Risk | Recommendation | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Open Redirect via `.vercel.app` Wildcard** | **High** | `apps/web/lib/auth.ts` | `callbacks.redirect`, lines 66–68 | `parsedUrl.hostname.endsWith(".vercel.app")` permits redirecting to any external attacker-hosted Vercel domain. Confirmed by `test1_OpenRedirectInNextAuth`. | Phishing attacks stealing user sessions or credentials post-login. | Remove `.vercel.app` suffix matching. Only allow relative paths (`url.startsWith("/")`) or exact origin matching (`parsedUrl.origin === parsedBase.origin`). | Run test redirect with `https://attacker.vercel.app` and assert redirection to `/login` or base origin. |
| **BOLA / IDOR on Student Records Read Endpoints** | **High** | `apps/api/src/modules/records.ts` | `listCompetitions` (194), `listPapers` (276), `listNotes` (498), `getContentPage` (428), `getChecklist` (360) | Functions accept `actorOrGroupId`, but discard `actor` and query `prisma.model.findMany({ where: { groupId } })` without checking if `actor` is assigned to `groupId`. | Any student or guide can inspect all competitions, papers, private notes, RTM, cost, and checklists of any other group. | Add `canViewGroup(actor, group)` verification before executing queries in `records.ts`. | Attempt to query `GET /v1/records/groups/:targetGroupId/notes` with a student account from another group and verify HTTP 403. |
| **Digital Signature Impersonation on Legal Undertaking** | **High** | `apps/api/src/modules/signoff.ts` | `sign()` function, lines 35–45 | `sign()` checks `target.groupId === membership.groupId`, but never checks `target.userId === actor.id`. | A student can forge/sign legal undertaking and rules acknowledgment for other teammates without their consent. | Require `if (target.userId !== actor.id) throw new ApiDomainError("FORBIDDEN", "You can only sign for yourself", 403)`. | Attempt to sign with `memberId` of a teammate and confirm HTTP 403. |
| **Unauthenticated Media Access for Student Photos and Files** | **Medium** | `apps/web/app/media/[...path]/route.ts` | `authorizePdf`, line 21, and `GET`, lines 47–51 | `if (pathParts[0]?.toLowerCase() !== "pdf") return null;` skips auth for all non-PDF uploads (`group-members`, `competitions`, `papers`, `sponsor`). | Direct unauthenticated public access to student profile photos, certificates, papers, and sponsor company seals. | Require session check and route all private files through `/api/files/[fileRef]` which enforces `authorizeFileAccess`. | Issue unauthenticated `GET /media/group-members/<filename>` and assert HTTP 401/403. |
| **MIME-Type Spoofing / Missing Magic-Byte File Validation** | **Medium** | `apps/api/src/modules/group-info.ts`, `apps/api/src/modules/records.ts`, `apps/api/src/modules/sponsored.ts` | `updateMemberPhoto` (219), `persistDocument` (108), `saveUploadBuffer` (116) | Backend relies exclusively on client-supplied `Content-Type` header (`image/jpeg`, `application/pdf`) without inspecting file magic bytes. | Upload of arbitrary HTML, SVG, or executable scripts disguised as images or PDFs into private storage. | Inspect buffer magic bytes (`0xFF 0xD8 0xFF` for JPEG, `0x89 0x50 0x4E 0x47` for PNG, `%PDF-` for PDF) prior to persistence. | Attempt to upload text/HTML file with `Content-Type: image/jpeg` and verify rejection with HTTP 400. |
| **Missing HTTP Security Headers (CSP, HSTS, X-Frame-Options)** | **Medium** | `apps/web/next.config.mjs` | Whole configuration | No `headers()` function configured in Next.js config. | Application is vulnerable to clickjacking (`X-Frame-Options`), MIME-sniffing, and lacks defense-in-depth CSP against XSS. | Add `headers()` in `next.config.mjs` defining CSP, HSTS, `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`. | Run `curl -I https://<host>/login` and verify presence of all security headers. |
| **Stateless JWT Invalidation Gap on Password Reset** | **Low** | `apps/web/lib/auth.ts`, `apps/web/middleware.ts` | `jwt` and `session` callbacks | NextAuth JWT is stateless; password reset or HOD user deactivation does not immediately invalidate active browser JWT cookies. | Compromised sessions remain usable for frontend viewing until 30-day token expiration. | Include a `tokenVersion` or `passwordChangedAt` timestamp in JWT and validate it, or reduce JWT `maxAge` to 24 hours. | Reset user password and attempt to browse with previous session cookie. |
| **Outdated Third-Party Dependencies** | **Low / Informational** | `package.json`, `package-lock.json` | `vitest`, `next-auth` (transitive `nodemailer`), `zod`, `postcss` | `npm audit` reports 29 vulnerabilities (15 moderate, 11 high, 3 critical) in test/dev tooling and transitive packages. | Potential ReDoS or prototype pollution in development/test environments. | Run `npm audit fix` and selectively update devDependencies. | Re-run `npm audit` to confirm resolution. |

---

## 4. Top 5 Most Important Security Issues

These 5 issues should be addressed prior to production release:

1. **NextAuth Open Redirect Vulnerability (`apps/web/lib/auth.ts`)**:
   Wildcard matching on `.vercel.app` allows malicious actors to craft convincing phishing links redirecting legitimate college students/faculty to attacker-owned infrastructure.
2. **BOLA / IDOR on Student Records (`apps/api/src/modules/records.ts`)**:
   Allows any authenticated student to view competition entries, papers, private notes, and checklist items belonging to other groups.
3. **Digital Signature Impersonation on Undertaking (`apps/api/src/modules/signoff.ts`)**:
   Breaches legal non-repudiation by allowing one group member to sign the institutional undertaking for all other members.
4. **Unauthenticated Media Access (`apps/web/app/media/[...path]/route.ts`)**:
   Allows external unauthenticated downloads of student photos, certificates, and sponsor company documents.
5. **Missing Magic-Byte Validation on File Uploads (`group-info.ts`, `records.ts`, `sponsored.ts`)**:
   Accepts arbitrary payloads if the client sends an allowed `Content-Type` header.

---

## 5. Security Controls Already Implemented Correctly

The codebase contains numerous well-engineered security controls:

1. **Prisma ORM Parameterization:** Zero string concatenation in database queries across all modules.
2. **Server-Side Role & Marks Lockdown:**
   - Only assigned guide can enter or edit marks (`canEnterMarks`).
   - Approved marks are strictly locked; only HOD can unlock with a mandatory written reason (`canUnlockMarks`).
   - Guides of other groups, students, and HOD cannot enter marks.
3. **Topic Finalization Guard:** Topic 2 is completely blocked unless Topic 1 is explicitly marked `REJECTED`.
4. **PDF Gate Lockdown:**
   - Server re-validates that `pdfPermission === true` AND all sections are complete.
   - Unauthorized users or revoked permissions return HTTP 403.
5. **PDF Upload Hardening:**
   - Validates `%PDF-` header within first 1024 bytes.
   - Validates `%%EOF` trailer within last 1024 bytes (detects truncated uploads).
   - Validates `/Root`, `/Pages`, and `xref` catalog structures.
   - Enforces 300B minimum and 15MB maximum sizes.
   - Isolates storage path on server (`groups/${group.id}/${slug}-${Date.now()}-${randomBytes}.pdf`).
   - Automatic compensation rollback deletes orphaned Supabase files if database export registration fails.
   - In-flight promise coalescing prevents concurrent duplicate generation.
6. **Authentication & Token Controls:**
   - Passwords hashed using bcrypt (10 rounds).
   - Email verification and password reset tokens generated via `crypto.randomBytes(32)` and stored as SHA-256 hashes (protects against database leaks).
   - Rate limiting enforced on login, signup, password reset, and PDF generation.
   - Internal API authentication between Next.js and backend API uses HMAC SHA-256 with `timingSafeEqual`.
   - Zero exposure of service-role keys or sensitive credentials via `NEXT_PUBLIC_` prefixes.

---

## 6. Security Test Execution Results

We executed the automated security test suite ([`scripts/test-security-audit.ts`](file:///D:/be/scripts/test-security-audit.ts)) in the environment:

| Test ID | Test Description | Execution Status | Result |
| :--- | :--- | :--- | :--- |
| **TEST-01** | NextAuth Open Redirect via `.vercel.app` wildcard | Executed | **VULNERABILITY CONFIRMED:** External `https://malicious-phishing-attacker.vercel.app` allowed |
| **TEST-02** | Role & Permission Boundary Matrix (`canViewGroup`, `canEnterMarks`, `canApproveMarks`, `canUnlockMarks`, `canGeneratePdf`) | Executed | **PASS:** All cross-role and cross-group boundary checks enforced |
| **TEST-03** | In-Memory & Redis Rate Limiting Enforcement | Executed | **PASS:** Requests 1–5 allowed; requests 6–7 throttled with HTTP 429 semantics |
| **TEST-04** | PDF Upload Structural Integrity & Bounds | Executed | **PASS:** 0-byte, truncated, and bounds-violating payloads successfully blocked |
| **TEST-05** | Cryptographic Token Generation, Entropy & SHA-256 Hashing | Executed | **PASS:** 256 bits entropy, distinct hashes, proper TTL calculation |

### Tests Not Executed Directly in Live Environment (By Design / Read-Only Safety):
- Exploitative database modification tests on live production users.
- Live network brute-force attacks against external production SMTP / Supabase servers.

---

## 7. Step-by-Step Remediation Roadmap

### Phase A: Pre-Production Critical Fixes (Immediate)

1. **Fix Open Redirect in `apps/web/lib/auth.ts`:**
   ```typescript
   // In redirect callback:
   if (url.startsWith("/")) return `${base}${url}`;
   try {
     const parsedUrl = new URL(url);
     const parsedBase = new URL(base);
     if (parsedUrl.origin === parsedBase.origin) return url;
   } catch {}
   return `${base}/login`;
   ```

2. **Fix BOLA on Records in `apps/api/src/modules/records.ts`:**
   Add a reusable group authorization helper before querying records:
   ```typescript
   async function assertCanViewRecords(actor: RecordsActor, groupId: string) {
     const group = await prisma.group.findUnique({
       where: { id: groupId },
       select: { guideId: true, members: { select: { userId: true } } },
     });
     if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
     const allowed =
       actor.role === "HOD" ||
       group.guideId === actor.id ||
       group.members.some((m) => m.userId === actor.id);
     if (!allowed) throw new ApiDomainError("FORBIDDEN", "You cannot view this group's records", 403);
   }
   ```
   Call `await assertCanViewRecords(actor, groupId)` in `listCompetitions`, `listPapers`, `listNotes`, `getContentPage`, and `getChecklist`.

3. **Fix Undertaking Impersonation in `apps/api/src/modules/signoff.ts`:**
   ```typescript
   if (target.userId !== actor.id) {
     throw new ApiDomainError("FORBIDDEN", "You can only sign for yourself.", 403);
   }
   ```

4. **Restrict Media Route in `apps/web/app/media/[...path]/route.ts`:**
   Enforce session authentication on all requests to `/media/[...path]` and verify group membership before serving static files.

5. **Implement Magic Byte Validation on Uploads:**
   Inspect initial buffer bytes in `storePhoto`, `persistDocument`, and `saveUploadBuffer`:
   - JPEG: `bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF`
   - PNG: `bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47`
   - PDF: `bytes.subarray(0, 5).toString("ascii") === "%PDF-"`

### Phase B: Defense-in-Depth & Security Hardening (Post-Release)

1. **Add Security Headers in `apps/web/next.config.mjs`:**
   Configure `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`.
2. **Shorten JWT Lifetime:**
   Set NextAuth `session.maxAge = 24 * 60 * 60` (24 hours) to limit exposure of active sessions.
3. **Dependency Maintenance:**
   Run `npm audit fix` to resolve devDependencies vulnerabilities.

---

## 8. Deployment Risks

- **Storage Provider Consistency:** Ensure `UPLOAD_PROVIDER=supabase` is explicitly set in production environment variables; otherwise, serverless filesystem restarts will cause uploaded files to be lost.
- **Bucket Privacy:** Verify in Supabase Storage dashboard that `logbook-private-uploads` and `logbook-pdf-bucket` have **Public bucket = OFF**.
- **Internal Secret Length:** Ensure `API_INTERNAL_SECRET` is at least 32 characters in both Vercel and Render dashboards.

---
*Report generated and concluded in accordance with Phase 1 read-only audit criteria.*
