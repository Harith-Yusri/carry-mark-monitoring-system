# Account management

Use **Supabase Dashboard > Authentication > Users** to manage registered email addresses and passwords.

## Administrators and lecturers

1. Create an Auth user with their real email and a password.
2. Copy the Auth UUID into the matching `public.profiles.id`, along with their staff number, name and role. Programmes are assigned to teaching offerings.
3. Users sign in with staff ID and password. The `staff-login` Edge Function resolves the current registered email privately and verifies the password using Supabase Auth.

Changing the email on the existing Auth user preserves their staff ID, assignments and marks. Do not delete and recreate the user. Reminders automatically use that registered email; no separate contact email is required. A pending email change takes effect for reminders only after it becomes the account’s current email.

The login lookup allows ten attempts per account per 15-minute window and returns a generic failure for unknown, inactive or throttled accounts. It is accessible only to the service role. Deploy `staff-login` and apply its migration before using the updated frontend.

## Students

The student portal continues to use `<matrix_no>@student.uitm.edu.my` as its generated login email. Its login flow is unchanged. Link each Auth UUID through `students.auth_user_id`.

## Passwords

Manage passwords through Supabase Authentication. Never put passwords in profiles, students, seed files, migrations or source code.
