# Staff Portal initial loading states

The Staff Portal distinguishes an unknown first response from a successfully loaded empty collection. Empty arrays and null weightage values can be real data; they are not a substitute for a loading or error state.

## Coverage

| Screen | Initial request | Successful empty result | Refresh |
| --- | --- | --- | --- |
| My Subjects | Card skeletons; no assignment/programme counts or empty selectors | No Teaching Allocations | Existing subjects remain visible |
| Subject Hub assessments | Table skeletons; no allocation progress, Not set, or empty components | Empty structure and genuinely unset weightage | Existing structure remains through mutation reconciliation |
| Marks and Export class selectors | Card skeletons until keyed summaries succeed | Actual zero class count / no class sections message | Prior successful summaries retained |
| Selected class/student marks and export preview | Table skeletons before detail resolves | Real empty student roster/preview | Existing class detail retained |
| Mark Issues / Released correction state | Table skeletons; no premature empty history or action permissions | No mark issues | Existing issues/correction state retained; refresh status shown |
| Admin Academic Operations | Metric skeletons; no false zero metrics or all-released claim | No lecturer records for the semester | Existing overview retained |
| Submission Monitor | Table skeletons; no fake pending counts or empty groups | No matching submissions | Existing records retained |
| Lecturer Directory | Table skeletons; no 0 of 0 records flash | No matching lecturer records | Existing records retained |
| Reports & Exports | Table skeletons; no empty report counts | Actual loaded report counts | Existing report inputs retained |
| Semester History | Card skeletons | No archived semesters | Fresh read on remount |
| System Settings | Table skeletons; heading remains | Real settings values and empty lists | Existing settings retained during saves/transitions |
| Admin Mark Corrections | Table skeletons | No correction requests | Existing queue retained; refresh status shown |

Remote programme dropdowns show loading/unavailable labels and remain disabled until options have loaded. Unknown submission badges are omitted. Correction badge responses are protected against late requests, and a new semester invalidates the old count. Refresh failure preserves the prior count and indicates the error.

## Implementation

`src/components/StaffDataState.tsx` supplies `LoadingState`, `InitialDataState`, and `RefreshStatus`. Small CSS skeletons use neutral surfaces in both themes, reserve approximate layout space, and have no shimmer or animation. Placeholder shapes are hidden from assistive technology; loading text is a polite status announcement. Initial errors use an alert instead of an empty state.

`useSubjectClassData` stores successful summaries with their offering key. `hasLoaded` becomes true even when a successful response is empty. Failed initial requests remain unknown with an error; refresh failures retain successful summaries and selected detail. No global academic-data cache or new persistence was added. Tabs that remount show skeletons again rather than inventing a cached result.

Unknown assessment/issue/correction arrays use null until their first successful response. Admin screens use the existing successfully loaded academic context. Existing request/mutation, mark-calculation, eligibility, release/correction, notification and semester rules are preserved.

## Verification

Run existing and new Node regressions:

```sh
node --test tests/*.test.mjs
npm run build
```

There are 57 Node tests, including deferred/empty/failed summary requests, retained background data, stale detail responses, mark IDs/calculations, shared structures, correction permissions, and existing save lifecycles.

For browser checks, install Playwright outside application dependencies, start `npx vite preview --host 127.0.0.1 --port 4178`, then run:

```sh
CAMS_PLAYWRIGHT_MODULE=/path/to/playwright \
CAMS_BROWSER_EXECUTABLE=/path/to/chromium \
node scripts/check-staff-loading.cjs
```

The harness runs 10 scenarios with fast or deliberately held responses, populated/empty/failed results, tab changes while requests are pending, background refresh success/failure, programme options, pending correction locks and both themes. Held requests simulate a slow server/connection without adding application delays. All Supabase traffic is intercepted with synthetic fixtures. No actual user tokens, staff login, mark mutations, notifications, or production database calls are used. Screenshots and results default to `/tmp/cams-staff-loading-checks`.

To verify the deployed static code with the same synthetic backend, set `CAMS_LOADING_BASE_URL=https://unicams.online` and a different `CAMS_LOADING_OUTPUT` directory. This verifies the production UI/assets, not real authenticated Supabase behavior.

The repository has no configured Staff Portal TypeScript script. A full web graph check was run using the available TypeScript compiler, Vite client declarations, ESNext/Bundler resolution, React JSX, ES2022/DOM, skipLibCheck and the existing non-strict source conventions. A clean HEAD archive was checked with equivalent flags. Both report the same five pre-existing errors: four references to the missing `accent` palette property in Login/Register and a missing generated `delete_my_lecturer_subject` RPC type. This change adds no new diagnostics; it does not claim a clean whole-repository typecheck.

## Deployment scope

Only the Staff Portal UI, its tests, Vite type declarations and this document change. The Wrangler route records the already-existing `unicams.online` binding so a deployment does not remove it. Worker name remains `cams-staff`; no new Worker/domain is introduced. No Supabase migrations, RLS, RPCs, backend/notification code or Student app files are included. Environment files remain ignored.
