# CAMS staff performance audit — 2 November 2026

## Measurement boundaries

These results deliberately separate three different measurements:

1. **Live SQL:** six samples per operation, using the current database, staff identity context and `SET LOCAL ROLE authenticated`. Only operation labels, elapsed milliseconds, row counts and JSON byte counts were exported. The first execution is reported separately from the median of the following five. These are SQL execution timings, not PostgREST HTTP timings or a load/concurrency test. No persistent database objects, policy changes, indexes or migrations were introduced.
2. **Controlled production-browser test:** Chromium, 1366×900, the real Vite production build and page components, with **every Supabase request intercepted** using synthetic responses matching the measured data's approximate shape. Each request has a controlled 200 ms wait. These are repeatable request-dependency/CPU measurements, **not the user's connection or real OAuth/session validation**. The fixture JWT is accepted only by the isolated mock responses, never by Supabase. Authentication implementation was not changed.
3. **Actual network reference:** six requests to the public Supabase Auth settings endpoint: first 529 ms; warm 159–173 ms, median 169 ms; 610 response bytes. JSON parsing was below 0.1 ms. This measures that endpoint from the execution host; it cannot establish live RPC HTTP latency or the user's network delay.

The user's sanitized HAR is still needed to attribute their observed end-to-end delay. No raw student identities, marks, real authentication sessions, passwords or HAR bodies were copied into the audit artifacts.

Numeric samples: [staff-portal-2026-11-02.json](staff-portal-2026-11-02.json).

## Five slowest measured baseline operations

All browser wall times below use the same controlled 200 ms/request fixture. Differences of a few tens of milliseconds on untouched operations are test noise, not regressions/improvements.

| Operation | Before | After | Requests before → after | Baseline limiting path |
|---|---:|---:|---:|---|
| Admin initial authenticated Dashboard load | 833 ms | 856 ms | 3 → 3 | Server user validation → staff profile → overview RPC |
| Lecturer initial authenticated My Subjects load | 827 ms | 836 ms | 3 → 3 | Server user validation → staff profile → subject dashboard RPC |
| Marks Entry class selector | 826 ms | 336 ms | 8 → 1 | Previously three dependency waves and all student data before classes appeared |
| Export class selector | 812 ms | 306 ms | 7 → 1 | Previously full marks/enrolments/totals before a class was selected |
| My Subjects return from Hub | 311 ms | 315 ms | 1 → 1 | Deliberate fresh dashboard fetch after Hub work |

Marks selector bytes fell **8,279 → 1,286**; export selector bytes fell **7,910 → 1,286** in the synthetic fixture. Marks selector improvement: 59%; export selector improvement: 62%.

Deferral is not free work: opening a chosen class previously took 26 ms after the expensive initial list; it now takes 314 ms and six parallel requests. However, the combined list-plus-first-class path improved **852 → 650 ms**. No request is made for another class's roster/marks just to paint the selector. The totals RPC still returns offering-scoped totals, as before; it was not rewritten for this audit.

## Breakdown across all requested pages

React numbers come from a **separate temporary profiling build** using `react-dom/profiling` and React Profiler; the ordinary production build has no added profiler or telemetry. React render time is part of JavaScript time and must not be added to it. Layout/style time is a separate browser metric. Wall time also includes click scheduling, frame waits and test polling; it is not all CPU.

| Page/operation | Before → after wall | Requests after | React render CPU | JS CPU | Layout + style CPU |
|---|---:|---:|---:|---:|---:|
| Admin Dashboard including restore | 833 → 856 ms | 3 | 6.3 ms | 18.9 ms | 11.6 ms |
| Submission Monitor navigation | 103 → 59 ms | 0 | 2.9 ms | 4.7 ms | 4.4 ms |
| Lecturer Directory navigation | 56 → 58 ms | 0 | 2.4 ms | 3.5 ms | 4.2 ms |
| Reports & Exports navigation | 66 → 63 ms | 0 | 2.8 ms | 4.3 ms | 8.1 ms |
| Semester History navigation | 267 → 267 ms | 1 | 1.8 ms | 3.8 ms | 9.8 ms |
| Lecturer My Subjects including restore | 827 → 836 ms | 3 | 18.6 ms | 31.2 ms | 13.2 ms |
| Subject Hub / Assessments | 278 → 293 ms | 2 in parallel | 4.7 ms | 18.7 ms | 4.2 ms |
| Marks Entry class selector | 826 → 336 ms | 1 | 4.6 ms | 6.8 ms | 4.0 ms |
| Selected class's Marks Entry | 26 → 314 ms | 6 in parallel | 3.5 ms | 5.9 ms | 4.0 ms |
| Export class selector | 812 → 306 ms | 1 | 2.5 ms | 4.5 ms | 3.1 ms |
| Selected class export preview | not separately sampled → 311 ms | 6 in parallel | 2.1 ms | 4.0 ms | 3.1 ms |
| My Subjects return | 311 → 315 ms | 1 | 2.7 ms | 4.3 ms | 3.5 ms |

Admin initial restoration in the instrumented fixture: session-storage read **0.1 ms**, real auth-code path's mocked server-validation request **206.6 ms**, mocked staff-profile request **207.2 ms**, overview HTTP fixture **~203 ms**. Lecturer: storage **0.1 ms**, validation **204.8 ms**, profile **207.8 ms**, subject RPC fixture **~203 ms**. No tokens were logged. These prove dependency order, not real Auth service duration.

Lazy page chunks took roughly **2–8 ms** each from the local preview server in the baseline. This is a local transport measurement, not WAN/CDN evidence. Admin transformation measured **12.4 ms** including first-use locale/date work in the small fixture. The actual decoded database JSON sizes were admin overview **11,821 bytes**, lecturer dashboard **2,033 bytes**, history **257 bytes**. Those payloads do not justify speculative SQL rewrites or global memoization.

## Live database findings

| Query | First SQL execution | Warm median with staff RLS | JSON bytes |
|---|---:|---:|---:|
| Admin overview RPC | 15.195 ms | 7.717 ms | 11,821 |
| Lecturer dashboard RPC | 6.095 ms | 4.004 ms | 2,033 |
| Semester history RPC | 1.763 ms | 1.088 ms | 257 |
| Admin profile read | 2.654 ms | 1.696 ms | 266 |
| Lecturer profile read | 1.956 ms | 1.883 ms | 266 |
| Assessment list, representative offering | 0.2–1 ms range | see numeric samples | 765 |
| Old class metadata query, representative offering | 0.845 ms | 0.679 ms | 1,038 |
| Enrolment/identity query, representative offering | 9.013 ms | 8.381 ms | 1,428 |
| Old marks query, representative offering | 29.696 ms | 25.096 ms | 3,918 |
| Totals RPC, representative offering | 3.564 ms | 2.318 ms | 591 |
| New class selector incl. counts + statuses | 5.982 ms | 5.858 ms | 1,377 |
| New selected-class marks join | 24.536 ms | 24.520 ms | 3,918 |

The new selector SQL does more than the old metadata-only query, but replaces the full waterfall required to produce counts/statuses. Its live SQL response is ~1.4 KB; no student names or marks are required for class cards.

`EXPLAIN (ANALYZE, BUFFERS)` for selected-class marks: **24.073 ms execution**, **4.474 ms planning**, 352 shared-buffer hits, **zero shared reads**. The plan uses `marks_enrolment_idx` and `enrolments_section_idx`. The class-section sequential scan touches only 13 rows. Policy-filtered nested work is visible, but this is not evidence of a missing useful index, disk-I/O bottleneck, or a need to weaken RLS. No index or policy changes were applied.

## Targeted changes

- Added `loadSubjectClassSummaries`: one class-only query across all offering IDs, with enrolled counts and actual submission status. Class relationships and finalisation interpretation are unchanged.
- Added `loadSubjectClassDetail`: loads the chosen class's enrolments and marks only, with assessments/settings/submission/totals requested in parallel. The original mapper is shared, preserving assessment IDs, scores, totals and eligibility.
- Added `useSubjectClassData` for Marks Entry and Export: render the class selector first, fetch details on selection, ignore late responses for a previously selected class, retain existing data on refresh, surface real errors and offer retry.
- Mutation reloads deliberately fetch fresh class metadata before detail mapping, so regenerated invitation codes and changed capacity/labels cannot remain stale.
- Programme options are fetched when Add/Edit Class opens rather than blocking every marks selector visit. Options remain real Supabase data; no cross-user/global academic-data cache was added.
- Added safe HAR sanitization and repeatable profiling scripts outside the app bundle. No dependency was added to the project, and browser tooling was isolated under `/tmp`.

## Intentionally unchanged

- Auth validation/role loading remains sequential and verified server-side. Moving or caching role checks would change security assumptions.
- Admin overview is already fetched once at portal mount and shared by Dashboard, Monitor, Directory and Reports. Tested tab switches made zero additional Supabase requests. There is no eager report/export request to remove.
- Root uses no React StrictMode wrapper. No duplicate production requests were observed; no workaround for hypothetical development-only double effects was added.
- Only the selected Subject Hub tab mounts. Assessment structure still makes two independent parallel requests; one 200 ms wave was not worth a new RPC.
- My Subjects re-fetches on returning from the Hub, so finalisation/class mutations are reflected. Eliminating it needs explicit invalidation and was left alone.
- History re-fetches on navigation and can change following semester administration. No stale global cache or prolonged TTL was introduced.
- No table virtualization for the current small dataset. No blanket memoization, API replacement, Edge Function, index, migration, RLS, business-rule or authentication change.

## Verification and remaining limits

- Production build and whitespace checks pass; 22 Node regression tests pass, covering summary-only loading, selected-class mapping, score edits, stale-response protection, failure/retry, fresh invitation codes, grouped offerings, export context, and HAR redaction.
- Isolated browser checks exercised Admin Dashboard, Submission Monitor, Lecturer Directory, Reports, History, Lecturer My Subjects, Assessments, Marks Entry, Export, and navigation back. No console/runtime errors or unhandled mock endpoints were observed. Both before and after builds were production builds.
- A separate ad-hoc TypeScript check of the touched web dependency graph reaches one **pre-existing missing generated RPC type**, `delete_my_lecturer_subject` in `src/types/database.ts`. It was present before this performance task and was not changed just to make the audit green. There is no configured web typecheck/lint script. Production compilation and regression tests passed.
- Real staff passwords/sessions were unavailable. The live PostgREST HTTP query/cache/JSON envelope and user's actual browser network cannot be fully verified without the sanitized HAR or a real staff-session run. SQL equivalents and query plans preserve authenticated-role RLS but do not reproduce every PostgREST execution/embedding detail.
- A live public-key/nonexistent-ID smoke check returned **401 / 42501** for both protected table requests, as expected without a staff session. It verified the access boundary, not successful authenticated PostgREST execution. No grants or policies were relaxed to make this check succeed.
- No claim is made that the Free plan cannot be a bottleneck under concurrency or cold starts. Current warm SQL is mostly single-digit milliseconds, selected-class RLS work ~25 ms, and observed public-endpoint RTT ~169 ms. Reducing request dependencies is supported by the evidence; an upgrade's benefit is **not established**. Reassess the HAR and concurrent workload before spending on compute.

## Reproduce / supply a HAR

From the repository root:

```sh
node --test tests/*.test.mjs
npm run build
npx supabase db query --linked --file scripts/profile-staff-queries.sql
node scripts/sanitize-har.mjs "/path/private.har" "/path/cams.sanitized.har"
```

`profile-staff-queries.sql` returns numeric measurements only; all temporary objects are rolled back. Do not upload/commit an original HAR.

The optional browser harness requires Playwright and an installed browser outside the app dependencies. Start `npx vite preview --host 127.0.0.1 --port 4173`; then run:

```sh
CAMS_PLAYWRIGHT_MODULE=/tmp/cams-staff-perf-tools/node_modules/playwright \
PROFILE_OUTPUT=/tmp/cams-staff-browser.json \
node scripts/profile-staff-browser.cjs
```

The harness rejects non-local target origins and intercepts all Supabase calls with synthetic fixtures. It does not validate real login credentials or send reminders/finalisations.
