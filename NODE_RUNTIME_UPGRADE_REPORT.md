# Node.js Runtime Upgrade & Dependency Analysis Report

**Project:** Digital BE Project Log Book  
**Date:** November 3, 2026  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

This report documents the resolution of the Node.js version mismatch across all build, runtime, and deployment environments of the Digital BE Project Log Book monorepo.

Previously:
- Docker stages used `node:20-bookworm-slim` (Node 20.20.2), which violated dependency requirements for `@sparticuz/chromium` (`^22.17.0 || >=24.0.0`), `puppeteer-core` (`>=22.12.0`), and Supabase runtime dependencies (`>=22`).
- The root `package.json` had a lower bound pin (`>=22.17.0`).
- GitHub Actions CI database backup was pinned to Node 22.
- Neither `.nvmrc` nor `.node-version` existed to guide automated Vercel/Render runtime detection.

All container targets, CI workflows, workspace engines, and environment version pins have been upgraded to consistently target **Node.js 24.x**, with backward compatibility preserved for developer environments running Node 22.17.0.

---

## 2. Files Changed and Created

| File | Status | Description of Change |
|---|---|---|
| [Dockerfile](file:///D:/be/Dockerfile) | Modified | Upgraded all 3 stages (`deps`, `builder`, `runner`) from `node:20-bookworm-slim` to `node:24-bookworm-slim`. Added `RUN node -v` verification in each stage. Preserved `openssl ca-certificates`. |
| [package.json](file:///D:/be/package.json) | Modified | Updated `"engines.node"` from `">=22.17.0"` to `"24.x || >=22.17.0"`. |
| [apps/web/package.json](file:///D:/be/apps/web/package.json) | Modified | Added `"engines.node": "24.x || >=22.17.0"` for explicit Vercel frontend runtime alignment. |
| [apps/api/package.json](file:///D:/be/apps/api/package.json) | Modified | Added `"engines.node": "24.x || >=22.17.0"` for Render / API service runtime alignment. |
| [.github/workflows/db-backup.yml](file:///D:/be/.github/workflows/db-backup.yml) | Modified | Upgraded `node-version` in `actions/setup-node@v4` from `22` to `24`. |
| [.nvmrc](file:///D:/be/.nvmrc) | Created | Pinned `24` for nvm, fnm, and automated Vercel/deployment detection. |
| [.node-version](file:///D:/be/.node-version) | Created | Pinned `24` for universal version managers and CI platforms. |

---

## 3. Node.js Version Matrix (Before vs. After)

| Target / Environment | Previous Version | New Target Version | Detection / Enforcement Mechanism |
|---|---|---|---|
| **Docker Build: `deps` stage** | Node 20.20.2 (`node:20-bookworm-slim`) | **Node 24.x (`node:24-bookworm-slim`)** | `FROM node:24-bookworm-slim AS deps` + `RUN node -v` |
| **Docker Build: `builder` stage** | Node 20.20.2 (`node:20-bookworm-slim`) | **Node 24.x (`node:24-bookworm-slim`)** | `FROM node:24-bookworm-slim AS builder` + `RUN node -v` |
| **Docker Runtime: `runner` stage** | Node 20.20.2 (`node:20-bookworm-slim`) | **Node 24.x (`node:24-bookworm-slim`)** | `FROM node:24-bookworm-slim AS runner` + `RUN node -v` |
| **Root Workspace** | `node: >=22.17.0` | **`node: 24.x || >=22.17.0`** | `package.json` `engines.node` |
| **Web App (`apps/web`)** | Unspecified | **`node: 24.x || >=22.17.0`** | `apps/web/package.json` `engines.node` |
| **API Server (`apps/api`)** | Unspecified | **`node: 24.x || >=22.17.0`** | `apps/api/package.json` `engines.node` |
| **GitHub Actions CI** | `node-version: 22` | **`node-version: 24`** | `.github/workflows/db-backup.yml` |
| **Vercel Deployments** | Next.js fallback | **Node.js 24.x** | `.nvmrc`, `.node-version`, `engines.node` |
| **Render API Service** | Node 20 (via Dockerfile) | **Node.js 24.x** | Dockerfile multi-stage build |
| **Local Host Development** | Node v22.17.0 | **Node v22.17.0 / v24.x** | Compatible with semver range; lockfile preserved |

---

## 4. Build and Compilation Results

All validation commands executed cleanly without errors:

1. **Clean Dependency Installation (`npm ci`):**
   - Output: `added 613 packages, and audited 616 packages in 1m`
   - Exit code: `0`
   - Existing [package-lock.json](file:///D:/be/package-lock.json) preserved intact without forced modifications.

2. **Prisma Client Generation (`npx prisma generate`):**
   - Output: `✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 227ms`
   - Exit code: `0`

3. **Workspace Typecheck (`npm run typecheck`):**
   - Output: Both `@be-logbook/web` and `@be-logbook/api` compiled without errors.
   - Exit code: `0`

4. **Linting (`npm run lint`):**
   - Output: `✔ No ESLint warnings or errors`
   - Exit code: `0`

5. **Next.js Production Build (`npm run build`):**
   - Output: All 56 static and dynamic routes compiled and optimized.
   - First Load JS shared by all: 87.6 kB
   - Exit code: `0`

6. **API Service Build (`npm run api:build`):**
   - Output: `tsc -p apps/api/tsconfig.json` completed with zero TypeScript errors.
   - Exit code: `0`

---

## 5. Verification & Testing Results

### 5.1 Staging UAT Verification (`scripts/verify-staging-uat.ts`)
- **Total Test Cases:** 23
- **Passed:** 23
- **Failed:** 0
- **Workflows Verified:**
  - Student: Registration, session authentication, legal undertaking, topic proposal, logbook navigation, PDF export access.
  - Guide: Authentication, assigned group isolation, activity verification queue, mock and final evaluation rubrics.
  - HOD / Admin: Faculty and student user management, guide group assignments, immutable audit trail.
  - Cross-Role Authorization: Role boundary verification (Student to `/hod` blocked, Guide to `/hod/users` blocked, Student to `/guide` blocked, unauthenticated access redirected to `/login`).
  - Cross-Browser / Responsive: Desktop (1920x1080), Laptop (1366x768), Tablet (768x1024), Mobile (390x844).

### 5.2 PDF Security & Concurrency Verification (`scripts/test-pdf-security-concurrency.ts`)
- **Structural Integrity:** 10/10 edge-case tests passed (0-byte rejection, undersized rejection, missing `%PDF-` header rejection, truncated `%%EOF` rejection, missing `/Root` catalog rejection, missing `/Pages` rejection, missing `xref` rejection).
- **Concurrency & In-Flight Coalescing:** 10 simultaneous uploads safely coalesced into 1 backend operation.
- **Concurrent Load Simulation:** 70 simulated concurrent requests dispatched; 100% success rate (70/70), 319.6 req/sec throughput, 150 ms average latency.

### 5.3 Backend Integration & Server Execution
- **Fastify API Server:** Listening on port 4000; `/health` returns `{"status":"ok","service":"be-logbook-api"}`.
- **Supabase PostgreSQL & Storage:** Connected and functional for document archiving and retrieval.
- **Puppeteer Headless Rendering:** Operational via Chrome executable and serverless `@sparticuz/chromium` fallback.

---

## 6. Deprecated Dependency Inspection

An inspection of npm deprecation warnings was performed using `npm ls`:

```text
be-logbook@0.1.0 D:\be
`-- @be-logbook/web@0.1.0 -> .\apps\web
  +-- eslint-config-next@14.2.5
  | +-- @next/eslint-plugin-next@14.2.5
  | | `-- glob@10.3.10
  | +-- @typescript-eslint/parser@7.2.0
  | | `-- eslint@8.57.1 deduped
  | +-- eslint-import-resolver-typescript@3.10.1
  | | `-- eslint@8.57.1 deduped
  | +-- eslint-plugin-import@2.32.0
  | | `-- eslint@8.57.1 deduped
  | +-- eslint-plugin-jsx-a11y@6.10.2
  | | `-- eslint@8.57.1 deduped
  | +-- eslint-plugin-react-hooks@5.0.0-canary-7118f5dd7-20230705
  | | `-- eslint@8.57.1 deduped
  | +-- eslint-plugin-react@7.37.5
  | | `-- eslint@8.57.1 deduped
  | `-- eslint@8.57.1 deduped
  `-- eslint@8.57.1
    +-- @eslint-community/eslint-utils@4.10.1
    | `-- eslint@8.57.1 deduped
    `-- file-entry-cache@6.0.1
      `-- flat-cache@3.2.0
        `-- rimraf@3.0.2
          `-- glob@7.2.3
            `-- inflight@1.0.6
```

### Findings by Package:

1. **`eslint@8.57.1`:**
   - *Reason for Deprecation:* ESLint 8 reached end-of-life on October 5, 2024.
   - *Introducing Dependency:* Direct devDependency in `apps/web/package.json` required by `eslint-config-next@14.2.5` (`peerDependencies: { "eslint": "^7.23.0 || ^8.0.0" }`).
   - *Resolution Note:* Next.js 14 does not provide first-party support for ESLint 9 in `eslint-config-next@14`. Upgrading to ESLint 9 breaks the Next.js 14 linting plugin. ESLint 8 must be retained until Next.js is upgraded to version 15.

2. **`flat-cache@3.2.0` -> `rimraf@3.0.2`:**
   - *Reason for Deprecation:* Rimraf v3 is deprecated in favor of Rimraf v4+ or native Node.js `fs.rm`.
   - *Introducing Dependency:* Transitive dependency of `file-entry-cache@6.0.1` inside `eslint@8.57.1`.

3. **`rimraf@3.0.2` -> `glob@7.2.3` and `@next/eslint-plugin-next` -> `glob@10.3.10`:**
   - *Reason for Deprecation:* Versions of glob prior to v11 are deprecated by upstream maintainers.
   - *Introducing Dependency:* Transitive dependencies of `rimraf@3.0.2` and `@next/eslint-plugin-next@14.2.5`.

4. **`glob@7.2.3` -> `inflight@1.0.6`:**
   - *Reason for Deprecation:* Upstream package marked deprecated due to memory leak risks in nested callback chains.
   - *Introducing Dependency:* Transitive dependency of `glob@7.2.3`.

### Action Taken:
Running `npm audit fix --force` was **deliberately avoided** because it introduces breaking peer dependency conflicts with `eslint-config-next@14.2.5`. All four packages are restricted exclusively to development-time linting (`next lint`) and are never included in production bundles or runtime Docker containers.

---

## 7. Deployment Settings & Manual Operational Steps

When deploying to production or staging hosting platforms, verify the following configuration:

1. **Vercel Dashboard (Frontend):**
   - Navigate to: **Project Settings > General > Node.js Version**.
   - With [.nvmrc](file:///D:/be/.nvmrc) and [.node-version](file:///D:/be/.node-version) present, Vercel automatically selects **24.x**.
   - If an explicit manual override was configured in the Vercel dashboard, verify that it is set to **24.x** (not 20.x or 18.x).

2. **Render Dashboard (Fastify API Service):**
   - The API service uses the multi-stage [Dockerfile](file:///D:/be/Dockerfile).
   - Render automatically pulls `node:24-bookworm-slim` for all build and runner stages.
   - In [render.yaml](file:///D:/be/render.yaml), ensure the build command continues to use `npm ci && npx prisma generate && npm run api:build`.

3. **GitHub Actions (CI Workflows):**
   - [.github/workflows/db-backup.yml](file:///D:/be/.github/workflows/db-backup.yml) is now explicitly configured with `node-version: 24`. No further manual action required.
