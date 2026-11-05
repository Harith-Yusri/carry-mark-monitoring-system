# CAMS staff portal on Cloudflare Pages

> Historical reference: deployment now targets **Cloudflare Workers Static Assets**. Use [the current Workers deployment guide](cloudflare-workers.md) and `wrangler.jsonc`. The Pages setup below is retained as a record of the earlier preparation; do not use it to create the new deployment.

## Verified project settings

| Setting | Value |
| --- | --- |
| Frontend root | Repository root (`.`); source is `src/` |
| Framework | React 18, TypeScript, Vite 6 |
| Package manager | npm; committed `package-lock.json` |
| GitHub repository | `Harith-Yusri/carry-mark-monitoring-system` |
| Production branch | `main` |
| Framework preset | React (Vite), if offered; otherwise None with the settings below |
| Build command | `npm run build` (runs `vite build`) |
| Build output directory | `dist` |
| Root directory in Pages | Leave blank (repository root) |
| Node.js version | `24.15.0`, pinned in `.node-version` |
| Production domain | `https://unicams.online` |

Only `dist` is published. The staff portal calls the existing Supabase project directly. No Cloudflare Workers, Pages Functions, database migration, or backend deployment is needed. There was no existing production-hosting configuration in the repository during inspection. The existing `pnpm.overrides` metadata does not change the package manager: use npm and its committed lockfile.

## Build environment variables

Manually add exactly these two application variables to the **Production** build environment in Cloudflare Pages:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | The existing project's HTTPS URL; same value as local `.env.local` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The existing project's public `sb_publishable_...` key; same value as local `.env.local` |

Get these values from the existing Supabase project's Connect/API Keys settings or the local `.env.local`. Do not commit `.env.local` or create a new Supabase project. The portal does **not** read `VITE_SUPABASE_ANON_KEY`. If using a legacy public anon JWT, place it under `VITE_SUPABASE_PUBLISHABLE_KEY`.

Vite embeds `VITE_` values into public JavaScript at build time, even if a hosting dashboard masks the input. Never add a service-role key, `sb_secret_...` key, Twilio secret, WhatsApp API credential, or other backend secret to this frontend build. Existing server-only secrets stay in Supabase. No Cloudflare API token or GitHub token is needed in the build environment.

The build now fails if either required variable is missing, the URL is not HTTPS, or the key is not a publishable/legacy anon key. Changing a Pages environment variable requires a new build/deployment. `.node-version` supplies the Node version, so no `NODE_VERSION` variable is required; remove an old conflicting override if one exists.

If enabling Preview deployments, set these variables separately in the **Preview** environment. Preview deployments pointed at this project can access the same production backend with the signed-in user's existing permissions. Start with previews disabled unless they are wanted; do not create a second backend for this deployment.

## Local verification

From the repository root, using the pinned Node version:

```sh
npm ci
npm run build
node --test tests/*.test.mjs
npx vite preview --host 127.0.0.1
```

Provide the two variables in `.env.local` for local builds. `vite preview` is only a local smoke-test server; Cloudflare Pages serves the generated static files in production.

The production bundle should contain `index.html`, hashed JS/CSS assets, fonts, and public branding assets. It must not contain `.env` files, Supabase function source, migrations, or either student app. Vite source maps are disabled by default.

Preparation verification on 5 November 2026: `npm run build` succeeded on Node `24.15.0`; all 40 existing tests passed. Local preview returned the SPA entry point for direct and repeated requests to public/login routes and both dashboard routes, and served entry JS/CSS as static assets. Build configuration checks rejected missing variables, non-HTTPS URLs, secret keys, and service-role JWTs without logging key values; publishable and legacy anon formats were accepted. Bundle checks found no secret-key/service-role tokens, backend/mobile source, environment files, or source maps. These were local checks; live authentication and hosted browser refresh still require the deployment acceptance checks below.

## Routing

The existing React Router `BrowserRouter` handles `/`, `/register`, login aliases, `/admin/dashboard`, and `/lecturer/dashboard`. Portal tabs remain controlled by the existing application. Role protection and Supabase session restoration are unchanged.

Cloudflare Pages automatically serves the SPA entry point for paths without a matching static asset when there is no top-level `404.html`. This build has no `404.html`, so direct navigation and refresh work without `_redirects` or a Worker. Keep this Pages SPA behavior enabled; do not add a top-level `404.html` later without revisiting route handling. Existing static assets retain their normal serving behavior. See [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## GitHub and first Pages deployment

1. Review the deployment changes and commit/push them to `main` when ready. Keep unrelated working-tree changes out of this deployment commit unless they are intentionally included. In particular, the inspection found pre-existing Admin changes and deleted legacy `student-mobile/` files; this preparation does not stage, commit, restore, or push those changes.
2. Sign in to the Cloudflare account that manages `unicams.online`. Open **Workers & Pages → Create application → Pages → Connect to Git** (some dashboard layouts label this **Import an existing Git repository**). Select the **Pages** flow.
3. Select GitHub. If prompted, authorize/install Cloudflare's GitHub integration, granting access to `Harith-Yusri/carry-mark-monitoring-system`. This is a manual account authorization step. Do not share credentials or access tokens in chat.
4. Select that repository and begin setup. Choose a Pages project name, for example `cams-staff` if available, and production branch `main`.
5. Enter the verified build settings above and the two Production variables before building. Keep automatic production deployments enabled for `main`. No deploy command is needed; Cloudflare uploads `dist` after the build. No GitHub Actions workflow is necessary.
6. Select **Save and Deploy**. Confirm the build succeeds and note the assigned `https://<project-name>.pages.dev` address. Use the actual assigned project name in all later steps.
7. Open the temporary Pages domain and complete the smoke checks below. For email-confirmation testing, first add its exact redirect URLs in Supabase as described below; leave the existing Site URL unchanged at this stage.

Cloudflare's [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) describes the connection and production-branch controls. After setup, each pushed commit to `main` should automatically build and deploy. Do not use a Direct Upload project for this workflow.

## Attach unicams.online after the Pages deployment passes

1. Open **Workers & Pages → your Pages project → Custom domains → Set up a custom domain**.
2. Enter `unicams.online` and continue.
3. Review and confirm the DNS record Cloudflare proposes for this Pages project. The domain is already on Cloudflare, so use this guided association; do not change nameservers or manually add duplicate records. If an existing apex record conflicts, review its current purpose before replacing it. Leave MX/TXT records and unrelated subdomains alone.
4. Wait for the custom domain and HTTPS certificate to become active. Open `https://unicams.online` and repeat the smoke checks, including refresh of both protected dashboard routes.

This task does not require a `www` hostname, a `pages.dev` redirect, or zone-wide caching rules. Keep the temporary domain available until production verification is complete. See [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Supabase Auth review (manual; no configuration deployed)

The dashboard's live Auth settings were not read or changed during repository preparation. The repository alone cannot confirm their current values. The same Supabase project serves the mobile app, so review these settings without replacing existing entries.

### Temporary Pages domain

In **Supabase → Authentication → URL Configuration → Redirect URLs**, add the actual temporary domain and the exact staff email-confirmation URL:

```text
https://<project-name>.pages.dev
https://<project-name>.pages.dev/?verified=1
```

Registration already requests `${window.location.origin}/?verified=1`; it will automatically use whichever host serves the portal. Allow the exact URL including its query string. Do not add a wildcard covering other people's `pages.dev` sites. If previews are enabled, add only the particular preview hosts that need confirmation testing.

### Production domain

After `https://unicams.online` is active:

1. Add these entries to **Redirect URLs**, retaining all existing mobile, localhost, and still-needed temporary-domain entries:

   ```text
   https://unicams.online
   https://unicams.online/?verified=1
   ```

2. Review **Site URL**, the project's shared default destination when a flow does not specify its own redirect. The intended staff production default is `https://unicams.online`. Set it to that value only after confirming that the current default is not required by another client. If it currently serves a mobile flow, retain it until that flow's owner verifies it is safe to change; explicit staff confirmation redirects can use the allowlist above without immediately changing the shared default.
3. Review existing confirmation email templates. If they use `.RedirectTo`, the requested host can be used. If they hardcode localhost or another host, or always use `.SiteURL`, they may send staff to that host instead. Review any template change across both clients before applying it; preserve email confirmation and existing account restrictions.

See Supabase's [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) for Site URL, explicit redirects, and email templates.

### Login, logout, Google OAuth, and mobile compatibility

- Staff login calls the existing Supabase Edge Function `staff-login`, sets the returned Supabase session, checks the existing profile, then navigates locally to the role's dashboard. Its existing CORS handler accepts browser requests from the new host; no backend/CORS change is needed for Pages.
- Logout calls `signOut({ scope: "local" })` and navigates to `/`. No external logout redirect needs changing. Sessions stay in the existing browser `sessionStorage`; a new hostname requires a fresh login, while refresh in the same tab restores the session.
- The staff portal has no Google OAuth flow. Do not add Google OAuth or change its providers for this deployment.
- The student Expo app does use Google OAuth with an explicit mobile callback. Preserve **`cmms://auth/callback`** and every other existing mobile redirect entry. The repository's `supabase/config.toml` currently includes that mobile callback; it was deliberately left untouched. Do not deploy this file as part of Pages setup or overwrite the dashboard's existing allowlist with just the new web entries.
- Google's authorized redirect URI continues to be the existing Supabase callback (`https://<existing-project-ref>.supabase.co/auth/v1/callback`); the staff hostname is not a replacement for it. No Google Console change is required by the current staff portal. See [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Deployment acceptance checks

Run these on both the initial Pages domain and then `unicams.online`, using existing authorized test accounts:

- Open `/`, `/register`, `/admin/login`, and `/lecturer/login` directly; confirm assets load and no hosting 404 occurs.
- Sign in as an admin, open the existing dashboard and monitoring/reporting views, then refresh `/admin/dashboard` and confirm the session restores.
- Sign in as a lecturer, open subjects, assessment settings, marks, and exports, then refresh `/lecturer/dashboard` and confirm the session restores. Avoid modifying real marks merely to smoke-test hosting.
- Confirm an unauthenticated protected route returns to login, and the existing role restrictions still apply.
- Confirm logout returns to `/` and a refresh does not restore the logged-out session.
- If a staff registration test is authorized, confirm the email link returns to that host's `/?verified=1` and existing verified-account login still works. This creates an account and sends email, so do not use an arbitrary real address for a deployment test.
- Check browser console/network for missing assets, failed `staff-login` requests, or Supabase errors. Keep credentials and session tokens out of screenshots and logs.
- After any shared Auth setting change, verify the existing student Google sign-in still returns to the app through its mobile callback.

Local compilation and repository tests do not prove live account login or Cloudflare domain provisioning. Complete these checks after the manual account connection/deployment steps.

The deployment preparation leaves Supabase schema, migrations, RPCs, RLS, Edge Functions, authentication behavior, assessment calculations, Admin/Lecturer features, and student app code unchanged. No push, repository-setting change, Cloudflare project creation, DNS edit, or Supabase configuration update is performed by these files.
