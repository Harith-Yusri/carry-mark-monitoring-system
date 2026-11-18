# Lecturer mark-issue bell — 18 November 2026

Student submits a mark issue → owning lecturer receives a bell alert → opening it acknowledges the alert and opens Subject Hub → Mark Issues, focused on the reported issue.

The existing `notifications` table is reused. Each alert records student name, subject code, class, assessment and submitted time. No score, correction draft or explanation is copied into the alert.

## Database changes

Migration `202611180002_lecturer_mark_issue_notifications.sql` adds:

- `notify_lecturer_mark_issue()` and the `mark_issue_lecturer_notification` AFTER INSERT trigger on `mark_disputes`. Lecturer recipient comes from `subject_offerings.lecturer_id`, with all display fields joined server-side. No student-provided lecturer ID is accepted.
- A partial unique index on the issue ID for `mark_issue_submitted`, so a report cannot create duplicate alerts. Existing same-key submission retries return the same issue without another INSERT; the student submission RPC and workflow are unchanged by this notification migration.
- `get_my_lecturer_notifications(before_created_at, before_id)`: checked active-lecturer inbox with an authoritative unread count, 20-item keyset pages and a has-more flag.
- `open_my_mark_issue_notification(target_notification)`: checked owner acknowledgement, live issue/offering references and existing current/archived dashboard metadata for the correct grouped Hub. Reopening keeps the original read timestamp.
- A recipient/time index and recipient-only RLS for the new notification type. Other lecturers, students and Admin cannot read these alerts. Existing policies for other notification types are retained. No broad read_at UPDATE grant is added.
- The existing notifications table is added to `supabase_realtime` if not already present. Client subscriptions filter the lecturer recipient; database RLS still governs delivery. INSERT refreshes are debounced/coalesced; UPDATE acknowledgements reconcile read counts locally.

There is no new notification table, push service, scheduled poll or student client change for the bell. Existing marks-released push dispatch ignores this type. Alerts use delivery_status=skipped because they are an in-portal inbox, separate from push delivery.

The previously requested lecturer-only correction workflow is included in this release through `202611180001_lecturer_mark_issue_outcomes.sql`. Its pending Staff Portal changes reference that migration, so both reviewed migrations must precede the matching staff deployment. No unrelated pending migration is applied. No mobile update is published in this release; the existing student submission endpoint stays compatible.

## Frontend files

- `src/layouts/PortalLayout.tsx`: lecturer-only header bell and scoped provider.
- `src/features/lecturer/LecturerNotifications.tsx`: accessible bell, unread badge, responsive inbox, refresh/older pages, first-load/empty/error/retained-data states, subscription lifecycle and throttled focus refresh.
- `src/services/lecturerNotifications.ts`: the two checked RPCs, existing subject mapping/grouping and the recipient-filtered Realtime subscription.
- `src/services/lecturerNotificationStore.ts`: account-scoped request coalescing, 30-second focus/open freshness, stale-response protection, pagination and idempotent local read reconciliation. No academic data is persisted globally.
- `src/features/lecturer/LecturerWebPortal.tsx`: checked notification URL navigation, retry/error states and correct Hub/Mark Issues selection. Reopening the same notification returns to Mark Issues even after selecting another tab.
- `src/features/lecturer/MarkIssuesTab.tsx`: focus/highlight the exact reported issue once, without stealing focus on every subsequent refresh.
- `src/services/carryMarkApi.ts`: exports the existing subject-summary mapper; mark calculations are unchanged.
- `src/types/database.ts`: new RPC declarations.

## Verification

- 75 isolated release Node tests and 90 working-tree tests pass. Six new inbox-store tests cover coalescing, freshness, reads, stale responses, events during a read, retained errors and disposal. Existing correction/shared-Hub tests remain passing.
- Notification SQL regression passes in a rolled-back transaction with both candidate migrations: correct recipient and payload, same-key deduplication, wrong lecturer denial, student/Admin denial, actual authenticated-role RLS, unread decrement, correct issue/Hub and repeat-open idempotence.
- Correction, student mark-release and shared assessment-structure SQL regressions are also run with both candidate migrations in separate rolled-back transactions. No fixture report, mark or notification is committed by these checks.
- Compiled isolated Staff Portal browser checks pass for bell/read/navigation/focus, repeated opening from another tab, incoming Realtime event bursts, unknown/empty/error states, retained refresh errors, both themes and a 390px mobile viewport. Every REST request and WebSocket in the browser fixtures is intercepted locally; these are not claims of a real user session or physical notification delivery.
- Ten staff loading scenarios, both correction outcome paths and the performance fixture pass against the release build. Admin makes zero correction-badge reads; opening a fresh bell does not duplicate the initial inbox read.
- Vite build and Wrangler dry-run pass. Full web typecheck retains the five documented baseline errors: four staff login/register `C.accent` references and the legacy delete RPC declaration. No new diagnostics.

## Deployment

Released on 18 November 2026:

- Source commit `3e2fe32709c0bf9b6547fbd92519ccc153c9aa81`, pushed to `main`.
- Supabase project `cueiilftoyqzvlrnmgfe`: only migrations `202611180001` and `202611180002` applied together transactionally and recorded in migration history. Inbox RPC, notification trigger and Realtime publication verified after commit.
- Existing Cloudflare Worker `cams-staff`, custom domain https://unicams.online, version `d3ed21db-a80f-474c-ba7c-19310bea814b`.
- Root, Lecturer and Admin SPA routes return 200 with entry `index-C9vbA4JD.js`. Entry, bell and Mark Issues JavaScript hash-match the verified release build.
- Notification SQL suite passed again against the deployed definitions in a rolled-back fixture transaction. Deployed grants deny anonymous RPC access, direct read_at updates and trigger execution; retired Admin review is inaccessible to authenticated API roles.
- Live-hosted bell scenarios, ten loading scenarios and both correction outcome paths passed with all Supabase REST/WebSocket traffic intercepted. Real delivery is established by the database trigger/RLS tests plus the deployed publication/configuration checks; no real student's issue was submitted or real lecturer account impersonated in these browser fixtures.
- Staff-only publishing: no Edge Function, mobile binary, EAS channel, authentication setting or mark-calculation change. The earlier student copy/status updates remain source changes; no mobile OTA was requested or published.

Known limitation: an actual signed-in lecturer receiving a real student's report over the hosted WebSocket transport was not manually exercised. The compiled client uses the documented Supabase Postgres Changes API; recipient checks are exercised with the actual authenticated database role.

Unrelated local dashboard, WhatsApp and mobile theme drafts are excluded from the release checkout and remain in the original workspace.
