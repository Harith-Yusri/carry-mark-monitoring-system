
# UiTM CAMS — Continuous Assessment Monitoring System

Lecturer and faculty administrator portals backed by Supabase/PostgreSQL. The companion student app uses the same database and exposes released carry marks securely.

## Running the code

Run `npm install`, then `npm run dev`.

## Production hosting

The staff web portal is a static React/Vite application. Follow the [Cloudflare Pages deployment guide](docs/cloudflare-pages.md) to deploy from GitHub to `https://unicams.online`. The guide covers build settings, public environment variables, routing, custom domain setup, and Supabase Auth redirects while preserving the student app configuration.

## Supabase setup

Copy `.env.example` to `.env.local`, add the project URL and publishable key, then follow [supabase/README.md](supabase/README.md) to deploy migrations and create the first administrator.

Authentication uses Supabase Auth with institutional ID + password. Subjects, assessments, classes, invitation codes, enrolments, marks, carry calculations, eligibility, finalisation, exports, reporting, and settings use the normalized Supabase schema. Runtime academic data is not stored in browser storage or hardcoded source files.
  
