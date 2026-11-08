# Released mark corrections

Released classes stay Released and locked. A correction never calls `reopen_section`.

1. Student opens **Report a mark issue**, selects the exact assessment/class, submits an explanation, and follows **My reports**.
2. Lecturer opens **Subject Hub → Mark Issues**. A response is required for Reviewing, Resolve, or Reject. These actions do not change marks.
3. If a Released mark is wrong, the lecturer enters a reason and selects **Request Mark Correction**.
4. Admin opens **Mark Corrections** and confirms Approve or Reject. Approval does not update the mark. Admin can revoke an unused approval, with a note, if circumstances change.
5. The owning lecturer can enter a corrected score only in that approved request. **Save Correction** consumes the approval and stages a private draft; the student still sees the previous Released score.
6. **Release Updated Mark** atomically replaces that cell, resolves the report, records history and creates one existing `marks_released` notification. The class release ID/status and other marks are untouched.

## Enforcement

- No new mark-table UPDATE grant or permissive marks RLS policy.
- All actor identities come from `auth.uid()`. Staff operations require active role/ownership and an active current semester.
- Requests record student, enrolment, section, offering, assessment, mark, lecturer and term IDs; original score/version/release ID; reason; reviewer; timestamps; and display snapshots.
- Only one pending/approved/corrected request may exist for a student/enrolment assessment cell.
- A release requires the original mark version/score and class release to be unchanged. Offering, request, submission and mark locks serialise competing operations.
- The private `cams_private.mark_release_permits` table is not exposed or writable by API roles. The release RPC issues a transaction-scoped permit for one mark, actor, version and score; the existing mark-validation trigger consumes it. A client-set flag or a bare approved request cannot bypass the lock.
- The mark-validation trigger remains SECURITY INVOKER; the deployed function owner is `postgres`. Its private permit path only runs inside the owner-executed release RPC. Do not change this ownership/security arrangement independently.
- Draft corrected scores and Admin notes are never returned by the student workspace RPC. The published marks table is unchanged until release, so existing portal/RLS/carry calculations remain authoritative.
- Request/event records are append-only to API users. Historical references prevent academic records used in corrections from being deleted through cascading cleanup.

## Existing reports

Nullable stable assessment/enrolment/class references are backfilled only when unambiguous. Renamed/missing assessments or multiple possible enrolments are retained as unresolved legacy links; the UI disables correction until an administrator investigates. No reports or marks are deleted. The legacy three-argument submit RPC remains supported for unambiguous enrolments and accepts visible assessment definitions regardless of the obsolete `is_published` flag.

## Verification

Run Node tests (`node --test tests/*.test.mjs`), staff build (`npm run build`), and Expo typecheck/lint from `student-mobile-expo`.

Run `supabase/tests/released_mark_corrections.sql` after migrations 202611080001 and 202611080002. All fixtures, notification inserts and pg_net dispatches roll back. It checks ownership/roles, idempotent reports, approval/rejection/revocation, direct-write denial, exact-cell scope, maximum validation, draft privacy, stale releases, archived semesters, original/new audit history and notification deduplication. Its fixture uses the unchanged carry formula to move a total from 33 to 41 across a threshold of 40.

Manual acceptance on a test allocation:

- Submit using a real enrolled student and verify another lecturer cannot see the issue.
- Approve as Admin, save a correction as its lecturer, and refresh the student app: the old score must still show.
- Release the correction and refresh: the new score, carry total and eligibility must show; surrounding marks must remain unchanged.
- Test notification delivery ON/OFF and the subject deep link on a physical device. This reuses `send-student-push`; no new push/email service is deployed.
- Keep two browser sessions open: repeat approval/save/release, and verify stale/consumed actions cannot overwrite a mark. Refresh or refocus the staff view to load decisions from the other session.
- Switch semesters and verify historical issue/request lists remain readable but all write RPCs reject archived terms.

Before production deployment, apply migrations transactionally, record their migration versions, then deploy staff assets and a compatible student preview update. Existing UI theme edits in the working tree must not be discarded when preparing the release.
