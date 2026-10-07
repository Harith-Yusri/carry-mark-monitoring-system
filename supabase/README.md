# Supabase setup

1. Copy the project URL from the Supabase **Connect** dialog into `.env.local` as `VITE_SUPABASE_URL`.
2. Install the Supabase CLI and authenticate: `npx supabase login`.
3. Link this repository: `npx supabase link --project-ref YOUR_PROJECT_REF`.
4. Preview migrations: `npx supabase db push --dry-run`.
5. Apply migrations: `npx supabase db push`.

For local development with Docker, use `npx supabase start` followed by `npx supabase db reset`.

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
codes and fills existing details. A new code creates a shared catalogue entry.
Each class selects its programme, so one lecturer subject offering can contain
classes from several programmes during the same term. Other lecturers receive
separate offerings with their own classes, assessments and marks.

Apply migrations through `202610070002_class_owned_programme_relationship.sql`
before using this form. The
`create_lecturer_subject` RPC validates active lecturer access and resolves the
owner and term on the server. Catalogue and offering uniqueness constraints also
protect concurrent requests. General table write permissions remain unchanged.

Verification:
- `node --test tests/lecturer-subject-creation.test.mjs` checks form behavior.
- `npx supabase db query --linked --file supabase/tests/lecturer_create_subject.sql`
  runs transactional database checks and rolls back all fixtures.
- `npx supabase db query --linked --file supabase/tests/class_programmes.sql`
  verifies class programme relationships and enrolment safeguards.


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
