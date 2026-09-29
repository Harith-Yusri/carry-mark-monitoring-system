
# UiTM Carry Mark Monitoring System

Lecturer and faculty administrator portals backed by Supabase/PostgreSQL. The companion Android student app is in `StudentCarryMark_2.0` and uses the same database.

## Running the code

Run `npm install`, then `npm run dev`.

## Supabase setup

Copy `.env.example` to `.env.local`, add the project URL and publishable key, then follow [supabase/README.md](supabase/README.md) to deploy migrations and create the first administrator.

Authentication uses Supabase Auth with institutional ID + password. Subjects, assessments, classes, invitation codes, enrolments, marks, carry calculations, eligibility, finalisation, exports, reporting, and settings use the normalized Supabase schema. Runtime academic data is not stored in browser storage or hardcoded source files.
  
