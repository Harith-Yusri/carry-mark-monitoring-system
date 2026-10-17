# Supabase setup

1. Copy the project URL from the Supabase **Connect** dialog into `.env.local` as `VITE_SUPABASE_URL`.
2. Install the Supabase CLI and authenticate: `npx supabase login`.
3. Link this repository: `npx supabase link --project-ref YOUR_PROJECT_REF`.
4. Preview migrations: `npx supabase db push --dry-run`.
5. Apply migrations: `npx supabase db push`.

For local development with Docker, use `npx supabase start` followed by `npx supabase db reset`.

## Academic session lifecycle

Admins manage sessions in **System Settings > Academic Session Lifecycle**. A new
session is created as a draft. Activating that draft atomically completes the old
session's offerings, marks the previous session closed and read-only, and makes
the draft the only active session. Session-owned academic records are retained;
they are never reset or deleted.

During testing, an admin may edit any session's identity, dates and default
deadline, or reopen an archived session. Reopening performs another atomic
switch: the current session is archived, the selected session becomes active,
and its offerings return to the statuses they had before archival. Confirmation
messages show counts for classes, marks, submissions and finalised classes. This
is a reversible switch, not a destructive reset.

For test cleanup, admins may permanently delete a draft or archived session only
when it contains no subject offerings or dependent academic data. The active
session and any populated session cannot be deleted; keep populated sessions
archived or reopen them instead.

The active session drives admin monitoring, lecturer subject creation and the
student mobile portal. Admins can review archived session totals under **Past
Sessions**. Lecturers can open **Past Sessions** from My Subjects and inspect
their archived classes and assessment structure without editing them. The normal
student payload and student RLS access are limited to active-session enrolments.

Permanent records include users, staff/student identities, programmes and the
subject catalogue. Offerings, class sections, programme deadlines, enrolments,
assessments, marks, submissions and notification settings belong to a session
through `subject_offerings.term_id` or a dependent foreign-key path.

Apply `202610070004_academic_session_lifecycle.sql` and
`202610070005_reversible_session_transitions.sql` and
`202610070006_delete_empty_test_sessions.sql`. Verify the full reversible transition
inside a rolled-back transaction with:

```sh
npx supabase db query --linked --file supabase/tests/session_lifecycle.sql
```

## Creating the first user

Create an email/password user in **Authentication > Users**. Copy its UUID and run this in the SQL editor:

```sql
insert into public.profiles (id, staff_no, full_name, role)
select
  'AUTH_USER_UUID',
  'ADM001',
  'Faculty Administrator',
  'admin';
```

Create lecturer users the same way using role `lecturer`. Programmes are selected
on their subject teaching assignments, not on lecturer profiles.


## Manual reminder emails

The Overview and Submission Monitor buttons call the `send-reminder` Edge Function.
Only an authenticated, active administrator may call it. The function rechecks
outstanding class sections, reads the email registered in the lecturer's linked Supabase Auth account, and
sends a plain-text email through Resend. The recipient is resolved on the server using `auth.admin.getUserById`; the service role key is never exposed in the browser.

Setup:

1. Apply pending migrations using the migration workflow above. The old `reminder_email` column is retained for compatibility but is no longer used.
2. Create a Resend API key. Store all reminder settings in Supabase **Edge Functions > Secrets**. Never put them in a `VITE_` variable, a local `.env` file, or source control.
3. Choose one email mode:

   - Development: set `REMINDER_EMAIL_MODE=development`, `REMINDER_FROM_EMAIL=Carry Mark System <onboarding@resend.dev>`, and `REMINDER_TEST_RECIPIENT` to the single address Resend permits for test delivery. The selected lecturer's Supabase Auth email must match that address exactly (case-insensitively); the function refuses every other recipient.
   - Production: set `REMINDER_EMAIL_MODE=production` and `REMINDER_FROM_EMAIL=Faculty Administration <noreply@your-verified-domain.com>`. Add and verify that custom domain in Resend first. See [Resend domain documentation](https://resend.com/docs/dashboard/domains/introduction). Production rejects `@resend.dev` senders and permits real lecturer Auth emails. `REMINDER_TEST_RECIPIENT` is not used.

   If `REMINDER_EMAIL_MODE` is absent, the function defaults to production. Any unsupported value fails closed.
4. Deploy with `npx supabase functions deploy send-reminder --project-ref YOUR_PROJECT_REF`. The function config disables the legacy gateway JWT check; the handler validates the bearer token with Supabase Auth and checks the active administrator role itself. Keep these checks in place.
5. In **Supabase Authentication > Users**, make sure every lecturer’s linked account has their real email address. The lecturer does not need a Resend account, and their address does not need to match the Resend account owner. There is no separate reminder address to maintain.
6. Deploy `staff-login` with `npx supabase functions deploy staff-login --project-ref YOUR_PROJECT_REF`. This preserves staff ID login when registered email addresses change. It resolves the email on the server and verifies the password through Supabase Auth.
7. Sign in as an administrator and click **Send Reminder** for a lecturer with an outstanding class in the current term. Check that lecturer’s mailbox and the Resend delivery logs.

The UI shows “Email Queued” only after Resend accepts the email, which does not
prove inbox delivery. Errors leave the button available for retry. An hourly
provider idempotency key suppresses duplicate requests for the same lecturer,
including concurrent requests and page reloads. If the address or outstanding
classes change after a send during that hour, Resend rejects the changed payload;
retry in the next hour. Current reminders include outstanding classes in the
current academic term. This implementation adds manual reminders only; it does not schedule the
existing automatic-reminder setting.

Local checks: `node --test supabase/functions/*/*.test.mjs` and
`npm run build`. Real delivery requires the deployment and credentials above.

## Lecturer subject creation

Lecturers use **My Subjects > Create New Subject**. The form suggests catalogue
codes and fills existing details. A new code creates a shared, programme-neutral
catalogue entry. Programme and programme semester belong to each teaching
offering. Subject creation remains programme-neutral; the first class assigns
the offering programme, and every later class must use that programme. The
same subject can therefore be offered for different programmes or semesters in
one academic session without sharing classes, assessments or marks.

Apply migrations through `202610080002_programme_specific_subject_offerings.sql`
before using this form. The
`create_lecturer_subject` RPC validates active lecturer access and resolves the
owner and session on the server. A database uniqueness constraint rejects only
an exact lecturer/subject/programme/semester/session duplicate and also protects
concurrent requests. General table write permissions remain unchanged.

Verification:
- `node --test tests/lecturer-subject-creation.test.mjs` checks form behavior.
- `npx supabase db query --linked --file supabase/tests/lecturer_create_subject.sql`
  runs transactional database checks and rolls back all fixtures.
- `npx supabase db query --linked --file supabase/tests/class_programmes.sql`
  verifies class programme relationships and enrolment safeguards.

## Security hardening

Apply `202610080004_security_hardening.sql` after the programme-offering
migrations. It makes offering ownership conditional on an active lecturer role,
locks all dependent academic records after finalisation, limits notification
updates to `delivery_status`, rate-limits class-code attempts, and validates mark
disputes against the student's current enrolment and a published assessment.

Production configuration remains operational responsibility: keep service-role
and Resend keys only in Edge Function secrets, enable Supabase leaked-password
protection and an appropriate password policy, set short access-token lifetimes,
review Auth redirect URLs, and deploy HTTPS/CSP/security headers at the hosting
layer. Redeploy `send-reminder` after updates; its responses are non-cacheable and
never return the resolved lecturer email.

`202610090001_finalisation_controls_student_marks.sql` separates draft syncing
from release. Enrolled students can see the assessment structure immediately,
but marks, carry totals and eligibility are returned only after their class is
finalised. Direct `marks` access follows the same rule, and direct access to the
aggregate totals view is removed. Run `supabase/tests/student_mark_release.sql`
against a migrated linked database to verify draft privacy and finalised release.


## Subject carry-mark weightage

Lecturers set **Total Carry-Mark Weightage (%)** in Assessment Structure for each
of their subject offerings (greater than zero, at most 100). New offerings need
this setting before assessments are added. Existing offerings keep their prior
term maximum until the lecturer changes it. Assessment allocation, finalisation,
weighted mark entry, CSV exports and student APIs use the saved subject maximum.
Student APIs retain the term default while an offering has not yet been configured.
Eligibility thresholds retain the existing academic-term rule; changing weightage
does not automatically change that rule.

Apply `202609180002_subject_carry_weightage.sql`. Database checks in
`supabase/tests/subject_carry_weightage.sql` run inside a rolled-back transaction.
A lower maximum cannot discard allocated weight, and finalised classes must be
reopened before changing the subject maximum.
