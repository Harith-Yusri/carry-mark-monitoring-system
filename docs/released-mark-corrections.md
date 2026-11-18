# Student mark issues and lecturer corrections

The workflow is **Student reports issue → Lecturer reviews → Reject OR Correct Mark → Student sees outcome**. Admin has no individual correction action, queue or badge.

1. Student opens **Report a mark issue**, selects the exact assessment/class, submits an explanation, and follows **My reports**.
2. Lecturer opens **Subject Hub → Mark Issues** and checks the reported student/assessment and current score.
3. **Reject** requires a response of 1–2000 characters. It closes the issue as rejected, records lecturer identity/time and an event/audit log, and leaves the published mark unchanged. The student can read the response. Rejecting an existing private draft cancels that draft too.
4. **Correct Mark** requires a correction reason of 1–2000 characters and a different finite score from zero to the assessment maximum, with at most two decimal places. It stages only the reported cell privately. The student continues to see the previous released score, total and eligibility.
5. **Release Updated Mark** is a separate, explicit action. It atomically updates the exact cell, closes the issue as corrected (stored as `resolved` plus a `released` correction), publishes the lecturer's correction reason as the response, and creates the existing `marks_released` notification. Existing carry-total and Final Assessment eligibility calculations see the new published score.

The visible states are Submitted, Awaiting updated mark release, Rejected, and Corrected. Historical resolved reports without a released correction display Closed. Reviewing, Resolve and Request Mark Correction are not lecturer actions.

## Enforcement and history

- Migration: `supabase/migrations/202611180001_lecturer_mark_issue_outcomes.sql`.
- `respond_to_mark_issue` accepts only rejection. `stage_mark_issue_correction` derives every academic reference from the reported issue; callers supply no alternative student, enrolment or assessment. `release_corrected_mark` accepts the stored correction ID.
- All actors come from `auth.uid()`. Writes require an active owning lecturer and current active semester. Students, Admin and other lecturers cannot reject, stage or release an issue correction.
- Released classes remain finalised with their original release ID. No whole-class reopening or ordinary mark-grid unlocking occurs. No new table-write grant or permissive RLS policy is added.
- Original mark score/version, class release ID and academic context are checked under locks. An exact, transaction-scoped private permit is consumed by `validate_mark` for the one published UPDATE. The trigger remains SECURITY INVOKER and owner execution remains `postgres`; do not independently change that arrangement.
- Drafts, internal notes and correction tables are private. Student workspace responses omit draft scores/reasons and historical Admin notes. The correction reason becomes student-visible on release.
- Events and audit logs preserve old/new score, lecturer identity, reason and timestamps. Issue-only rejection events also appear in lecturer history. API users cannot edit/delete these records.
- Matching staging retries return the same draft without another event. A changed retry cannot overwrite an awaiting-release draft. Release retries by the owning lecturer do not create duplicate notifications.
- Request, offering, issue, submission and mark locks serialize competing actions. A stale score/version/release, archived term or reassigned/inactive lecturer prevents release. A lecturer can reject an abandoned/stale draft with a response.

## Existing issues and approvals

No report, correction or audit history is deleted. Historical pending/approved requests can be staged by the assigned lecturer without an Admin decision; their prior review fields/events are retained. Existing corrected drafts can be explicitly released or rejected. Historical `reviewing` reports are treated as open Submitted reports. Historical rejected correction requests do not imply rejection of a still-open student report.

The old request/review/approved-save/queue/count RPC signatures are retained as retired error stubs, with EXECUTE revoked from public, anon and authenticated. Stale staff clients must refresh; they cannot continue the old approval process. New clients must use `stage_mark_issue_correction`.

Ambiguous legacy student/class/assessment links remain visible but cannot be corrected until the original links are established. Guessing a replacement cell is never allowed.

## Validation and rollout

- `node --test tests/*.test.mjs`
- `npm run build`
- In `student-mobile-expo`: `npm run typecheck` and `npm run lint`.
- `supabase/tests/released_mark_corrections.sql` after all migrations, including the new migration. This uses a rolled-back fixture transaction to check roles/ownership, required reasons, retired actions, validation, private drafts, legacy requests, direct-write denial, exact-cell release, stale context, archived terms, audit and notification deduplication. The existing formula moves carry from 33 to 41 across a threshold of 40.
- `scripts/check-mark-issue-outcomes.cjs` checks Reject and Correct Mark → Release Updated Mark in the compiled staff UI using an intercepted synthetic backend. Shared loading/performance browser checks cover the absence of Admin correction navigation and reads.

For release, apply the reviewed new migration before publishing staff assets and a compatible student update. The database status mapping remains compatible with older student clients, although their old labels may differ until updated. This change does not deploy an Edge Function or modify notification delivery preferences. Physical-device notification delivery remains a manual acceptance check.

Implementation verification on 18 November 2026: candidate migration and correction regression passed together inside a rolled-back transaction against the linked database; the production migration was not applied. The correction suite, student mark-release suite and shared assessment-structure suite each passed with the candidate migration in separate rolled-back transactions. Staff build, 84 Node tests, 10 loading browser scenarios, both outcome browser paths and the performance fixture passed; Expo typecheck/lint passed. Browser checks use intercepted synthetic data; notification delivery was not tested on a physical device. Web typecheck retains four pre-existing `C.accent` errors in staff login/register screens.
