# Student Profile Images in Generated PDF: Remediation Report

**Date**: November 3, 2026  
**Project**: Digital BE Project Log Book (APCOE&R Computer Engineering)  
**System Roles**: Student, Guide, HOD, Admin  
**Status**: RESOLVED & VERIFIED (7/7 Scenarios Passed)  

---

## Executive Summary

Student profile photographs were displaying correctly across the web application (e.g. at `/student/members`) and static logos rendered properly in the PDF, but student photos were consistently missing from the generated PDF (`LogbookPdfDocument`).

This issue was completely diagnosed, resolved, and verified without breaking existing schemas, without exposing private storage credentials, and without modifying the core client-side PDF rendering architecture. All 7 verification scenarios passed, and visual inspection of the generated PDF confirmed that member passport photos render with correct aspect ratios, centered alignment, and zero text overlap.

---

## 1. Root Cause Analysis

### Web vs. PDF Discrepancy
1. **On the Web App**: The browser renders `<img src={member.photoUrl} />`. The path is a relative URL (such as `/api/files/<base64url-ref>.jpg` in Supabase mode or `/media/group-members/<file>.jpg` in local development mode). The web browser automatically attaches active session cookies when requesting these endpoints, so the server authenticates the request and serves the image stream.
2. **In `@react-pdf/renderer`**: PDF rendering is executed by `@react-pdf/renderer`'s `Image` component. React-PDF runs in a decoupled environment:
   - It cannot resolve relative URLs (e.g. `/api/files/...`) because it lacks window origin context unless explicitly supplied.
   - It does not forward browser session cookies or authentication headers when fetching external/relative URLs.
   - Consequently, requests for private storage endpoints failed or returned HTTP 401 Unauthorized, causing React-PDF to drop the images or render empty boxes.
3. **Contrast with Working College Logos**: Static logos (college crest, portrait, building) worked in the PDF because the API route (`/api/groups/[groupId]/pdf/data/route.ts`) pre-resolved them on the server into base64 Data URIs (`data:image/png;base64,...` / `data:image/webp;base64,...`) and embedded them directly into the JSON data bundle.

---

## 2. Database Schema & Storage Architecture

### Exact Database Model and Field
- **Prisma Model**: `GroupMember` (located in `prisma/schema.prisma`)
- **Field Name**: `photoUrl` (`String?`)
- **Storage Locations**:
  - **Local Development**: Stored on disk under `uploads/group-members/<filename>`, served via `/media/group-members/<filename>`.
  - **Production / Staging**: Stored in private Supabase Storage bucket (`private-assets` / `documents`), referenced via encrypted or base64url signed tokens through `/api/files/<ref>.<ext>`.

---

## 3. Image Resolution Implementation

We implemented a dedicated server-side resolution module: `apps/web/lib/services/photo-resolver.ts`.

### Key Capabilities & Safeguards:
1. **Direct Private Storage Retrieval**:
   - For `/api/files/...`: Calls `readPrivateUpload()`, utilizing Supabase service-role credentials strictly on the server to retrieve object bytes from private buckets.
   - For `/media/group-members/...`: Calls `readStoredUpload()` to read local file buffers from disk.
   - Private storage buckets remain **100% private**; no public URLs or service credentials are leaked to the client.
2. **Strict MIME & Magic Byte Validation**:
   - Detects image magic bytes directly from binary headers (`detectSupportedImageMime`):
     - **JPEG**: `0xFF 0xD8 0xFF` -> `image/jpeg`
     - **PNG**: `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A` -> `image/png`
   - Rejects corrupted or unsupported file types.
3. **SSRF & Path Traversal Protection**:
   - Whitelists only trusted internal paths (`/api/files/`, `/media/group-members/`, `group-members/`).
   - Rejects external domains, arbitrary protocols, loopback addresses (`http://localhost`), and directory traversal patterns (`..`, `\\`).
4. **File Size Enforcement**:
   - Enforces `MAX_PHOTO_BYTES = 2 * 1024 * 1024` (2 MB) per photo.
5. **In-Memory LRU Cache**:
   - Caches resolved Data URIs in memory for 5 minutes (TTL: 300,000 ms) with a maximum capacity of 200 entries to prevent redundant storage calls during rapid PDF regenerations.
6. **Graceful Fallback**:
   - If an image is missing, corrupted, or exceeds size limits, the resolver logs a warning and returns `null`. The PDF component cleanly falls back to rendering a bordered placeholder box with the text `"Photo"`, preventing the PDF engine from crashing.

---

## 4. Files Modified

| File | Type | Changes Description |
| :--- | :--- | :--- |
| `apps/web/lib/services/photo-resolver.ts` | **New** | Server-side photo resolution service with magic byte validation, private storage fetcher, in-memory cache, and SSRF prevention. |
| `apps/web/app/api/groups/[groupId]/pdf/data/route.ts` | **Modified** | Integrated `resolveStudentPhotoDataUri` in `GET` handler to pre-resolve all group members' `photoUrl` into base64 Data URIs before returning JSON. |
| `apps/web/components/pdf/logbook-pdf-document.tsx` | **Modified** | Added `overflow: "hidden"` to photo container; guarded `<Image src={member.photoUrl} />` against non-data/non-http URLs to ensure clean fallback rendering. |
| `scripts/verify-student-pdf-images.ts` | **New** | Comprehensive 7-scenario automated verification test suite. |
| `scripts/screenshot-pdf-pages.ts` | **New** | Puppeteer visual inspection rendering script for high-res PDF page captures. |

---

## 5. Verification & Test Results

The test suite was executed against group `DEMO-01` (`cmvwus9r20007ldbrcw5jq51f`) containing 4 registered members:

```
================================================================================
      STUDENT PROFILE IMAGE PDF RESOLUTION & RENDERING VERIFICATION SUITE       
================================================================================
Target Group: DEMO-01 (cmvwus9r20007ldbrcw5jq51f) with 4 members

[PASS] 1. Student with JPEG profile photo
       Member 1 (Aarav Sharma) resolved to valid JPEG data URI (222,623 chars)
[PASS] 2. Student with PNG profile photo
       Member 3 (Chirag Deshmukh) resolved to valid PNG data URI (1,420,974 chars)
[PASS] 3. Student without a profile photo
       Safely returns null so default placeholder renders without throwing
[PASS] 4. Student with inaccessible or deleted photo
       Inaccessible file caught gracefully and returned null (no crash)
[PASS] 5. Multiple students with distinct photos
       Each student correctly mapped to their own unique photo data URI (distinct: true)
[PASS] 6. PDF generated with all available photos
       Full logbook PDF generated (4,042,231 bytes) with valid %PDF- header
[PASS] 7. PDF generated when one image fails to load
       Invalid/missing photos fell back to placeholder cleanly without crashing PDF (2,088,282 bytes)
================================================================================
TOTAL: 7 | PASSED: 7 | FAILED: 0
VERDICT: ALL SCENARIOS PASSED SUCCESSFULLY
================================================================================
```

### Visual Inspection of Generated PDF Pages
Binary analysis and Puppeteer rendering confirmed:
- **Page 2 (Members 1 & 2)**:
  - Header: Left logo (`320,962` bytes) + Right logo (`24,195` bytes).
  - Member 1 (Aarav Sharma): Embedded JPEG photo (`166,556` bytes).
  - Member 2 (Bhavna Patel): Embedded JPEG photo (`1,196,698` bytes).
- **Page 3 (Members 3 & 4)**:
  - Header: Left logo (`320,962` bytes) + Right logo (`24,195` bytes).
  - Member 3 (Chirag Deshmukh): Embedded PNG photo (`1,077,478` bytes).
  - Member 4 (Divya Kulkarni): Renders clean bordered `"Photo"` placeholder box without layout shifts.
- **Aspect Ratio & Layout**:
  - Image box dimensions: `width: "25%", height: 95`.
  - Properties: `objectFit: "cover"`, `overflow: "hidden"`.
  - Passport photos fit neatly within their designated grid cells without overflowing into student information, names, or exam seat numbers.

---

## 6. Typecheck & Code Quality Verification

- **TypeScript Typecheck**:
  ```bash
  npm run typecheck
  > @be-logbook/web: tsc --noEmit -p tsconfig.json (0 errors)
  > @be-logbook/api: tsc --noEmit -p tsconfig.json (0 errors)
  ```
- **Next.js & ESLint**:
  ```bash
  npm run lint
  ✔ No ESLint warnings or errors
  ```

---

## 7. Operational Readiness & Node.js Deployment Note

- **Vercel Node.js Configuration**: As confirmed in project deployment settings, Vercel is aligned with the Node 24+/26.x runtime environment.
- **Client-Side Generation Preserved**: The `@react-pdf/renderer` client-side pipeline remains intact; no server architecture changes were required.
- **Production Safety**: Private Supabase buckets remain completely secure, and service-role keys are never exposed to browser clients.
