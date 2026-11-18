# Controlled Edit Mark — 18 November 2026

Released mark → **Edit Mark** → corrected score + required reason → **Save Correction** → **Release Updated Mark**.

Released grid inputs remain disabled. Each existing Released cell has a secondary Edit Mark control. The panel loads fresh server context for the exact student, original assessment and class, shows the published score/maximum, and requires a changed finite score in range with at most two decimal places and a 1–2000 character reason.

Save Correction stages privately. It does not change `marks`, carry total, eligibility or student notifications. The panel can be closed and reopened to resume the saved draft. Explicit release updates one mark and invalidates that class's staff cache so Marks/Export use the new published result. The class remains Released and retains its class release ID. Carry calculation, Final Assessment eligibility comparison and assessment weightage are unchanged.

## One correction mechanism, two entry points

`mark_correction_requests` and `mark_correction_events` are reused. No correction table, notification service or fake Student report is created.

- Student-initiated: the existing `stage_mark_issue_correction` keeps its issue link and `student_issue` initiation source. Reject and correction/release remain available through Mark Issues.
- Lecturer-initiated: `dispute_id` is null and `initiation_source='lecturer'`. Server-derived academic IDs, original/new score, original version/release, lecturer, reason, snapshots and timestamps form the same audit record as issue corrections.
- The existing active-cell unique index still permits only one active correction for an enrolment/assessment. An unrelated active draft cannot be silently overwritten or relabelled. A saved Student-issue draft can also be resumed/released from its cell panel while preserving the issue link; release closes that issue normally.
- A direct correction does not automatically close an independent Student report. That report remains available for the lecturer's normal response. If another entry point already has an active draft, continue the existing correction rather than creating a competing one.

## Forward migration and RPCs

`supabase/migrations/202611180003_lecturer_initiated_mark_corrections.sql`:

- Makes the issue FK optional in requests/events and adds `initiation_source` with a source/link consistency check. Existing records default to `student_issue`; event rows must retain a request or issue reference. Existing history is retained.
- Adds private `lock_released_mark_cell(section,enrolment,assessment)` to validate active owning lecturer, current active semester, exact enrolled/active student and original offering assessment, existing non-null mark and finalised class release. Locks protect the context during each operation.
- Adds private `stage_exact_mark_correction(...)` shared by both public entry points, with reason/score validation, active-cell conflict prevention, matching-save retry deduplication and audit/event recording.
- Adds public `get_released_mark_correction_context(section,enrolment,assessment)` for fresh published score/version, metadata, resumable draft and cell history. This checked read holds context locks; it grants no table-write permission.
- Adds public `stage_released_mark_correction(section,enrolment,assessment,expected_version,new_score,reason)` for lecturer initiation. It returns the confirmed private draft/context in the same response, with no follow-up-read ambiguity after a committed save.
- Updates private `lock_mark_correction` and existing public `stage_mark_issue_correction` / `release_corrected_mark` to support both sources. Original cell/version/score/class release and current ownership/term are checked. Release uses the existing private single-mark transaction permit and unchanged `validate_mark` trigger.

API roles cannot execute the private helpers or directly read/write correction tables. Anonymous users cannot execute the new public RPCs. Students, other lecturers and Admin cannot stage/release direct corrections. The public release RPC accepts only the stored correction ID; it cannot be retargeted to another student/assessment. Repeated releases do not duplicate score changes, events or notifications.

Release reuses the existing exact-student `marks_released` / Mark Updated notification, correction ID deduplication, preference and push-dispatch path. It does not send a class-wide notification or a lecturer Student-report bell alert.

## Frontend and tests

- `src/features/lecturer/MarksEntryTab.tsx`: secondary per-cell control, locked inputs, panel target and class-cache refresh on successful release.
- `src/features/lecturer/ReleasedMarkCorrectionPanel.tsx`: server context, private save/resume, explicit release, correction history, loading/error/retry, duplicate-action guard, keyboard focus and responsive existing staff styles.
- `src/services/markCorrectionApi.ts`: optional issue/source types, context loader and direct-save API; reuses the existing release API.
- `src/types/database.ts`: two new public RPC declarations.
- `supabase/tests/lecturer_initiated_mark_corrections.sql`: direct and cross-entry-point security/privacy/audit regression, rolled back.
- `tests/released-mark-edit.test.mjs`: exact secondary controls, disabled Released inputs (including zero/null distinction), no Edit control for drafts and scoped/versioned API calls.
- `scripts/check-released-mark-edit.cjs`, shared fixture `scripts/check-staff-loading.cjs`: compiled browser checks with all Supabase REST/WebSocket traffic intercepted.

Verification: 77 isolated release Node tests and 92 working-tree tests pass. Four SQL suites pass against candidate definitions in separate rolled-back transactions: lecturer initiation, existing Student issue correction, lecturer bell and Student mark release. These cover ownership/ID manipulation, reason, finite/range/precision/version validation, no fabricated reports/bell alerts, draft privacy/no pre-release notification, exact-cell release, unchanged class release, 33→41 carry/eligibility threshold crossing, exact Student notification, old/new/reason/source audit, retries and retained Student issue linkage through shared release.

Browser checks pass for private save, duplicate click, draft resume, release/reloaded grid/eligibility, locked inputs, both themes/390px width, unknown/error/retry, no draft-class control, existing Student issue outcomes, ten loading scenarios and lecturer bell navigation. Vite build and Wrangler dry-run pass. Full web typecheck retains the five previously documented baseline errors (four login/register palette references and the old delete RPC declaration); no new diagnostics.

## Deployment

Pending verified publication of the one forward migration and the existing `cams-staff` Worker. No mobile, Edge Function, semester lifecycle or unrelated Admin deployment change is required. Unrelated local drafts are excluded from the release checkout.
