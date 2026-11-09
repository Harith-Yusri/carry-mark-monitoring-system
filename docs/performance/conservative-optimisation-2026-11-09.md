# Conservative CAMS optimisation — 9 November 2026

The previous read-only audit is the evidence base. This pass changes two read/registration functions and affected client behavior; it does not delete tables/columns, add/remove indexes, change RLS, retire authentication, or change academic release/correction/semester rules.

## Results and measurement boundaries

- Correctly sized, lossless WebP branding removes approximately 2.07 MB from login + portal branding transfers, without changing the source artwork. Sources remain available for other uses; only active image references change. 144px covers roughly 3x their rendered 44–46px dimensions. Light/dark comparisons were reviewed.
- Selected-class first load: **six parallel logical Supabase reads → one RPC**. The old requests were already parallel, so this is not a sixfold first-load latency improvement. The new SECURITY INVOKER endpoint retains RLS and the same ownership/access rules.
- Representative SQL JSON: **9,611 → 3,905 bytes (59.4% smaller)**, combining the six response-equivalents. These are PostgreSQL JSON text bytes, not exact compressed PostgREST HTTP bytes. Keys/nested response shape differ from the old raw responses.
- Marks and Export share one Hub-scoped in-memory cache for up to 30 seconds, coalescing concurrent reads. An unchanged already-viewed class needs **zero additional data requests** on Export and returning to Marks. Cache is discarded with the Hub/user; no persistence/global academic-data cache is introduced.
- Correction count makes one request after real term bootstrap, zero requests on unrelated navigation/renders, and reuses the current queue's authoritative count after queue load/review/manual refresh. The timer and duplicate term-initialization read are gone.
- Push-token callback loop identified in source and reproduced by a regression fixture. Listener now passes its native token through, concurrent work is coalesced, successful identical registration is cached per account/install/token/platform for 24 hours, and the server skips unchanged updates. Real token rotation, account/device changes and reactivation still register.

**No claim of a production user's end-to-end speedup is made from synthetic timing.** Browser tests use actual production builds with a simulated authenticated local session and every Supabase call intercepted. Live SQL timing uses authenticated PostgreSQL role/claim context, separately. No real student rows, passwords or sessions are exported in the measurements. No new authenticated staff browser credentials were available.

## Branding sizes
| Active image | Before bytes | After bytes | Reduction |
|---|---|---|---|
| public/cmms-favicon-v3.png | 1545225 | 16460 | 98.93% |
| public/assets/branding/cmms-logo-mark.png | 554097 | 9414 | 98.30% |

The login image loads on the public sign-in screen. The portal image loads only in the staff layout. Original source PNGs are retained; they are no longer requested for these small images. WebP is supported by the target browser environment; Student app native asset configuration is unchanged.

Cold-cache Chromium login test, three samples, simulated 150ms latency / 200 KB/s:
| Build | Resource body bytes | Login image bytes | Median image duration ms | Median FCP ms | Median LCP ms |
|---|---|---|---|---|---|
| Before | 1771657 | 1545225 | 8310 | 1096 | 1096 |
| After | 242900 | 16460 | 583 | 1100 | 1100 |

These are controlled network emulation measurements, not actual WAN timings. The image completed much earlier; **FCP/LCP did not materially improve** in this fixture because the small logo was not the largest-contentful element. The large bandwidth saving is measured. Resource bytes exclude HTTP headers and HTML navigation and depend on actually requested fonts/assets. Initial JS remains about 123–124 KB gzip; unused chart/UI packages were not removed.

## Six selected-class reads and the replacement

Before: assessment structure; offering carry maximum/term threshold; enrolled roster+identity; submission state; marks+repeated enrolment embed; offering-wide totals. Some metadata was already present in the class selector. All six were needed to build the current marks/preview shape; no unrelated dataset was added.

`get_staff_class_detail(target_section)` now reads the exact class once, fetches the original offering's assessment IDs, enrolled roster, marks, class release state and settings, and returns the exact frontend-ready shape. It uses the same weighted sum, rounding and eligibility comparison as `student_carry_totals`, restricted to the chosen roster. Regression tests compare its result with the existing totals RPC. Shared assessment structure IDs are not remapped. No correction drafts are returned; only committed marks and current release state are read.

It is STABLE **SECURITY INVOKER**, with `search_path=''`, explicit active lecturer ownership/admin checks, EXECUTE revoked from public/anon and granted only to authenticated. Existing table RLS remains applied. A student is denied this staff RPC even if entitled to their own released marks through existing APIs. Owner/Admin, other lecturer, student, populated/empty class and release/privacy checks were exercised under authenticated database role. No grant or RLS policy was widened. Archived staff reads keep the existing original offering/term context rather than silently switching to the active semester.

No existing read RPC provided this selected-class shape: offering totals alone were broader and did not provide roster/marks/metadata; the student bootstrap has different authorization and disclosure. One purpose-built RPC replaces this specific fan-out; the rest of the RPC architecture is retained.

## SQL timings

Live database, same representative class, six samples per operation. First sample reported separately; warm median is the following five. These are SQL execution wall times inside a transaction, not HTTP RTT or a load test. Old request-equivalent JSON aggregation/row aliases approximate PostgREST; the new RPC is called directly. No production academic data was mutated for measurements; candidate definition and temporary timing table were rolled back.
| Operation | First ms | Warm median ms | JSON bytes |
|---|---|---|---|
| assessments | 1.854 | 0.654 | 765 |
| enrolments | 9.565 | 8.708 | 1428 |
| marks | 30.388 | 26.079 | 6678 |
| new_detail | 42.439 | 36.742 | 3905 |
| old_totals | 3.453 | 2.361 | 590 |
| settings | 2.738 | 1.402 | 71 |
| submissions | 1.756 | 1.325 | 79 |

Sum of the six old warm medians: **40.529 ms**; new RPC warm median: **36.742 ms**. This is an aggregate work comparison, **not** a request critical-path speedup: the old parallel marks query alone had a 26.079ms warm median, below the combined RPC's 36.742ms. One endpoint trades a modestly longer single SQL execution for fewer HTTP requests/bytes and safe reuse. The audit's historical 46ms actual PostgREST marks mean is a different period/shape, not a paired before/after baseline.

Separate authenticated EXPLAIN ANALYZE samples: new RPC 44.563ms execution / 0.011ms planning, 1,738 shared hits and zero reads; old embedded-mark equivalent 22.009ms execution / 4.593ms planning, 529 hits and zero reads. New wrapper includes **all** roster, structure/settings, marks and totals, whereas the old EXPLAIN includes marks only. These plans do not justify weakening RLS or claiming a large SQL speedup. No index change was made.

## Browser/request measurements

Same fixture/viewport (1366×900), ordinary Vite production builds, 200ms wait per intercepted Supabase request. Timings are action-to-ready and include browser event/poll scheduling, minus a common 30ms settling window. The fixtures represent one student, not the six-student SQL payload; **fixture payload sizes are not real database payload sizes**. Repeat measurements vary by a few tens of ms. Both runs are preserved in the JSON evidence.
| Flow | Calls before → after | Ready ms before → after |
|---|---|---|
| Subject Hub assessments | 1 → 1 | 318 → 305 |
| Marks selector first visit | 1 → 1 | 300 → 297 |
| Selected class first visit | 6 → 1 | 313 → 300 |
| Export selector first visit | 1 → 0 | 294 → 53 |
| Same class Export preview | 6 → 0 | 306 → 48 |
| Marks selector return | 1 → 0 | 310 → 31 |
| Same class Marks return | 6 → 0 | 295 → 36 |
| Sync Draft (read refresh only) | 7 → 1 | 809 → 322 |

The repeated-tab changes are the clear measured responsiveness win. First selector/assessment loading remains one network wave; first class loading is also still one wave. Sync Draft now revalidates only class detail after pending writes, rather than class metadata plus all detail reads. Class metadata and release mutations still reload summaries plus chosen detail.

## Cache safety and invalidation

- Cache instance belongs to the specific Subject Hub and signed-in staff auth ID. Navigating away/discarding Hub removes it. A 30-second freshness bound limits reuse; expired cache reads refetch.
- Browser focus invalidates all Hub entries and revalidates the mounted class workspace. Only successfully loaded data is stored, including legitimate empty arrays. Errors are never success-cached. A mutation invalidating an in-flight read prevents that result from repopulating the cache.
- Assessment add/edit/delete/weightage and mark-issue/correction actions invalidate all class entries in the Hub. Class add/edit/delete/code rotation and release invalidate the relevant detail plus summaries. Unselected details have separate keys.
- Local score edits invalidate detail immediately. Pending writes are tracked; Export waits for any queued/in-flight draft save before reading. A shared flusher commits queued marks before a tab change, avoiding a stale export during the 600ms draft debounce. Server errors are surfaced; existing mark/correction/eligibility rules still run at the database.
- Metadata-only revalidation is not substituted for a confirmed release/correction state. No optimistic permission grant is cached. Initial loading skeleton/error behavior from the previous task is retained.
- External changes are observed on focus, reopening a stale cache entry or explicit refresh. There is no new realtime subscription. This is bounded reuse, not a guarantee of instant background visibility of every other device's mutation.

## Correction count behavior

Before: mount with unknown term, then term initialization (two count calls); every changed Admin tab; focus; 60-second polling; review/manual-refresh callbacks could add a separate count query. After: one count after successful term bootstrap; no count reads merely from rerendering/unrelated navigation; term changes invalidate count and bootstrap once. An in-flight count is coalesced and late results cannot overwrite a newer authoritative count.

The queue already returns `status` and `editable` (current+active term), which are exactly the count RPC's pending/current filters. Queue success derives the badge from these records, rather than querying it again. Review and manual queue refresh update count from the fresh queue. If a review succeeds but queue reload fails, a targeted count fetch repairs the badge. Queue focus refresh supplies external changes while that workspace is open. Opening the queue remains a fresh authoritative request; unrelated Admin tabs no longer poll it. External requests can therefore remain absent from the badge until a relevant queue/bootstrap refresh; the queue and server permissions stay authoritative.
| Count action | Before measured calls | After measured calls |
|---|---|---|
| bootstrap | 2 | 1 |
| unrelatedTabChanges | 5 | 0 |
| manualQueueRefresh | 1 | 0 |

## Push registration investigation and fix

The historical 99,673 calls remained unchanged in a fresh read at 10:34 MYT; there are five device rows. This is historical traffic, not proof of a storm during the current run.

The source contains one `PushCoordinator` startup effect keyed by student ID/preference, and a token listener. Auth restore is already coalesced; no evidence showed registration on every React render. The problematic chain is:

`native token listener → registerForStudentPushNotifications() → getExpoPushTokenAsync({projectId}) → implicit getDevicePushTokenAsync() → native token listener again`.

The installed SDK implementation and [Expo SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/#pushtokenlistenertoken) explicitly warn that acquiring a device token in that listener can create an infinite loop. `getExpoPushTokenAsync` accepts the supplied `devicePushToken`; the new listener passes it through, preventing native reacquisition. This is a strong source-level explanation, reproduced by a regression fixture that emits a callback on native acquisition; **production historical call counters alone cannot attribute every one of the 99,673 calls to a particular installed build/device**.

Client safeguards: duplicate startup/token work is coalesced; rotations queue rather than being dropped; confirmed successes are cached securely per auth account, installation, Expo token and platform for 24 hours. Cache stores no academic data. Repeated unchanged startup within that window makes **zero registration RPCs** after confirmation. A first startup / real token change / account change / preference invalidation / reactivation makes one successful registration as needed. A daily confirmation permits server repair/heartbeat. Failed RPCs are not cached and can retry naturally; no retry timer/loop was added. Notification-disabled state retains the existing preference checks; denied OS permission never registers. Logout invalidates cache and waits for a started registration before deactivating the installation, preventing late write-after-unregister.

Server safeguard: `register_my_push_device` keeps the original validation/auth lookup, account reassignment, token-rotation, device identity and conflict behavior. An unchanged active/error-free tuple confirmed within 24 hours returns the existing ID without UPDATE. Old clients may still make HTTP calls, but those calls no longer rewrite the same row. Real tuple changes, errors/deactivation or expired confirmation repair the row. No devices/tables/columns are deleted. Existing delivery preference/deduplication behavior is unchanged.

Regression tests cover listener re-entry, startup overlap, unchanged repeated/fresh-runtime startup, TTL expiry, token rotation, account switch, stable installation ID, preference invalidation, logout ordering, permission denial and retry after failure. SQL fixture checks unchanged-row ctid identity, reactivation, token rotation and distinct devices.

## Production/local authentication drift

Freshly downloaded production `student-login` still uses password sign-in, `resolve_student_login_email` and `student_login_attempts`. Local `supabase/functions/student-login/index.ts` is a 410 retired handler, with tests for that behavior. Google migration rejects new student password registration but does not delete the historical resolver/limiter or redeploy Edge Functions automatically. A migration and an Edge Function deployment are separate operations.

This pass **does not deploy student-login, remove its resolver/table, or change Google/Auth hooks**. Local retired-handler tests are not proof that old installed password clients can be cut off safely. Safest path: inventory installed-client usage and an agreed retirement window, verify Google migration/access for those users, then separately deploy the retirement handler, monitor failures and only later review dependencies. The corresponding legacy limiter remains required today. Authentication tests were run because StudentContext/session identity was exercised; no sign-in mechanism changed.

## React/request findings

The duplicate badge effect depended on activeTab and an initially unknown context; those dependencies were removed from count fetching. Marks/Export no longer each own an uncached network dataset; they share scoped cache data but keep separate UI selection state. Offering keys and callbacks stay stable. Parent context rerenders alone do not refetch class details. Only the opened tab mounts; it loads its own data as needed. No blanket memoisation, context architecture rewrite or chart-library removal was introduced. The useMemo in Subject Hub gives the cache a deliberate auth/Hub lifetime, not a render micro-optimisation.

## Changed files/functions

- Branding: `public/assets/branding/cams-{login,portal}-144.webp`, `WebLogin.tsx`, `PortalLayout.tsx`.
- Class read: `carryMarkApi.ts`, generated RPC declaration in `types/database.ts`, `202611090001_selected_class_detail.sql` introducing `get_staff_class_detail(uuid)` only.
- Reuse/invalidation: `subjectClassCache.ts`, `useSubjectClassData.ts`, LecturerWebPortal, MarksEntryTab, ExportTab, AssessmentsTab, MarkIssuesTab.
- Badge: AdminWebPortal, MarkCorrectionQueue.
- Push: student `pushNotifications.ts`, `studentApi.ts` (identity cache key helper), StudentContext (preference invalidation), `202611090002_idempotent_push_registration.sql` replacing only `register_my_push_device(text,text,text)`.
- Verification: browser performance/loading harness, class cache/API/structure tests, push tests, transactional `supabase/tests/selected_class_detail.sql`; session test fixture now includes an existing markIssues dependency that was previously unstubbed.

## Verification and release conditions

- 67 Node web/push/cache regression tests pass.
- Four database suites pass in separate rollback-only transactions with candidate definitions: selected_class_detail, released_mark_corrections, student_mark_release, shared_subject_assessment_structure. Fixtures and any pg_net dispatches are rolled back; no real academic records are changed.
- Nine Edge authentication regressions and nine session persistence/auth restore regressions pass.
- Expo typecheck and lint pass; ordinary Staff Vite build and Wrangler dry-run pass.
- Full web graph TypeScript check reports the same five documented baseline diagnostics (four missing `accent` palette properties and the missing old delete RPC type); no new diagnostics. This is not a claim of a clean whole-repository check.
- Ten browser loading scenarios pass in both themes with fast/held/empty/failed requests, navigation during loading, retained data during refresh/failure, pending correction permissions, and edited-draft → Export consistency. Every Supabase request in these browser tests is intercepted; actual successful production RLS HTTP is not simulated as real credentials.
- Existing Android preview fingerprint is `29797fbf5d8d4b0719c4a4c7ac7f9cff2d863c05`; modified JS/TS generates the same Android fingerprint. No native dependency, Android config, runtime policy, app scheme or production update channel is changed. Release is restricted to existing Android preview.

Only the two reviewed migrations are applied before the frontend references the new RPC; no broad `db push` or pending unrelated migrations are deployed. Staff deployment targets the existing cams-staff Worker/domain. Final version IDs, live verification and Android preview update result are recorded in the final delivery, not inferred from local build success. Existing unrelated drafts are excluded from the source commit and preserved in the working tree.

## Intentionally deferred

No table/column cleanup (including student_login_attempts), policy rewrite, index consolidation/addition, totals-view/mobile-bootstrap redesign, image-source deletion, dependency purge, compute/hosting change, broad archive request redesign or login retirement. No `npm audit fix --force`. Selected-class RPC still pays existing RLS costs; further SQL tuning requires a separate role-correct plan review. Real WAN/prod-user timing and physical-device push receipt/rotation remain validation gaps; fixture and native-fingerprint checks are not a physical-device delivery test.

Numeric evidence: [conservative-2026-11-09.json](conservative-2026-11-09.json). Raw authenticated plans, rollback regression results, asset comparison images and browser screenshots are retained in `/tmp/cams-perf-evidence`.
