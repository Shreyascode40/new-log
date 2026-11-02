# Reliability, Backup & Disaster Recovery Audit

**System:** Digital BE Project Log Book  
**Repository:** `D:\be` (`Shreyascode40/new-log`)  
**Audit date:** 2026-11-03  
**Audit type:** Read-only SRE/DBRE review, isolated restore test, storage consistency test, failure-path inspection  
**Production changes made:** None. No production rows, files, buckets, environment variables, or deployments were modified.

---

## 1. Executive summary

**Verdict: the application is not disaster-recovery ready.**

The production database is live and contains real workflow data, but the recovery chain has critical breaks:

1. The newest recovery point on disk is a manual snapshot from **2026-10-30T11:49:06.879Z**. Production has advanced roughly **3.2 days** beyond it, and no newer backup exists locally.
2. A 6-hourly GitHub Actions backup workflow exists on the `main` branch, but it is **not on the repository's default branch** (`codex/work-branch`). GitHub reports **0 registered workflows and 0 workflow runs**. The scheduled backup has never executed.
3. The checked-in backup script (`scripts/export-backup.ts`) **exits 0 when it fails**. Running the exact script against production produced `P1001` (pooler connection failure), wrote **no backup at all**, and still exited successfully. A scheduled job would appear green.
4. The checked-in restore script (`scripts/restore-json.ts`) restores only **10 of 24 exported tables**. Tested against a complete snapshot, it silently lost **155 rows across 8 workflow tables** and still reported success.
5. Restore requires a pre-existing migrated schema. Restoring into an empty database fails with Prisma `P2021`.
6. Supabase Storage has **no application-level backup, no verified versioning, and no reconciliation job**. Generated PDFs and student photos sit in a **public bucket**; unauthenticated direct object URLs return HTTP 200.
7. There are confirmed data-integrity races: concurrent joins can put one student in two groups, and a 3-member group can become a 5-member group. Both reproduced **3/3**.
8. `/health` returns **200 with the database unreachable**, so uptime checks and load balancers receive a false positive.
9. Migration failures are caught and swallowed at startup, allowing the API to run against an old schema.

The good news: a **full, sequential export of all 24 non-token tables was taken read-only and restored successfully** into an isolated schema. All counts, foreign keys, IDs, timestamps and JSON payloads matched, and the restored data was readable through application relations. The data model itself is recoverable; the operational tooling and safeguards are not.

### Severity summary

| ID | Finding | Severity |
|---|---|---|
| F-01 | No verified application backup has run since 2026-10-30; RPO is ~3.2 days and growing | Critical |
| F-02 | Scheduled backup workflow is on the wrong branch; 0 runs ever | Critical |
| F-03 | Backup script exits 0 on failure and writes no file | Critical |
| F-04 | Checked-in restore loses 155 rows across 8 populated tables and exits 0 | Critical |
| F-05 | Restore cannot bootstrap an empty database (no migrations) | Critical |
| F-06 | Public bucket exposes student photos and generated PDFs without auth | Critical |
| F-07 | No storage backup, versioning, or DB↔storage reconciliation | Critical |
| F-08 | Concurrent joins violate one-group-per-student and 4-member cap | High |
| F-09 | `/health` returns 200 while the database is down | High |
| F-10 | Migration failures are swallowed; API starts with stale schema | High |
| F-11 | Uploads and DB writes are non-atomic; deletes leave orphan files | High |
| F-12 | No retries, request timeouts, idempotency, or alerting | High |
| F-13 | PDF generation/export is non-atomic and leaves orphaned PII | High |
| F-14 | Backup artifact handling is unencrypted and lacks integrity checks | Medium |
| F-15 | Token tables are omitted from backups (undocumented) | Low |
| F-16 | PDF data route has no explicit duration budget and leaks raw errors | Low |

---

## 2. System as found

The implementation differs in several ways from a generic Next.js/Puppeteer description:

- **Web:** Next.js 14 App Router on Vercel (`apps/web`), React PDF generation in the browser.
- **API:** separate Node HTTP service (`apps/api/src/server.ts`) on Render, called by the web app through `backendApi()` with an internal bearer token.
- **Database:** Supabase PostgreSQL. Pooled URL uses port `6543` with `pgbouncer=true&connection_limit=5&pool_timeout=30`; `DIRECT_URL` uses port `5432` without pool parameters.
- **ORM:** Prisma 5.22, **26 models**, one checked-in migration (`20261012000000_init`).
- **Storage:** Supabase Storage through `apps/web/lib/upload.ts`. Local disk is the development provider; Supabase is forced in production when credentials exist.
- **PDF:** generated client-side, uploaded to `/api/groups/[groupId]/pdf`, stored in Supabase, recorded in `PdfExport` (nominally).
- **Auth:** NextAuth credentials, bcrypt, email verification/reset tokens.
- **Backups:** manual JSON export script plus a dormant GitHub Actions workflow.

### 2.1 Deployment ambiguity

The GitHub default branch is `codex/work-branch` (commit `b4365c0`). Local `main` is three commits ahead of `origin/main` (`0357782`) and contains the backup workflow; `origin/main` also contains it. The production deployment branch was not verifiable from the repository. This matters for DR because the code and workflow that operators believe are deployed may not be the code on the default branch.

---

## 3. Backup system assessment

### 3.1 Inventory

All local backups are under `D:\be\backups` and are ignored by git (`.gitignore` line 41: `/backups/`).

| File | Size | Last write (local) | Notes |
|---|---:|---|---|
| `database-backup-2026-10-30-1793356291162.json` | 86,812 B | 2026-10-30 16:01 | manual snapshot |
| `database-backup-2026-10-30-1793357022819.json` | 99,920 B | 2026-10-30 16:13 | manual snapshot |
| `database-backup-2026-10-30-1793357227257.json` | 102,867 B | 2026-10-30 16:17 | manual snapshot |
| `database-backup-2026-10-30-1793360070989.json` | 163,819 B | 2026-10-30 17:04 | manual snapshot |
| `database-backup-2026-10-30-1793360946882.json` | 173,877 B | 2026-10-30 17:19 | newest manual snapshot |
| `database-backup-latest.json` | 173,877 B | 2026-10-30 17:19 | byte-identical to the 17:19 file |

- Newest `exportedAt`: **2026-10-30T11:49:06.879Z**.
- SHA-256 of `database-backup-latest.json` equals SHA-256 of `database-backup-2026-10-30-1793360946882.json`.
- All six files are valid JSON and contain the expected `data` object.
- No checksum manifest, encryption, signature, retention policy, or restore log exists alongside them.
- They live on the same workstation as the repository. There is no offsite copy.

### 3.2 Intended automation vs reality

`.github/workflows/db-backup.yml` defines:

- schedule: `0 */6 * * *` (every 6 hours);
- manual `workflow_dispatch`;
- `npm ci`, `prisma generate`, `npm run db:backup`;
- artifact upload with 30-day retention.

But:

- The file exists on `main`, **not** on the default branch `codex/work-branch`.
- GitHub API `GET /repos/Shreyascode40/new-log/actions/workflows` returns `total_count: 0`.
- GitHub API `GET /repos/Shreyascode40/new-log/actions/runs` returns `total_count: 0`.
- The repository is **public**. If the workflow is activated as written, plaintext PII JSON artifacts would be available to users with repository read access, subject to GitHub's artifact download controls.

**Conclusion:** the backup schedule is documentation, not an operating control. The last actual backup is the manual 2026-10-30 snapshot.

### 3.3 Coverage

`export-backup.ts` exports **24 of 26 Prisma models**. Omitted:

- `EmailVerificationToken`
- `PasswordResetToken`

These are short-lived, single-use security tokens; omitting them from long-term backups is defensible, but it is undocumented and means a restore invalidates in-flight verification/reset links. More importantly, the export is **not a database dump**:

- no schema/DDL;
- no indexes, constraints, grants, extensions, or ownership;
- no sequences (the schema uses `cuid()` string IDs, so sequence reset is not an issue);
- no storage objects;
- no `PdfExport` files;
- no migration history.

Restore therefore depends on `prisma migrate deploy` (or `db execute`) recreating the schema first.

### 3.4 Consistency

The 24 `findMany()` calls run in a single `Promise.all` **outside a transaction**. Under PostgreSQL `READ COMMITTED`, each statement can see a different snapshot. A write committed between two queries can produce a torn backup (e.g. a `GroupMember` row referencing a `User` row that is not in the same export, or a review score whose parent form is from a later state). No consistency check is performed after export.

### 3.5 Failure detection

`scripts/export-backup.ts` ends with:

```ts
main().catch(console.error).finally(() => prisma.$disconnect());
```

There is no `process.exitCode = 1`. The rejection is handled, so Node exits **0**.

Exact test (T-03): running the checked-in script against production, from a temporary working directory, produced a Prisma `P1001` at `activityEntryHistory.findMany()` and **no `backups/` directory**, yet the process exited **0**. The workflow's `upload-artifact` step would then find no files; its default `if-no-files-found` is `warn`, so the job would still be green.

A second, separate test with an unreachable database host also exited 0.

### 3.6 Backup performance/fragility

The configured `DIRECT_URL` has no `connection_limit`. The script issues 24 `findMany()` queries concurrently. Two consecutive runs of the same parallel pattern failed with `P1001` at different tables (`User`, then `ActivityEntry`); a **sequential** export of the same 24 tables succeeded. This is consistent with exhausting the Supabase pooler's session-mode connection cap. The failure is not retried.

This is a realistic explanation for why manual backups stop at 2026-10-30: the script can fail silently and leave no trace.

### 3.7 Access control and confidentiality

- Backups contain names, emails, roll numbers, mobile numbers, exam seat numbers, photos URLs, marks, reviewer remarks, audit logs, and internal tokens (not the token tables, but references in audit data).
- Files are unencrypted JSON on local disk.
- No backup-specific IAM, encryption key, or access log exists.
- The GitHub repository is public; the workflow artifact path would expose backups if activated without encryption or a private repository.
- No `.env` file was found in git history (`git log --all -- .env` empty); secrets are not committed.

---

## 4. Restore and disaster-recovery test

### 4.1 Constraints and method

No separate PostgreSQL server, Docker, `psql`, or `pg_dump` is available in this environment. A true separate-database restore was therefore not possible. Instead:

- Created an isolated **schema** in the configured Supabase test instance (`TEST_DIRECT_URL`), not in production.
- Applied the checked-in init migration to that schema.
- Restored the backup inside one Prisma transaction.
- Ran count, foreign-key, uniqueness, cap, ID, timestamp and JSON checks.
- Read the restored data through Prisma relations matching application queries.
- Dropped the audit schemas afterwards.

This validates logical data recoverability, not production network isolation, IAM, extensions, or Supabase-native restore.

### 4.2 Test A — existing latest backup (stale)

Backup: `database-backup-latest.json` (`2026-10-30T11:49:06.879Z`).

| Check | Result |
|---|---|
| Tables restored | 24/24 |
| Row counts | all matched |
| Restore time | **5.4 s** |
| FK/relationship/cap/uniqueness checks | **31/31 passed, 0 violations** |
| IDs preserved (users, groups, members, schedule, questions, audit) | yes |
| `User.createdAt/updatedAt` preserved | yes, 0 mismatches |
| `AuditLog.timestamp` preserved | yes, 0 mismatches |
| `Checklist.items` JSON preserved | yes, 0 mismatches |
| `AuditLog.before/after` parseable | yes, 0 failures |
| Application read | group `cmvusb7wc00ltmbtgsgr8mkwc` loaded; completion engine returned 6%, 17 sections |

**Limitation:** this snapshot has **zero rows** in topics, activities, reviews, review scores, marks sheets, examiner feedback, competitions, papers, sponsored sections, PDF exports and notifications. It proves seed/master-data restore, not workflow-data restore.

### 4.3 Test B — fresh full snapshot (read-only export)

To test the real current workload, a **read-only sequential export** of all 24 tables was taken from production on 2026-11-03. This export was not promoted to `database-backup-latest.json` and was deleted after the test.

Production counts at export time:

`76 users, 16 groups, 61 members, 2 topics, 53 activity entries, 7 review forms, 80 review scores, 8 marks sheets, 2 examiner feedbacks, 4 checklists, 2 competitions, 1 paper, 4 content pages, 157 audit logs`.

Restore result into an isolated, freshly migrated schema:

| Check | Result |
|---|---|
| Tables restored | **24/24** |
| Row counts | **24/24 matched** |
| Restore time | **11.17 s** |
| FK checks | **28/28 passed, 0 orphans** |
| One group per student | passed |
| Max 4 members per group | passed |
| One topic per `(groupId, topicNo)` | passed |
| IDs preserved (users, groups, members, questions, schedule, audit) | passed |
| `User.createdAt/updatedAt` | passed |
| `AuditLog.timestamp` | passed |
| `Checklist.items` JSON | 4/4 parseable |
| `AuditLog.before/after` JSON | 157 rows parseable |
| `MarksSheet.components` JSON | 8/8 parseable |
| `ExaminerFeedback.answers` JSON | 2/2 parseable |
| Application relation read | passed |

The richest restored group (`DEMO-01`) read back as:

```json
{
  "groupNo": "DEMO-01",
  "guide": "Prof. Demo Guide",
  "members": 4,
  "topics": 2,
  "activityEntries": 53,
  "reviewForms": 7,
  "reviewScores": 80,
  "marksSheets": 8,
  "examinerFeedbacks": 2,
  "checklists": 2,
  "competitions": 2,
  "papers": 1
}
```

**What this proves:** the export format can represent and restore the full current workflow dataset, preserving relationships and application-readable JSON.  
**What it does not prove:** that the *checked-in* backup/restore scripts do this operationally, that storage can be recovered, or that a separate production database can be provisioned and cut over.

### 4.4 Test C — checked-in restore script against a full snapshot

`scripts/restore-json.ts` was copied with only its hard-coded path parameterized; its 10-table body was otherwise unchanged. It was run against an empty, migrated schema using the full snapshot.

Result:

- exit code **0**;
- “Restore transaction completed.”;
- **10/24 tables restored**;
- **155 rows lost across 8 tables**:

| Table | In backup | Restored |
|---|---:|---:|
| `TopicProposal` | 2 | 0 |
| `ActivityEntry` | 53 | 0 |
| `ReviewForm` | 7 | 0 |
| `ReviewScore` | 80 | 0 |
| `MarksSheet` | 8 | 0 |
| `ExaminerFeedback` | 2 | 0 |
| `Competition` | 2 | 0 |
| `PaperPublication` | 1 | 0 |

The script’s “destination is empty” guard checks only those 10 tables. If the other 14 contain data, it does not notice and proceeds. It also hard-codes `D:/be/backups/database-backup-latest.json` and does not run migrations.

### 4.5 Test D — restore into an empty schema

Restoring into a schema with no tables failed with Prisma **`P2021`** (“table does not exist”). The restore path therefore depends on the operator applying migrations first. The checked-in restore script does not do this. This is a recovery dependency, not a bug in the data format, but it is undocumented and untested in the repository.

### 4.6 Restore verdict

- **Data format:** recoverable. Full snapshot restored with 100% counts and referential integrity.
- **Operational restore tooling:** not recoverable. The checked-in restore loses workflow tables and cannot bootstrap a schema.
- **Measured data restore time:** 5.4 s (stale) / 11.17 s (full) into a pre-migrated isolated schema. This is only the `createMany` transaction, not end-to-end RTO.

---

## 5. Data freshness and RPO

### 5.1 Production vs latest backup

| Table | Production (2026-11-03) | Latest backup (2026-10-30) | Gap |
|---|---:|---:|---:|
| User | 76 | 68 | +8 |
| Group | 16 | 14 | +2 |
| GroupMember | 61 | 55 | +6 |
| GroupInvite | 0 | 0 | 0 |
| TopicProposal | 2 | 0 | +2 |
| ScheduleItem | 15 | 15 | 0 |
| ActivityTemplate | 53 | 53 | 0 |
| ActivityEntry | 53 | 0 | +53 |
| ActivityEntryHistory | 0 | 0 | 0 |
| ReviewTemplate | 7 | 7 | 0 |
| ReviewQuestion | 80 | 80 | 0 |
| ReviewForm | 7 | 0 | +7 |
| ReviewScore | 80 | 0 | +80 |
| MarksSheet | 8 | 0 | +8 |
| ExaminerFeedback | 2 | 0 | +2 |
| Checklist | 4 | 2 | +2 |
| Competition | 2 | 0 | +2 |
| PaperPublication | 1 | 0 | +1 |
| SponsoredMeeting | 0 | 0 | 0 |
| SponsorFeedback | 0 | 0 | 0 |
| ContentPage | 4 | 1 | +3 |
| PdfExport | 0 | 0 | 0 |
| AuditLog | 157 | 150 | +7 |
| Notification | 0 | 0 | 0 |

Latest production write observed: `AuditLog.timestamp = 2026-11-02T15:48:37.698Z`.  
Latest backup: `2026-10-30T11:49:06.879Z`.  
**Observed data gap: 3 days 3 h 59 m (≈3.17 days), and growing.**

### 5.2 RPO assessment

| Scenario | RPO |
|---|---|
| Current actual (no new backup) | **~3.2 days and unbounded** until a manual backup succeeds |
| Intended 6-hour cron | ≤6 h, but **0 runs**; not an operating control |
| If Supabase daily backups are enabled | up to 24 h; **not verifiable** from this environment |
| If Supabase PITR is enabled | seconds/minutes; **not verifiable**, plan-dependent |
| Supabase Storage objects | **no recovery point**; no backup/versioning verified |

Do not represent any Supabase-native backup or PITR as available until it is verified in the Supabase dashboard and a restore has been performed into a separate project.

### 5.3 RTO assessment

Measured data restore alone: **5.4–11.2 s** for the current dataset into a pre-migrated schema.

End-to-end recovery includes detection, decision, provisioning, migration, data restore, storage restore, environment/secret changes, API/web redeploy, smoke tests, and communication. None of that is automated or rehearsed.

| Scenario | Planning estimate |
|---|---|
| Database-only restore with an existing runbook and pre-provisioned target | **2–6 hours** |
| Full recovery including storage, redeploy and verification | **1–2 days currently**, with incomplete fidelity because storage has no backup |
| Detection time | unknown; no alerting on backup/DB/storage failures |

These are planning estimates, not measured guarantees. The current tooling cannot achieve a full-fidelity restore.

---

## 6. Supabase Storage recovery

### 6.1 Bucket inventory

| Bucket | Public | Objects | Bytes | Notes |
|---|---|---:|---:|---|
| `logbook-uploads` | **yes** | 23 | 53,786,010 | photos, certificates, papers, content files, generated PDFs |
| `logbook-private-uploads` | no | 2 | 55,530 | two unreferenced photos |
| `logbook-pdfs` | no | 0 | 0 | configured name but unused |

### 6.2 Public exposure

A direct Supabase public-object URL for a generated PDF and for student photos returned **HTTP 200 without an `Authorization` header**. The private bucket object requested through a public URL returned **400**. This confirms that `logbook-uploads` is genuinely public and bypasses the application's `/media` authorization route.

`apps/web/lib/upload.ts` selects buckets as follows:

- private uploads: `SUPABASE_PRIVATE_BUCKET || SUPABASE_BUCKET`;
- generated PDFs: `SUPABASE_PDF_BUCKET || SUPABASE_PRIVATE_BUCKET || SUPABASE_BUCKET`.

The inspected `.env` configuration has `SUPABASE_BUCKET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, but **no `SUPABASE_PRIVATE_BUCKET` and no `SUPABASE_PDF_BUCKET`**. The fallback therefore writes private uploads and generated PDFs to the public `SUPABASE_BUCKET`. This is consistent with the observed public bucket contents.

The working-tree `/media/[...path]` route calls the backend authorizer before reading a file. That protection is bypassed by direct bucket URLs, and production deployment of this uncommitted route change was not verified. It also only covers `/media` references; `/api/files` references use a different path.

### 6.3 Database references

- 9 DB references, 8 unique paths, all `/media/...`.
- All 9 resolved to existing local files and existing public-bucket objects.
- **0 missing references** at audit time.

This is a point-in-time result. There is no scheduled reconciliation, so missing files can appear silently after a storage change, bucket migration, or manual deletion.

### 6.4 Orphans

- The automated scan flagged **25 storage objects** as unreferenced candidates; it also counted **8 PDF objects** in storage.
- `PdfExport` has **0 rows**, while the bucket contains generated logbook PDFs (at least six, ~42 MB, including two `DEMO-01` files at 7.0 MB each and `COMP-BE-2025-01` at 6.9 MB).
- **13 local files** under `var/uploads` are unreferenced.
- Causes observed in code:
  - uploads happen **before** the DB write (`group-info.ts`, `records.ts`);
  - a failed DB write leaves the uploaded object;
  - replaced photos/documents are not deleted;
  - deleted competition/paper rows do not delete their storage objects;
  - each PDF generation uses a new timestamped object; old versions are not cleaned up;
  - `PdfExport` creation is a 15-second check-then-insert with no unique constraint.

Orphaned PDFs and photos are not just storage cost: they are **unreferenced PII** that survives deletion of the DB row.

### 6.5 Storage recovery verdict

There is no storage backup, no verified object versioning, no restore procedure, and no reconciliation job. A database restore would restore references to objects that may no longer exist. A storage loss would leave dangling DB references. The two migration scripts (`migrate-uploads-to-private.ts`, `sync-local-uploads.ts`) are manual and not a recovery mechanism; the former only handles absolute public URLs, not the `/media/...` references currently in production.

---

## 7. Failure-scenario assessment

| Scenario | Current behavior / evidence | Data impact | Recovery | RPO / RTO |
|---|---|---|---|---|
| **Database unreachable** | `/health` still 200; `/v1/schedule` returns 500 `{"error":"Internal server error."}` after ~2.0 s; no retry | No new writes; reads fail | Wait/restart; no failover | RPO 0 if durable; RTO minutes–hours; detection unreliable |
| **Database corruption / bad migration** | One init migration; no verified PITR; latest logical backup 3.2 days old | Up to 3.2+ days lost; possibly more | Restore backup; manually replay | RPO 3.2+ days; RTO 1–2 days |
| **Accidental DELETE/UPDATE** | Audit log exists (157 rows) but no undo; no PITR verified | Deleted rows lost since backup | Restore + manual reconstruction from audit | RPO 3.2+ days |
| **Loss of Supabase project/region** | No offsite DB backup; no storage backup | Catastrophic | None proven | Undefined |
| **Storage object deletion** | No versioning/backup verified; DB refs dangle | Photos/PDFs/certificates lost | None proven | Storage RPO = no recovery point |
| **Credential compromise** | Service-role key and DB credentials in env; public bucket; unencrypted local backups | Data exfiltration/deletion | Rotate keys, restore | Undefined; no immutable backup |
| **Bad application deploy** | `migrate-deploy.js` catches migration errors and continues startup | API may run against old schema | Redeploy/forward-fix | RTO minutes–hours; risk of inconsistent writes |
| **Vercel/Render outage** | Single-region managed services; no failover | App unavailable | Wait for provider | RTO provider-dependent |
| **PDF generation failure** | Client generation + server upload; in-memory lock; 15 s dedupe; orphan cleanup only on caught failure | Orphan objects; no PdfExport row | Retry; manual cleanup | RTO minutes; storage leak |
| **Email provider outage** | Verification/reset depend on email; no queue/retry audited | New users/resets blocked | Retry later | RTO provider-dependent |
| **Disk full (local dev)** | Local uploads fail; production uses Supabase | Local only | Clean disk | Low |
| **Time/clock skew** | Timestamps stored as `DateTime`; no evidence of issue | None observed | — | — |

---

## 8. Transactions, concurrency, retries and idempotency

### 8.1 Confirmed race: one student in two groups

`assertCanJoin()` in `apps/api/src/modules/groups.ts` performs:

1. `membershipOf(userId)` — check outside a transaction;
2. group count check outside a transaction;
3. `groupMember.create()` inside a transaction.

Two concurrent join requests both pass step 1. The schema has `@@unique([groupId, userId])` but **no unique constraint on `userId` alone**, so both inserts succeed in different groups.

Reproduced **3/3** in the isolated schema: one student ended with two memberships.

Impact: violates “a student belongs to at most one group”; corrupts completion/eligibility; may allow one student to appear in two PDFs.

### 8.2 Confirmed race: 5-member group

The 4-member cap is enforced only by `group._count.members >= MAX_GROUP_MEMBERS` before the insert. There is no DB constraint or lock. Concurrent joins can exceed the cap.

Reproduced **3/3**: a 3-member group became 5 members.

Impact: violates the non-negotiable 4-student rule; affects marks sheets, PDF membership, and eligibility.

### 8.3 Upload/DB non-atomicity

- `group-info.ts`: photo upload happens before the member DB update; no cleanup if the DB write fails.
- `records.ts`: certificate/paper/content upload happens before the DB write; deletes remove the row but not the object.
- `saveGeneratedPdf()` uploads first; `recordPdfExport()` is a separate call. The route attempts rollback on caught errors, but a process crash or timeout leaves the object.
- No outbox, two-phase commit, or reconciliation job exists.

### 8.4 PDF export dedupe

`recordPdfExport()` checks for an export created within the last 15 seconds and then inserts. This is a check-then-act sequence with no unique constraint. Concurrent requests can both pass. The upload route's in-memory `Map` lock is per process, so multiple Vercel instances do not coordinate. Current `PdfExport` count is 0, so this is a latent risk rather than an observed production duplicate.

### 8.5 Retries and timeouts

- `backendApi()` calls `fetch()` with no `AbortSignal`/timeout and no retry. A hung Render request can hold a Vercel function until the platform timeout.
- PDF data route first calls a consolidated bundle endpoint; if it fails, it silently falls back to ~16 individual service calls. There is no explicit `maxDuration` on that route (the upload route has `maxDuration = 300`).
- API server has no request timeout and returns a generic 500; no retry/backoff.
- Rate limiting falls back to an in-memory `Map` when Upstash is not configured. On multiple instances, limits are per instance. Production Upstash configuration was not verified.

### 8.6 Audit-log transactionality

Most write modules create the `AuditLog` inside the same Prisma transaction as the domain write (e.g. `groups.ts`, `activity-chart.ts`, `review.ts`, `evaluation.ts`). This is good. The confirmed integrity failures are the pre-transaction checks, not the audit writes.

---

## 9. Observability and failure reporting

| Signal | Current state | Risk |
|---|---|---|
| `/health` | Always 200 `{status:"ok"}`; no DB/storage check | False positive; no failover/alert |
| API 500s | Generic `{"error":"Internal server error."}`; console log | Hard to diagnose; no correlation ID |
| Backup success | Exit 0 even on failure; no artifact if no file | Silent backup loss |
| Migration success | Failure logged as warning; startup continues | Schema drift |
| Storage errors | Thrown to caller; no metric/alert | Orphans and broken refs unnoticed |
| PDF failures | 500/rollback attempts; console logs | No alert; orphan PII |
| Error tracking | No Sentry/Datadog/structured logger found | No aggregation or alerting |
| Uptime/synthetic checks | Not configured in repo | Outage detection depends on users |

No alerting exists for: backup failure, backup age, DB unreachable, migration failure, storage object missing, PDF generation failure, or orphan growth.

---

## 10. Security factors that affect recovery

These are not a full security audit, but they directly affect DR:

1. **Public bucket:** student photos and generated PDFs are retrievable without authentication. This is a PII breach risk and means “access control” cannot be relied on during recovery.
2. **Unencrypted backups:** local JSON and GitHub artifacts (if activated) contain PII in plaintext.
3. **Public repository:** source and infrastructure details are public. No `.env` was found in git history, but the workflow artifact design is unsafe for PII.
4. **Service-role key:** present in server env; compromise allows full storage access. No rotation/escrow procedure was found.
5. **No immutable backups:** an attacker or accidental delete can remove the only local backups.
6. **Audit logs:** included in backups and generally written transactionally, but no append-only/immutability control was verified.

---

## 11. Exact test log

Temporary audit scripts were kept under `scripts/_audit-temp/` and `scripts/_audit-fresh/` and were removed after the audit. The production backups were not modified.

| ID | Test | Method | Result |
|---|---|---|---|
| T-01 | Backup inventory | List `backups/`, parse JSON, SHA-256 | 6 files; latest byte-identical to 17:19 file; newest `exportedAt` 2026-10-30T11:49:06.879Z |
| T-02 | Backup workflow status | GitHub API workflows/runs; branch tree | 0 workflows, 0 runs; workflow on `main`, not default `codex/work-branch` |
| T-03 | Exact backup script against production | Run `scripts/export-backup.ts` from temp cwd with production env | Exit **0**, `P1001`, **no backup directory** |
| T-04 | Sequential full export | 24 `findMany()` calls sequentially | Success; all 24 counts matched production |
| T-05 | Full restore into isolated schema | Apply init migration; one transaction; 24 tables | 24/24 counts; 11.17 s; 28/28 FK checks; IDs/timestamps/JSON preserved; DEMO-01 readable |
| T-06 | Existing latest backup restore | Same, using 2026-10-30 snapshot | 24/24 counts; 5.4 s; 31/31 relationship/integrity checks; app read 6%, 17 sections |
| T-07 | Checked-in restore with full snapshot | Copy `restore-json.ts`, parameterize path only | Exit 0; 10/24 tables; **155 rows lost** across 8 tables |
| T-08 | Restore into empty schema | No migration, then restore | `P2021`; restore depends on migrations |
| T-09 | Backup failure exit code | Unreachable DB host | Exit **0** |
| T-10 | API with DB down | `/health`, `/v1/schedule` | `/health` 200; schedule 500 after ~2.0 s; no retry |
| T-11 | One-student-two-groups race | Two concurrent joins, isolated schema | **3/3** produced 2 memberships |
| T-12 | 5-member cap race | Concurrent joins on 3-member group | **3/3** produced 5 members |
| T-13 | Storage inventory/privacy | Supabase list buckets/objects | 3 buckets; `logbook-uploads` public, 23 objects/53.8 MB |
| T-14 | Unauthenticated object access | Direct public URL, no auth header | HTTP **200** for PDF/photo; private bucket via public URL 400 |
| T-15 | DB↔storage reference check | Resolve 9 refs against local + buckets | 9/9 resolved; 0 missing |
| T-16 | Orphan scan | Compare storage/local files to DB refs | 25 storage candidates; 8 PDF objects; 0 `PdfExport`; 13 local orphans |
| T-17 | Production vs backup freshness | Read-only aggregates via `DIRECT_URL` | 3.17-day gap; 8 workflow tables absent from backup |
| T-18 | Configuration inspection | `.env`, `upload.ts`, bucket list | No private/PDF bucket vars; fallback to public bucket |
| T-19 | Failure-path code review | Backup, restore, migrate, health, upload, PDF, races | Findings F-03…F-13 confirmed |

---

## 12. What was not tested / cannot be concluded

Be explicit with stakeholders: the following are **unknown**, not “passed”:

- Supabase-native daily backups, PITR, retention, and restore policy (no management API access).
- Restore into a truly separate database/project (schema isolation only; no Docker/`psql`/`pg_dump`).
- Supabase Storage backup/versioning/restore (no storage backup exists to test).
- Full UI, PDF rendering, and download from the restored database (only Prisma relation reads).
- Production failure injection, failover, and load-balancer behavior.
- Vercel/Render runtime limits, cron, and environment parity.
- Email delivery, verification/reset flows after restore.
- Large-dataset restore performance and lock behavior.
- Encryption/key management and backup access auditing.
- Cross-region recovery.
- Migration rollback (only one init migration; no rollback scripts).
- Time-to-detect and on-call response (no monitoring).
- Concurrency at scale (races reproduced 3/3, not a stress test).
- Legal/compliance retention requirements.
- Restoration of `EmailVerificationToken` / `PasswordResetToken` (omitted by design/undocumented).

Compilation, type-checking, or a green deployment does **not** prove disaster recovery. The restore tests above are the only evidence of data recoverability.

---

## 13. Prioritized remediation plan

### P0 — do before the next production change (0–7 days)

**P0-1. Make backups actually run and fail loudly.**
- Move `db-backup.yml` to the default branch, or change the default branch to the branch that contains it.
- Add `if-no-files-found: error` to `upload-artifact`.
- Make `export-backup.ts` set `process.exitCode = 1` on any failure.
- Add a post-run assertion: expected table counts > 0 where applicable, JSON parseable, `exportedAt` fresh.
- Alert on failure and on backup age > 8 hours.
- Acceptance: a forced DB outage produces a red workflow and an alert; a successful run produces an artifact with a manifest.

**P0-2. Replace the fragile export with a real backup.**
- Prefer Supabase PITR or `pg_dump`/`pg_restore` from a dedicated backup job.
- If keeping JSON export: run queries sequentially (or set `connection_limit=1–2` on `DIRECT_URL`), inside a `REPEATABLE READ` transaction, with retries and a checksum manifest.
- Store encrypted backups offsite (separate account/region), with 30-day operational + 12-month archival retention.
- Acceptance: three consecutive scheduled runs succeed; a restore from the offsite copy passes the verification suite.

**P0-3. Build a complete restore tool.**
- Restore all 24 exported tables (and decide explicitly about the 2 token tables).
- Apply migrations first; fail if the target is not empty unless `--force` is passed.
- Restore in FK order inside one transaction.
- Verify counts, FKs, uniqueness, caps, IDs, timestamps, and JSON.
- Remove the hard-coded `D:/be/...` path; require `--file` and `--target`.
- Refuse production targets unless an explicit `--confirm-production` flag and maintenance window are set.
- Acceptance: restore the full snapshot into an empty database and pass all checks; restore into a non-empty target is refused.

**P0-4. Close the public bucket.**
- Create private buckets for uploads and PDFs; set `SUPABASE_PRIVATE_BUCKET` and `SUPABASE_PDF_BUCKET`.
- Migrate existing objects and rewrite DB references; verify every reference.
- Make `logbook-uploads` private (or delete it after migration).
- Block public object URLs; serve through authorized routes only.
- Acceptance: unauthenticated direct URLs return 400/403; all 9 existing refs still resolve for authorized users.

**P0-5. Fix the join/cap races.**
- Add a DB unique constraint on `GroupMember.userId` (one group per student).
- Enforce the 4-member cap with a serializable transaction or `SELECT ... FOR UPDATE` on the group row, plus a DB trigger/constraint if possible.
- Add concurrency tests to CI.
- Acceptance: 20 concurrent joins never create a second membership or a 5th member.

**P0-6. Fix health and migration failure behavior.**
- `/health` (liveness) can stay process-only; add `/ready` that runs `SELECT 1` and checks storage.
- Point the platform health check at `/ready`.
- Make `migrate-deploy.js` exit non-zero on migration failure; allow an explicit `ALLOW_MIGRATION_FAILURE=1` only for emergency.
- Acceptance: DB down → `/ready` non-2xx; failed migration → deploy fails and alerts.

### P1 — 1–4 weeks

**P1-1. Make uploads and DB writes atomic.**
- Write an intent/outbox row first, upload, then commit; or upload to a staging path and promote after DB commit.
- Delete the object when the DB row is deleted or replaced.
- Add a reconciliation job that reports missing refs and unreferenced objects.

**P1-2. Add timeouts, retries, and idempotency.**
- `backendApi()`: 10–15 s timeout, bounded retries with jitter for idempotent GETs, circuit breaker.
- Create/upload endpoints: idempotency keys or unique constraints.
- PDF data route: explicit `maxDuration`, bundle-first with a hard fallback budget.
- Require Upstash in production; do not silently fall back to per-instance memory.

**P1-3. Make PDF export atomic.**
- Add a unique constraint or transactional dedupe key for `PdfExport`.
- Use a distributed lock, not an in-memory `Map`.
- Clean up old PDF versions and orphaned objects.
- Do not return raw `error.message` to clients on 500.

**P1-4. Add observability.**
- Structured JSON logs with request IDs; Sentry or equivalent.
- Alerts: backup age/failure, `/ready` failure, migration failure, 5xx rate, storage 4xx/5xx, PDF failure, orphan growth.
- Dashboard for RPO (last backup age), RTO drills, storage object count/bytes.

**P1-5. Backup access and integrity.**
- Encrypt backups; restrict access; log downloads.
- Add SHA-256 manifest and periodic restore verification.
- If the repository remains public, never upload plaintext PII artifacts.

### P2 — 1–3 months

- Write and rehearse a full DR runbook with roles, contact tree, decision tree, and RTO/RPO targets.
- Run a quarterly restore drill into a separate project, including storage.
- Add immutable/object-lock backups and a separate backup account.
- Separate production/test Supabase projects; do not use the production project for audit schemas.
- Define retention/legal requirements for student PII.
- Load-test restore and concurrent joins.
- Add migration rollback/expand-contract strategy; back up before every migration.
- Add chaos tests for DB/storage/API outages.

---

## 14. Proposed recovery runbook (after P0 fixes)

1. **Declare incident and freeze writes.** Put the app in maintenance/read-only mode; preserve logs and evidence; do not delete buckets or backups.
2. **Identify recovery point.** Use PITR if verified; otherwise the newest verified backup and its manifest.
3. **Provision target.** Create a new Supabase project/database; do not restore over production.
4. **Apply schema.** Run `npx prisma migrate deploy` against the target; confirm migration history.
5. **Restore data.** Run the fixed restore tool with `--file <backup> --target <url>`; require the verification suite to pass.
6. **Restore storage.** Copy objects from the storage backup/versioned bucket into the private buckets; run the reference reconciliation; confirm 0 missing refs.
7. **Cut over.** Update `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*` in Render/Vercel; deploy API first, then web; rotate credentials if compromise is suspected.
8. **Smoke test.** Sign in; load a group; verify topics/activities/reviews/marks; check completion; generate and download a PDF; verify audit log write.
9. **Communicate and monitor.** Notify users; watch error rate, `/ready`, backup age, storage errors.
10. **Postmortem.** Record actual RPO/RTO, data loss, and follow-up actions.

---

## 15. Appendix — backup coverage matrix

| Prisma model | Exported by `export-backup.ts` | Latest backup rows | Production rows (2026-11-03) |
|---|---|---:|---:|
| `User` | yes | 68 | 76 |
| `EmailVerificationToken` | **no** | — | not counted |
| `PasswordResetToken` | **no** | — | not counted |
| `Group` | yes | 14 | 16 |
| `GroupMember` | yes | 55 | 61 |
| `GroupInvite` | yes | 0 | 0 |
| `TopicProposal` | yes | 0 | 2 |
| `ScheduleItem` | yes | 15 | 15 |
| `ActivityTemplate` | yes | 53 | 53 |
| `ActivityEntry` | yes | 0 | 53 |
| `ActivityEntryHistory` | yes | 0 | 0 |
| `ReviewTemplate` | yes | 7 | 7 |
| `ReviewQuestion` | yes | 80 | 80 |
| `ReviewForm` | yes | 0 | 7 |
| `ReviewScore` | yes | 0 | 80 |
| `MarksSheet` | yes | 0 | 8 |
| `ExaminerFeedback` | yes | 0 | 2 |
| `Checklist` | yes | 2 | 4 |
| `Competition` | yes | 0 | 2 |
| `PaperPublication` | yes | 0 | 1 |
| `SponsoredMeeting` | yes | 0 | 0 |
| `SponsorFeedback` | yes | 0 | 0 |
| `ContentPage` | yes | 1 | 4 |
| `PdfExport` | yes | 0 | 0 |
| `AuditLog` | yes | 150 | 157 |
| `Notification` | yes | 0 | 0 |

---

## 16. Appendix — files inspected

Backup/restore and operations:

- `scripts/export-backup.ts`
- `scripts/restore-json.ts`
- `scripts/migrate-deploy.js`
- `scripts/migrate-uploads-to-private.ts`
- `scripts/sync-local-uploads.ts`
- `.github/workflows/db-backup.yml`
- `backups/*.json`
- `prisma/schema.prisma`
- `prisma/migrations/20261012000000_init/migration.sql`
- `.env`, `.env.test.local` (configuration only; secrets not reproduced)
- `.gitignore`

Application and failure paths:

- `apps/api/src/server.ts`
- `apps/api/src/modules/groups.ts`
- `apps/api/src/modules/group-info.ts`
- `apps/api/src/modules/records.ts`
- `apps/api/src/modules/pdf.ts`
- `apps/api/src/modules/signoff.ts`
- `apps/api/src/modules/sponsored.ts`
- `apps/web/lib/upload.ts`
- `apps/web/lib/backend-api.ts`
- `apps/web/lib/rate-limit.ts`
- `apps/web/lib/completion/index.ts`
- `apps/web/app/api/groups/[groupId]/pdf/route.ts`
- `apps/web/app/api/groups/[groupId]/pdf/data/route.ts`
- `apps/web/app/media/[...path]/route.ts`
- `apps/web/next.config.mjs`

---

## 17. Appendix — reproduction snippets

Run these only against a disposable schema or a separate project, never production.

**Foreign-key orphan check pattern** (repeated for every FK):

```sql
SELECT COUNT(*)::int AS orphans
FROM "GroupMember" c
LEFT JOIN "Group" p ON c."groupId" = p.id
WHERE c."groupId" IS NOT NULL AND p.id IS NULL;
```

**Integrity checks:**

```sql
-- one group per student
SELECT "userId", COUNT(*) FROM "GroupMember" GROUP BY "userId" HAVING COUNT(*) > 1;

-- max 4 members
SELECT "groupId", COUNT(*) FROM "GroupMember" GROUP BY "groupId" HAVING COUNT(*) > 4;

-- one topic per number
SELECT "groupId", "topicNo", COUNT(*) FROM "TopicProposal"
GROUP BY "groupId", "topicNo" HAVING COUNT(*) > 1;
```

**Restore order used in the successful full restore:**

`User → Group → GroupMember → GroupInvite → TopicProposal → ScheduleItem → ActivityTemplate → ActivityEntry → ActivityEntryHistory → ReviewTemplate → ReviewQuestion → ReviewForm → ReviewScore → MarksSheet → ExaminerFeedback → Checklist → Competition → PaperPublication → SponsoredMeeting → SponsorFeedback → ContentPage → PdfExport → AuditLog → Notification`

**Schema bootstrap:** apply `prisma/migrations/20261012000000_init/migration.sql` (or `npx prisma migrate deploy`) before restoring. The checked-in restore script does not do this.

---

## 18. Audit cleanup and statement

- All audit schemas (`reliability_audit_20261103`, `reliability_audit_repo_restore_20261103`, `reliability_audit_empty_20261103`, `reliability_audit_fresh_20261103`, `reliability_audit_repo_fresh_20261103`) were dropped.
- All temporary audit scripts and temporary exports were removed.
- No production rows, files, buckets, backups, or environment variables were modified.
- This audit added only this report; pre-existing uncommitted changes in the working tree were not modified.

**Bottom line:** the application can restore its data when a complete snapshot exists and the schema is pre-created, but the current operational backup chain is stale, silent on failure, incomplete on restore, and has no storage recovery. Treat the system as **not DR-ready** until P0-1 through P0-6 are completed and a full restore drill, including storage, passes.
