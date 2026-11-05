# CAMS staff portal on Cloudflare Workers Static Assets

The existing browser app is served as static files. Its architecture remains:

```text
Browser → Cloudflare Workers Static Assets → React/Vite CAMS → Supabase
```

There is no Worker backend or `main` script, Cloudflare Vite plugin, SSR adapter, D1, KV, or R2 binding. Supabase continues handling authentication, database access, RPCs, RLS, and existing backend services. The student app and its Supabase configuration are outside this deployment.

## Build and deployment settings

| Setting | Value |
| --- | --- |
| Frontend root | Repository root (`.`); source in `src/` |
| Framework | React 18, TypeScript, Vite 6 |
| Package manager | npm with committed `package-lock.json` |
| Node.js | `24.15.0`, preserved in `.node-version` |
| GitHub repository | `Harith-Yusri/carry-mark-monitoring-system` |
| Production branch | `main` |
| Worker name | `cams-staff` (must match `wrangler.jsonc`) |
| Wrangler config | `wrangler.jsonc` at the repository root |
| Build command | `npm run build` (unchanged: `vite build`) |
| Build output / static assets | `dist` / `./dist` |
| Deploy command | `npx wrangler deploy` |
| Initial URL | `https://cams-staff.<your-account-subdomain>.workers.dev` |
| Production domain | `https://unicams.online` |

Wrangler is pinned as a development dependency and locked in `package-lock.json`, so `npx` uses the installed project version. No global installation is needed. The `name` must match the Worker created/selected in Cloudflare Workers Builds; change both names together if another name is needed.

The prior Node pin and public-key build validation are preserved. There was no Wrangler configuration before this change. The old [Pages guide](cloudflare-pages.md) is retained as historical reference; its Pages project settings no longer apply.

## Frontend environment variables

Add these two public values in **Worker → Settings → Build → Build variables and secrets** before the production build:

| Build variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | The existing Supabase project's HTTPS URL, matching local `.env.local` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The same project's public `sb_publishable_...` key, matching local `.env.local` |

Do not add `VITE_SUPABASE_ANON_KEY`; the app does not read it. The existing variable can also contain a legacy public anon JWT. Get the values from the existing project's Connect/API Keys settings or local `.env.local`. Do not create a new Supabase project.

These values are embedded in the browser bundle by Vite. **Worker runtime Variables & Secrets, Wrangler `vars`, and `.dev.vars` do not populate this Vite build.** Set build variables before `npm run build` and rebuild after changing them. Use `.env.local` for local builds; it stays ignored and must not be committed or uploaded.

Never put a Supabase service-role key, `sb_secret_...` key, Twilio secret, WhatsApp API credential, or other server-only credential into frontend source, Vite variables, Wrangler config, or the build output. Backend secrets stay in Supabase. No Supabase runtime binding is required on Cloudflare. The existing build checks reject missing variables, a non-HTTPS project URL, and secret/service-role key types without logging their values.

Workers Builds handles its own deployment authorization after account setup. A manual CLI deployment uses `npx wrangler login`; do not put Cloudflare/GitHub tokens into frontend variables or repository files. If enabling non-production builds, configure their public build values deliberately; builds using these values connect to the same existing Supabase backend with the signed-in user's permissions.

Sources: [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image and version files](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).

## SPA routing

The config points `assets.directory` at `./dist` and sets `assets.not_found_handling` to `single-page-application`. The generated `index.html` handles client-side paths such as `/admin`, `/admin/dashboard`, `/lecturer`, `/lecturer/dashboard`, `/register`, and the login aliases on direct navigation and browser refresh. Static JS, CSS, fonts, and branding assets are served directly.

The existing React Router routes, redirects, role protection, and session restoration are unchanged. There is no `_redirects` file or custom fetch handler. See Cloudflare's [SPA routing configuration](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

## Local verification and manual CLI deployment

From the repository root, using the pinned Node version and the existing `.env.local`:

```sh
npm ci
npm run build
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
npx wrangler dev --local
```

`wrangler dev` serves the built `dist` using the actual static-assets configuration; rebuild after frontend changes. The dry run validates the deployment without publishing anything. Neither command requires deploying Supabase. `.wrangler/` and `.dev.vars*` are ignored to keep local state and runtime credentials out of Git.

Local verification on 5 November 2026: the production build succeeded, all 40 existing working-tree tests passed, and Wrangler `4.157.0` accepted the static-assets-only config in a deployment dry run (59 assets; no backend bindings). The Wrangler local server returned `index.html` with HTTP 200 for direct and repeated navigation requests to `/admin`, `/lecturer`, both dashboard routes, public/login routes, and an unknown client route; entry JS/CSS were served as static assets. Preparation-file and bundle checks found no private credential patterns or service-role tokens, and no backend/mobile source or environment files in `dist`. Existing locked dependencies were unchanged; Wrangler and its development dependencies were added. Live account login, production domain activation, and hosted browser behavior still need the acceptance checks below.

For an actual CLI deployment, sign in to the correct Cloudflare account with `npx wrangler login`, then run `npx wrangler deploy` after the build. Complete the browser authorization yourself if requested. No custom build hook is configured in Wrangler: the build and deploy commands are intentionally separate, matching Workers Builds. Deploying without rebuilding uses the files already in `dist`.

## Automatic deployment from GitHub main

1. Review and commit/push the Workers preparation changes to `main` when ready. Existing unrelated local Admin/WhatsApp reminder changes and legacy `student-mobile/` deletions are not part of this hosting change. Include application changes separately if production must match those local features; do not stage everything indiscriminately.
2. Sign in to the Cloudflare account managing `unicams.online`. Open **Workers & Pages → Create application → Import a repository** (or the equivalent Git import option in the Workers flow). Select GitHub and authorize the integration if prompted, granting access to `Harith-Yusri/carry-mark-monitoring-system`. Choose **Workers**, rather than Pages.
3. Select that repository, root directory `.` (or leave it blank for the root), Worker name `cams-staff`, and production branch `main`. Set **Build command** to `npm run build` and **Deploy command** to `npx wrangler deploy`. Do not select a framework conversion or generate a server entry script.
4. Add the two build variables above before the first build. Keep automatic production deployments enabled. Start with non-production branch builds disabled unless they are wanted. Workers Builds reads the committed Wrangler config and installs dependencies; it does not use the Pages build-output-directory setting.
5. Start the build/deployment. If account login, GitHub authorization, or deployment permission is requested, complete that manual step before continuing. Note the actual assigned `workers.dev` URL and run the acceptance checks below there.

After setup, pushes to `main` trigger Workers Builds. A separate GitHub Actions workflow is unnecessary. See [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## Attach unicams.online

The initial config enables `workers.dev` and leaves the production domain commented out so the first deployment can be tested before binding the domain.

After the temporary URL passes the acceptance checks, uncomment the following top-level property in `wrangler.jsonc`, commit it, and deploy:

```json
"routes": [{ "pattern": "unicams.online", "custom_domain": true }]
```

Use a **Custom Domain**, not a wildcard route to an external origin. Cloudflare manages the DNS record and HTTPS certificate for that association. Because this zone is already on Cloudflare, do not change nameservers or manually add duplicate records. If the hostname is already attached to Pages, another Worker, or an existing CNAME, review and release that conflicting association/record first; do not delete unrelated MX/TXT records or subdomains.

The dashboard alternative is **Worker → Settings → Domains & Routes → Add → Custom Domain → `unicams.online` → Add Custom Domain**. If using the dashboard, also record the same `routes` entry in Wrangler before subsequent deployments so source and dashboard settings agree. Keep `workers_dev: true` while verifying the custom domain. No `www` alias or forced redirect is required.

See [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). This preparation does not change DNS or attach the domain.

## Supabase Auth review

Live Auth settings are not changed by this deployment. In **Supabase → Authentication → URL Configuration → Redirect URLs**, add the actual initial Worker URL and the exact staff confirmation URL when testing registration:

```text
https://cams-staff.<your-account-subdomain>.workers.dev
https://cams-staff.<your-account-subdomain>.workers.dev/?verified=1
```

Once production HTTPS is active, ensure these are allowed too:

```text
https://unicams.online
https://unicams.online/?verified=1
```

Registration already supplies `${window.location.origin}/?verified=1`, so no frontend auth change is necessary. Retain existing mobile, localhost, and still-needed Pages/Worker redirect entries. Avoid a wildcard spanning other accounts' `workers.dev` sites.

Review **Site URL** before making `https://unicams.online` the shared default: it affects flows without explicit redirects. Keep the current default if another client depends on it until that client's owner confirms a change is safe. Explicit staff confirmation redirects can use the allowlist without immediately changing the shared default. Review confirmation templates for hardcoded hosts or `.SiteURL` usage that could override the intended destination; do not automatically change shared templates.

Staff login still calls the existing `staff-login` Supabase function, sets the returned session, verifies the profile, and navigates to the role's dashboard. Its current CORS handler accepts the new host. Logout still signs out locally and navigates to `/`; there is no external logout redirect to update. Sessions use the existing browser `sessionStorage`; a new hostname requires a fresh login.

The staff portal does not use Google OAuth. The student app does: preserve **`cmms://auth/callback`**, every other existing mobile redirect, the Google provider configuration, and the existing Supabase Google callback `https://<existing-project-ref>.supabase.co/auth/v1/callback`. Do not replace that callback with the staff domain or deploy `supabase/config.toml` during frontend setup.

Sources: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Acceptance checks

Run these first on `workers.dev`, then on `unicams.online`:

- Open public/login routes, `/admin`, `/admin/dashboard`, `/lecturer`, and `/lecturer/dashboard` directly and refresh. Confirm assets load and client-side redirects still work.
- With existing authorized test accounts, verify Admin dashboard/monitoring/reporting and Lecturer subjects/assessment settings/marks/exports. Refresh each dashboard and confirm the session restores. Do not change real marks just to test hosting.
- Confirm unauthenticated users return to login, role restrictions remain effective, and logout stays logged out after refresh.
- If a registration test is authorized, confirm the email link returns to that host's `/?verified=1`. This creates an account and sends email; use an approved test address.
- Check browser console/network for asset or Supabase failures without exposing credentials or session tokens in logs.
- After any manual shared Auth setting change, verify student Google login still returns through the existing mobile callback.

Only `dist` is published. It must not include environment files, backend source, migrations, student app files, or private credentials. Local build/dry-run checks do not prove hosted account authentication or domain provisioning.

Supabase schema, migrations, RPCs, RLS, Edge Functions, assessment calculations, authentication behavior, and Admin/Lecturer features remain unchanged. No repository settings, live Supabase configuration, or student app files are changed by this preparation.
