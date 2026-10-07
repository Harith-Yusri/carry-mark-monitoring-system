# Own your Carry Mark Monitoring System

Repository-based learning guide • 19 September 2026

This guide completes Parts 4–12, with a short recap of Parts 1–3. Read a part, open its linked files, and attempt its questions before reading the answer key. You do not need to memorize every line. Aim to predict where work happens and prove your prediction from the code.

**Scope:** explanations describe the current local source, including uncommitted work. Live Supabase migrations, deployed functions, authentication settings, and email delivery were not checked. No application code or database data was changed to produce this guide. Examples marked “hypothetical” are exercises, not implemented features. Design benefits explain why an arrangement is useful; they do not establish the original author's intent.

## Contents

- [Recap: Parts 1–3](#recap-parts-13)
- [4. State and screen updates](#4-state-and-screen-updates)
- [5. Supabase from zero](#5-supabase-from-zero)
- [6. Your database](#6-your-database)
- [7. Login, sessions, and permissions](#7-login-sessions-and-permissions)
- [8. Lecturer features](#8-lecturer-features)
- [9. Administrator features](#9-administrator-features)
- [10. Android student app](#10-android-student-app)
- [11. Debugging, security, and safe changes](#11-debugging-security-and-safe-changes)
- [12. Independent development and project defense](#12-independent-development-and-project-defense)
- [Check your answers](#check-your-answers)

## Recap: Parts 1–3

Your system has two **frontends**, the interfaces people use: a staff website and an Android student app. They share a **backend**, the services storing records and enforcing rules, supplied by Supabase plus your custom code.

```text
Lecturer/admin → React website ─┐
                              ├→ Supabase Auth + data API → PostgreSQL
Student → Kotlin Android app ─┘
Website → staff-login server function → Auth + database
Website → send-reminder server function → Auth + database + Resend email
```

An **API** is a defined way for software to request work from other software. PostgreSQL is the database engine. Supabase provides hosted backend capabilities, an arrangement called **Backend-as-a-Service**.

| Area | Technologies actually relevant to the application |
|---|---|
| Website | TypeScript/TSX, React 18, React DOM, React Router 7, Vite 6, CSS/inline styles, Tailwind 4, Lucide icons, Supabase JavaScript client |
| Android | Kotlin, Jetpack Compose/Material 3, AndroidX ViewModel, StateFlow, coroutines, Kotlin serialization, Supabase Kotlin Auth/Postgrest, Ktor, Gradle |
| Backend | Supabase Auth, PostgreSQL, SQL/PL/pgSQL, TypeScript Edge Functions running in Deno, Resend |
| Checks | Node test runner/assertions, esbuild to transform test inputs, SQL database scripts |

The exact declared package versions are in [package.json](package.json) and [Android build configuration](student-mobile/app/build.gradle.kts). The web project also contains a reusable Radix-based UI collection and packages for charts, forms, calendars, carousels and animation. The current portal import chain does not use `src/app/components/ui/`; installed packages are not proof of active features.

**Language reminders:** variables name values; objects group named properties; arrays hold lists; functions take inputs and perform work. TypeScript types describe expected shapes but do not validate network requests at runtime. `async` functions return Promises—eventual results—and `await` waits before continuing that function. Imports connect files. A React component returns a description of an interface; **props** are its inputs.

| Location | First association |
|---|---|
| [index.html](index.html), [main.tsx](src/main.tsx) | HTML root container; start React |
| [App.tsx](src/app/App.tsx) | Shared providers and browser routes |
| [ProtectedRoute](src/components/ProtectedRoute.tsx) | Wait for user loading, redirect missing/wrong-role users |
| [PortalLayout](src/layouts/PortalLayout.tsx) | Common header, logout, appearance, `Outlet` for child page |
| [features](src/features/) | Login, lecturer, administrator interfaces |
| [services](src/services/carryMarkApi.ts) | Academic requests and response conversion |
| [hooks](src/hooks/), [context](src/context/) | Reusable behavior and shared state |
| [types](src/types/) | TypeScript descriptions; not the live database |
| [student-mobile](student-mobile/) | Separate Android project |
| [supabase/migrations](supabase/migrations/) | Ordered database changes |
| [supabase/functions](supabase/functions/) | Custom server programs |
| `node_modules`, `dist` | Installed dependencies and generated build output; edit source instead |

Startup is `index.html → main.tsx → App → providers → MainApp → matching route`. A **provider** shares information with components underneath it. `/` displays `WebLogin`; `/lecturer/dashboard` and `/admin/dashboard` display role-specific portals. Older login paths redirect to `/`. Unknown paths redirect there too. The shared layout's `Outlet` is the place where the matched child route appears.

Subject selection and portal tabs use remembered values, not separate URLs. Refresh loses those selections, while saved database records remain. Browser Back does not retrace tab changes that never changed browser history.

**Configuration map:** `vite.config.ts` configures React/Tailwind and the source alias; `package.json` defines `dev` and `build`; the lockfile records resolved dependencies; `postcss.config.mjs` is currently empty configuration. Android Gradle files define builds/dependencies, and `AndroidManifest.xml` declares Internet permission and the launcher activity. `supabase/config.toml` configures the two functions. `seed.sql` supplies starter records, while `demo.sql` supplies demonstration data; neither describes current live contents. The root README's reference to `StudentCarryMark_2.0` is stale: the local Android directory is `student-mobile`.

## 4. State and screen updates

**Start simple:** a screen must remember what you typed, selected, or downloaded. This temporary memory is **state**. It is distinct from data saved in the database.

In [WebLogin](src/features/auth/WebLogin.tsx):

```tsx
const [id, setId] = useState("");
```

`id` holds the current text; `setId` requests an update; `""` is the initial value. React then renders again—runs the component to calculate the next interface. A **Hook** is a function that uses React capabilities inside a component.

| Mechanism | Actual example | Why it exists |
|---|---|---|
| `useState` | Selected class, login error, active tab | Remember visible state between renders |
| Context/provider | [AuthContext](src/context/AuthContext.tsx), [DarkModeContext](src/context/DarkModeContext.tsx) | Share user/theme without passing them through every component |
| `useEffect` | Load assessments when `offeringId` changes | Synchronize with outside systems after rendering |
| `useMemo` | Assessment weight total or filtered records | Reuse a derived calculation while dependencies stay the same |
| `useRef` | In-progress subject-save or reminder guard | Keep a mutable value without triggering a render |
| Custom Hook | [useAdminRecords](src/hooks/useAdminRecords.ts), [useReminders](src/hooks/useReminders.ts) | Package related state and behavior for reuse |

An effect's **dependency list** identifies values whose changes require it to run again. `[]` means it has no changing dependencies; it runs for each new mounting of that component. **Mounting** means adding a component to the displayed tree; removing it is unmounting. Changing tabs removes the old tab component and its local state. A Hook reused by several components creates separate state for each call; `useAdminRecords()` is not a shared global cache.

After a successful save, `MarksEntryTab.updateMark()` uses:

```tsx
setSections(previous => previous.map(section => /* replacement section */));
```

This abbreviated excerpt shows the pattern: derive the next list from the latest previous value. `map` creates a new list; `{ ...student, scores, totalCarry }` copies properties and replaces selected ones. This makes the state change explicit. Mutating an old object without a state update may leave React unaware that the display should change.

```text
Score input → updateMark → await upsertMark → database success
→ setSections → calculate displayed total → render updated grid
```

The screen updates after a confirmed save, but uses a local total calculation at that point. Reloading uses the database's calculated totals. Neither updating state nor changing themes saves academic records. The web theme starts dark and has no persistence code in its provider.

**Modify/debug:** a new filter usually needs local state and a derived filtered list, not a database column. For a screen that stays stale, inspect whether a setter/reload runs and whether the effect depends on the changing identifier. For fast requests, consider older responses arriving after newer ones; current mark inputs save on each change, making ordering a concern.

**Remember:** state controls the current display; Supabase holds saved records. Recognize `WebLogin.tsx`, `MarksEntryTab.tsx`, both context files and both custom hooks.

**Quiz:** (1) Does a state update save a database row? (2) What does an effect dependency do? (3) Why use a ref for an in-progress guard? (4) Do two `useAdminRecords()` calls share one cache? (5) What happens to tab-local state after unmounting?

**Exercise:** hypothetically add a “show ineligible students only” checkbox to Marks Entry. Identify its state, the list it filters, and whether saving that checkbox is necessary.

## 5. Supabase from zero

**Start simple:** Supabase supplies identity services and a database reachable through APIs. A **client** is the library object your program uses to talk to those services.

Your web client is initialized once per loaded module in [src/lib/supabase.ts](src/lib/supabase.ts):

```ts
createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

`Database` supplies TypeScript descriptions from `src/types/database.ts`; it does not create tables. The options request saved sessions, automatic token refresh, and recognition of authentication information in URLs. That last option does not mean the UI implements a password-reset feature. If URL/key are missing, the exported client is `null`; `requireSupabase()` throws a useful configuration error. Removing this setup breaks its consumers' backend access.

An **environment variable** is configuration supplied outside the main source. These frontends embed configuration when built:

| Value | Location used by this project | Handling |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Web `.env.local`, names in [.env.example](.env.example) | Intended public app configuration |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Android `local.properties` → Gradle → `BuildConfig` | Intended public app configuration |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Server function environment | Project address and legacy public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server functions only | Secret elevated access |
| `RESEND_API_KEY` | `send-reminder` environment only | Secret email-provider credential |
| `REMINDER_FROM_EMAIL` | `send-reminder` environment | Sender configuration, not an authentication credential |

A publishable key, and the legacy `anon` key, identify public application access; they do not identify a particular signed-in person. A service-role key bypasses RLS and belongs only on trusted servers. User access/refresh tokens are also sensitive, even though the client must use them. Do not copy secrets into `VITE_` variables or Android build fields: users can inspect distributed apps. [Official key explanation](https://supabase.com/docs/guides/getting-started/api-keys)

**Read a real query:** `listAssessments(offeringId)` uses this chain:

```ts
const { data, error } = await requireSupabase()
  .from("assessments")
  .select("id,name,assessment_type,max_score,carry_weight,position")
  .eq("offering_id", offeringId)
  .order("position");
if (error) throw error;
```

This means “read these fields from assessments for this offering, sorted by position.” Supabase's data API is powered by **PostgREST**, which exposes PostgreSQL through web requests. The client does not hold a direct database password. The response is data plus a possible error. The service converts database names such as `max_score` into screen names such as `maxMarks`.

`.insert` creates, `.update` changes matching rows, `.delete` removes matching rows, and `.upsert` inserts or updates according to a unique key. Check filters carefully before writes. `.single()` expects one row; `.maybeSingle()` permits none. Nested selections such as `subjects(code,name)` follow database relationships.

Two different remote operations occur here:

```ts
db.rpc("finalise_section", { target_section: sectionId });
db.functions.invoke("send-reminder", { body: { staffNo } });
```

**RPC** means remote procedure call: run a database function. An **Edge Function** is a separate server program, suited here to credentials and external email calls. Removing `finalise_section` breaks finalisation; removing `send-reminder` breaks email reminders. Changing either requires checking its frontend caller and server implementation together.

This app uses Auth, database APIs, RLS, views, database functions, triggers, and Edge Functions. There is no application use of Supabase Storage for uploaded files, no database Realtime subscriptions, and no implemented scheduled reminder job in this repository.

**Remember/files:** `src/lib/supabase.ts`, `carryMarkApi.ts`, Android `data/SupabaseProvider.kt`, and `supabase/functions/`. For connection trouble check configuration, request errors, and deployed backend objects before rewriting the screen.

**Quiz:** (1) What does the client do? (2) Is a public key a user's identity? (3) What must remain server-only? (4) How does `.eq()` affect a query? (5) How does an RPC differ from an Edge Function?

**Exercise:** write a hypothetical read-only query for class section `id,label,capacity` belonging to one `offering_id`, ordered by label. Compare it to `loadOfferingData()` afterward.

## 6. Your database

**Start simple:** data is split into related tables so each fact has an appropriate home. A **row** is one record; a **column** is one named field. A **primary key** uniquely identifies a row. A **foreign key** points to an existing row in another table. Your IDs mostly use UUIDs—unique identifiers distinct from readable staff or matrix numbers.

An offering means one catalogue subject taught by one lecturer in one term. An enrolment means one student belonging to one class section. Therefore a mark belongs to an enrolment and assessment, not merely a student name.

```text
auth.users ── profiles (staff identity)
          └── students (via auth_user_id)
programmes ── subject_offerings / class_sections / students
subjects + academic_terms + lecturer profile → subject_offerings
subject_offerings → class_sections → enrolments ← students
subject_offerings → assessments
enrolments + assessments → marks → student_carry_totals view
class_sections → submissions
students + subject_offerings → mark_disputes
```

| Table | Purpose and principal users |
|---|---|
| `programmes` | Academic programme catalogue; joins teaching offerings, classes and students and supplies programme options to the portals |
| `profiles` | Staff number, name, role, active flag; AuthContext, admin reports and permissions |
| `students` | Matrix number, name, programme, linked Auth user; mobile identity and rosters |
| `academic_terms` | Year/semester, dates, defaults, eligibility threshold, current-term flag |
| `programme_deadlines` | Per-programme deadline for a term; settings service |
| `subjects` | Shared subject catalogue; lecturer creation and subject labels |
| `subject_offerings` | Lecturer/subject/term assignment and per-offering `carry_max` |
| `class_sections` | Offering's programme-specific class groups, schedule, capacity and join code |
| `enrolments` | Student-section membership with status |
| `assessments` | Offering's components, maximum raw score, carry weight and publication flag |
| `marks` | Score for an enrolment-assessment pair, entered-by identity and version |
| `submissions` | Class finalisation/reopening state; editing locks and monitoring |
| `notification_settings` | Saved term preferences; not proof that delivery is implemented |
| `notifications` | Staff notification table/policies; no active delivery/feed pipeline found |
| `audit_logs` | Records finalisation/reopening actions; not a full history of every change |
| `mark_disputes` | Student-reported issues; created through the student RPC |
| `staff_login_attempts` | Staff-ID lookup attempt window; accessed by privileged login logic |

Deleting these tables would break their listed consumers and potentially dependent relationships. To add a field, decide which fact it belongs to, add a migration, then update request/response types and affected screens. Do not put a class-specific fact on the shared subject catalogue.

A **constraint** is a rule the database checks. Examples: subject codes must be unique; assessment maximum scores must be positive; one mark exists per enrolment-assessment pair; one offering exists per subject/term/lecturer. Foreign keys prevent references to missing parents. `ON DELETE CASCADE` means deleting the parent also deletes dependent rows—assessment deletion can remove marks.

A **view** is a saved query presented like a table. `student_carry_totals` calculates:

```text
Each contribution = score ÷ assessment maximum × carry weight
Total carry = sum of contributions, rounded to two decimal places
Eligible = total carry >= academic term's eligible_threshold
```

Example: 16/20 with weight 10 contributes 8; 30/50 with weight 20 contributes 12. Total: 20. These are hypothetical scores. Missing scores add no contribution to the total, but finalisation checks for missing marks separately. `carry_max` is the offering's available carry total, not the denominator of each raw assessment score. Changing it does not automatically change the term's eligibility threshold.

A **trigger** automatically runs a function when a specified database change happens. `marks_validate` calls `validate_mark()` before insert/update: check matching offering, finalisation lock, score maximum, timestamp and version. Other triggers update timestamps or enforce assessment weight allocation. Removing a trigger can silently remove a guarantee even while the UI appears unchanged.

A **migration** is an ordered database change. The [initial schema](supabase/migrations/202609030001_initial_schema.sql) is only the starting point. Student access, recursion fixes, joining, mobile payloads, staff login and per-subject weightage are added later. The latest [weightage migration](supabase/migrations/202609180002_subject_carry_weightage.sql) replaces earlier function definitions. Search all definitions before deciding which behavior is current.

An **index** speeds selected lookups; unique indexes can also enforce uniqueness. A **transaction** groups operations so failure can roll them back together. The creation RPC uses database uniqueness to handle concurrent duplicate attempts. **Concurrency** means requests overlap; checking first in the UI alone cannot prevent two simultaneous inserts.

**Remember/files:** migrations define the intended database, `src/types/database.ts` describes it to TypeScript, and neither proves what is deployed. Preserve history by adding a new migration for future changes rather than silently rewriting an already-applied one.

**Quiz:** (1) Why separate subjects and offerings? (2) What identifies one mark? (3) What is a foreign key? (4) Is the carry view a separately stored total? (5) Does changing offering weightage change eligibility threshold?

**Exercise:** draw the path from a mark to its lecturer, then to its student. Name every table along the two paths.

## 7. Login, sessions, and permissions

**Authentication** checks who someone is. **Authorization** checks what that person may do. Successful login does not grant permission to every record.

A session uses an **access token**, a signed, time-limited credential sent with requests, and a **refresh token**, used to obtain replacement tokens. A JWT is the structured signed format used for the access token. The client manages refreshing; the exact live expiry/session settings are not established here. Signing out does not necessarily make every previously issued access token unusable immediately; expiry and server checks matter. [Official session explanation](https://supabase.com/docs/guides/auth/sessions)

**Staff journey:**

```text
WebLogin.handleLogin → AuthContext.login(staffNo, password)
→ staff-login Edge Function
→ resolve_staff_login_email RPC using server service-role access
→ profiles + auth.users identify the current registered email
→ Supabase Auth signInWithPassword verifies password
→ function checks active profile/role/ID and returns session tokens
→ frontend auth.setSession → loadProfile from profiles
→ setUser → navigate to role dashboard → use features
→ PortalLayout confirmation → AuthContext.logout → Auth signOut
→ clear user → navigate to /
```

Passwords are verified by Auth, not compared against `profiles`. The [login lookup migration](supabase/migrations/202609170002_staff_login_registered_email.sql) allows ten lookup attempts per known active account per 15-minute window. Its execute permission is restricted to `service_role`. A registered email change can preserve staff-ID login because the function resolves the email each time. The old `reminder_email` profile field is no longer used by the reminder function.

On refresh, `AuthProvider` calls `getSession()` and reloads the profile. Profile failure clears the session in that path. `ProtectedRoute` waits until loading finishes. Its listener clears the user when there is no session; it is not a complete refresh of profile changes on every Auth event.

**Student journey:** Android converts the matrix number to `<matrix>@student.uitm.edu.my`, signs in directly with Auth, then calls `get_my_mobile_portal`. The active student's `students.auth_user_id` must match the authenticated UUID. A successful Auth login without that linked student is insufficient. Accounts and password management are described in [ACCOUNT_MANAGEMENT.md](supabase/ACCOUNT_MANAGEMENT.md); the apps do not provide a complete account-registration/reset workflow.

**Database permissions:** a grant permits an operation on a table; **Row Level Security (RLS)** policies decide which rows that operation may affect. `auth.uid()` provides the authenticated user's UUID. A policy's `USING` expression tests accessible existing rows; `WITH CHECK` tests permitted new row values. Public frontend keys require correctly configured grants and policies. [Official RLS explanation](https://supabase.com/docs/guides/database/postgres/row-level-security)

Your actual helper families are `is_admin()`, `owns_offering()`, `is_current_student()` and `can_access_*()`. The [recursion-fix migration](supabase/migrations/202609040002_fix_student_rls_recursion.sql) moves relationship checks into helpers to avoid policies repeatedly calling each other through related tables.

**Security invoker** functions run with caller permissions. **Security definer** functions run with owner permissions and can bypass ordinary caller restrictions; their explicit identity checks therefore matter. `get_my_mobile_portal` is a definer function that starts by selecting the active student matching `auth.uid()`. `create_lecturer_subject` derives the lecturer from Auth rather than trusting a supplied lecturer ID. Your carry-total view uses `security_invoker = true`.

To modify a policy, first write who may select/insert/update/delete whose records. Then test as two different lecturers, two students, an admin and a signed-out caller. An elevated SQL editor session can bypass restrictions and is not a valid end-user permission test. Multiple permissive policies can broaden access; adding a narrow policy does not automatically restrict a broader existing one. See Part 11 for concrete gaps.

**Remember/files:** `AuthContext.tsx`, both clients, `staff-login/index.ts`, login migration and RLS migrations. Removing AuthContext loses staff session coordination; weakening database checks exposes data even if navigation still looks protected.

**Quiz:** (1) Authentication versus authorization? (2) Why can a staff email change without changing staff ID? (3) What links an Android user to a student record? (4) Why does a definer function need its own checks? (5) Does hiding an admin button secure the operation?

**Exercise:** predict what fails if an Auth user exists but its staff `profiles` row is missing. Trace the server and frontend checks instead of guessing from the login screen.

## 8. Lecturer features

**Start simple:** a lecturer sets up what is assessed, creates classes, records scores and marks each class complete. The key screen files are in [features/lecturer](src/features/lecturer/); most backend calls are in [carryMarkApi.ts](src/services/carryMarkApi.ts).

| User action | Actual flow | Important rule / extension point |
|---|---|---|
| Open My Subjects | `LecturerDashboard` → `listLecturerSubjects` → offerings plus nested subjects/terms/sections → `setSubjects` | Ownership filtering relies on RLS; query has no explicit current-term filter |
| Create subject | `createSubject` → `createLecturerSubject` → `create_lecturer_subject` → catalogue/offering → reload list | Active lecturer and active current term resolved on server; existing catalogue details reused |
| Set total weight | `AssessmentsTab.saveTotalWeight` → `saveOfferingWeightage` → `set_offering_carry_max` → offering | Greater than 0, at most 100, up to 2 decimals, not below allocated weights; finalised classes must be reopened |
| Add/edit assessment | Tab's `saveAssessment` → service `saveAssessment` → `assessments` → trigger → reload | Existing ID means update; otherwise insert. Trigger limits allocated weight |
| Create/edit class | `MarksEntryTab.saveSection` → `createSection`/`updateSection` → `class_sections` → reload | Programme is stored by foreign key; create supplies a random `JOIN-...` code; capacity constraints apply |
| Rotate invitation | `regenerateJoinCode` → `rotateJoinCode` → `rotate_class_join_code` → section | Owner/admin checked in function; latest definition qualifies random bytes with `extensions` |
| Load grid | `reload` → `loadOfferingData` + `loadOfferingWeightage` | Combines sections, enrolled students, submissions, marks and carry-total view |
| Edit score | `updateMark` → `upsertMark` → `marks` + validation trigger → local state update | Mark identified by enrolment/assessment; `entered_by` is authenticated staff UUID |
| Finalise class | `finalise` → `finaliseSection` → `finalise_section` → submissions/audit → reload | Total assessment weights must equal offering maximum; all enrolled students need all scores |
| Export | `ExportTab` → load offering data → `exportClass` → `downloadText` | CSV built in browser; no direct e-Res API integration found |

Removing a service/RPC breaks its row's action. For an extension, follow that row across UI, service, SQL and response update. For a bug, check which arrow first deviates from the expected result.

**Read the save carefully:** `updateMark()` limits input to the range 0 through `maxMarks`, then saves on each input change. Empty/invalid numeric input becomes 0 in this path. That is different from “mark not entered,” represented by missing/null data. The parameter named `studentId` in that handler actually carries an enrolment ID. Do not replace it with a matrix number.

`loadOfferingData()` is an assembly function: load assessments and sections, fetch enrolments/submissions, fetch marks/totals, then create screen-friendly nested objects. `Promise.all` runs independent requests together. Removing this assembly breaks both the marks grid and exports. To add an existing database field to those screens, fetch it here and include it in the returned shape.

**Finalisation is class-level:** it writes a submission and audit log, but does not update `subject_offerings.status` to completed. The subject card and admin monitor therefore consult different status sources. Reopening exists as the admin-only database function `reopen_section(reason)`, but there is no staff UI caller in the inspected frontend.

**Publication gap:** new assessments default to `is_published = false`. The current assessment save function does not set it, and there is no publication control in that tab. The mobile payload only includes published assessment details, although its total uses the carry-total view. Finalisation does not publish them. This explains a possible “total exists, breakdown missing” symptom.

**Rebuild exercise idea:** first display one class, then add one score input, then save with `upsertMark`, then handle failure, then reload server totals. Only after those steps add finalisation. This lets you verify one boundary at a time.

**Remember:** raw maximum, assessment weight, offering carry maximum and eligibility threshold are four different values. Recognize `AssessmentsTab`, `MarksEntryTab`, `ExportTab`, `create_lecturer_subject`, `validate_mark` and `finalise_section`.

**Quiz:** (1) Where is the lecturer for a new offering decided? (2) Which two fields identify a mark? (3) Why can finalisation reject saved scores? (4) Does finalisation publish assessment details? (5) Does export send data directly to e-Res?

**Exercise:** calculate a hypothetical student's carry total for 18/20 weighted 10 and 35/50 weighted 20. Predict finalisation with offering maximum 60 and only those two assessments.

## 9. Administrator features

**Start simple:** the admin portal summarizes lecturer submissions; it is not a complete management screen for every database table.

[useAdminRecords](src/hooks/useAdminRecords.ts) reads active lecturer profiles and related offerings/classes/submissions. It calculates the percentage of class sections finalised for each lecturer. A lecturer counts as finalised only with at least one section and every section finalised. `AdminDashboard` calculates faculty compliance from lecturer-level statuses. Read the denominator before interpreting a percentage.

The hook supplies `AdminDashboard`, `SubmissionMonitor`, `LecturerDirectory`, `ComplianceReports` and the portal badge through separate Hook calls. Removing it breaks these summaries. It loads on mount, without Realtime updates. To add a metric, define its counting rule first, then change this mapping and the consumers. For inconsistent counts, inspect enrolment statuses, terms and grouping rather than changing display labels.

**Deadline limitation:** the hook uses the earliest explicit offering deadline; it does not load programme or term defaults to calculate overdue status. Its fallback text “Default term deadline” is not an actual fallback calculation. Monitoring and manual reminders also have no current-term filter.

**Reminder flow:**

```text
AdminDashboard / SubmissionMonitor → useReminders.sendReminder(staffNo)
→ send-reminder Edge Function → validate token with Auth
→ verify active admin profile → find active lecturer
→ privileged Auth lookup resolves recipient email
→ query offerings/classes/submissions under caller permissions
→ pendingSections + reminderText → Resend API
→ accepted response → sentReminders state → “Email Queued”
```

An **idempotency key** identifies repeated attempts at the same action so the provider can suppress duplicate sends. The function uses one key per lecturer per hour. Its request timeout is 20 seconds. Provider acceptance does not prove inbox delivery. Changing the recipient or content during the same key window can produce a provider rejection; see [Supabase README](supabase/README.md).

The service-role client exists to retrieve Auth account information after checking the caller. Do not move that lookup or Resend credentials into React. Both functions have `verify_jwt = false` in configuration: `staff-login` is public password login; `send-reminder` performs its own token and active-admin checks. The configuration alone does not make the reminder function unrestricted.

**Settings:** `AdminSettings` loads and saves via `loadSystemSettings`/`saveSystemSettings`. The service separately updates the academic term, programme deadlines and notification preferences. These are multiple requests, so a later failure can leave earlier changes saved. A future all-or-nothing save belongs in one validated database operation. Automatic reminder and student/admin notification preferences are stored, but no corresponding scheduler/push delivery pipeline is implemented here.

**Reports:** `ComplianceReports.exportReport` builds CSV from lecturer summary records. Even “Full Carry Mark Summary” uses lecturer/enrolment/submission summaries, not all individual marks. Several export names/labels hardcode semester information. Fixing those would require reading the relevant term rather than merely renaming the download button.

**Remember/files:** both hooks, `AdminSettings.tsx`, `ComplianceReports.tsx`, `send-reminder/index.ts` and `email.mjs`. Treat “configured,” “requested,” “accepted,” and “delivered” as different stages.

**Quiz:** (1) What counts as a finalised lecturer? (2) Does the hook resolve default deadlines? (3) Where is recipient email decided? (4) Is queued equal to delivered? (5) Does saving automatic-reminder preferences schedule anything?

**Exercise:** design a current-term-only monitor. Identify the query/filter location, which term ID is needed and why the reminder function must use the same scope.

## 10. Android student app

**Start simple:** the Android code separates drawing screens, coordinating actions and making requests. All paths below are under `student-mobile/app/src/main/java/my/edu/uitm/carrymark/`.

| Piece | Role, callers and failure consequence | How to modify/debug |
|---|---|---|
| [MainActivity.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/MainActivity.kt) | Android starts `onCreate` → `StudentApp`; draws login/dashboard/progress/settings/detail/dispute screens | Start here for controls/navigation; removing it breaks launch |
| [StudentViewModel.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/StudentViewModel.kt) | Screen callbacks call login, refresh, join, dispute, sign-out; holds `StudentUiState` | Start here for stuck loading/errors/state; removal loses action coordination |
| [StudentRepository.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/data/StudentRepository.kt) | ViewModel calls it to communicate with Auth and three RPCs | Start here for request names/parameters; removal loses backend operations |
| [SupabaseProvider.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/data/SupabaseProvider.kt) | Repository obtains client configured with Auth and Postgrest modules | Check build configuration for connection failures |
| [Models.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/model/Models.kt) | Repository decodes backend response into Student/SubjectResult/Assessment | Keep field names/types aligned with SQL payload |
| [Theme.kt](student-mobile/app/src/main/java/my/edu/uitm/carrymark/ui/theme/Theme.kt) | Supplies fonts/colors/styles to Compose screens | Appearance changes belong here where shared |

**Kotlin vocabulary:** `val` names a value that cannot be reassigned; `var` permits reassignment; `fun` defines a function; `String?` permits null. A `data class` groups data. `@Composable` marks a function participating in Compose UI. A **ViewModel** holds screen state across common Android lifecycle changes. A **coroutine** lets work suspend without blocking the screen; `suspend fun` can participate in such work. `StateFlow` exposes the latest state and subsequent updates. `runCatching { ... }.onSuccess { ... }.onFailure { ... }` handles success/failure.

The app observes `studentViewModel.state.collectAsStateWithLifecycle()`. Changes to that state update the interface. **Serialization** converts between structured network data and Kotlin objects; `@SerialName("carry_mark")` maps a backend name to `carryMark`. A changed SQL response may require changed models and screens.

**Read journey:** login → repository Auth request → `get_my_mobile_portal` → JSON payload → `StudentPortalPayload` → ViewModel state → dashboard. JSON is a text format for objects/lists. The RPC returns the active student's profile and enrolled offerings, lecturer names, totals, thresholds, finalisation and published assessment details. It currently supplies a hardcoded faculty and derives “academic advisor” from the first lecturer by subject code, not a true advisor relationship.

**Join journey:** class code → `JoinClassDialog` → ViewModel `joinClass` → repository RPC `join_class_by_code` → resolve active student and section → check offering status, duplicate enrolment and capacity → insert/reactivate enrolment → reload portal → update screen. The duplicate check is per offering, not globally per catalogue subject.

**Dispute journey:** `DisputeScreen` → ViewModel `submitDispute` → repository → `submit_mark_dispute` → verify active student/enrolment/nonblank text → insert `mark_disputes` → success dialog. There is no implemented staff dispute resolution UI. Assessment is submitted as a text name rather than an assessment foreign key.

Navigation uses a remembered `Screen` value. On resume, signed-in apps call `refresh()`, not a Realtime subscription. Detail/dispute routes store a `SubjectResult` object; those screens can retain an old object even if the ViewModel refreshes its subject list. Storing an ID and selecting current data would address that design limitation.

Other visible limitations: the login “remember me” argument is ignored by `StudentApp`; notification rows display a constant on-state; the notification dropdown is derived from loaded subjects, not delivered push messages. Some numeric displays convert to integers or round to whole numbers, while the backend retains decimals.

**Remember:** screen → ViewModel → repository → Supabase → state → screen. To extend an existing payload field, trace that route backward from its display.

**Quiz:** (1) Which file sends RPCs? (2) What does StateFlow supply? (3) Why use `@SerialName`? (4) When does resume refresh run? (5) Does a success dialog imply staff can resolve disputes in this website?

**Exercise:** plan a read-only “my submitted disputes” screen. Predict the query, model, repository method, ViewModel state and navigation changes before writing code. Check existing RLS before assuming a new policy is required.

## 11. Debugging, security, and safe changes

**Start simple:** debugging means finding the first place actual behavior differs from expected behavior. Follow evidence before changing code.

1. Reproduce one action and record role, offering/class and input.
2. Find the screen handler by searching the button text or function name.
3. Inspect the browser's Network panel, which records requests/responses, and Console, which records errors. On Android use Logcat, its log viewer. Avoid sharing passwords/tokens.
4. Read the service/repository and identify table or RPC.
5. Read the latest SQL definition, constraints, grants, policies and triggers.
6. Check returned data and the state update. A successful save can still be followed by a failed refresh.
7. Change the smallest responsible piece and check both success and failure behavior.

| Symptom | First places to inspect |
|---|---|
| “Supabase not configured” | Web environment names and `requireSupabase`; restart/rebuild after config changes |
| Staff cannot log in | Network response → `staff-login` deployment/secrets → lookup migration → Auth account/profile mapping |
| Correct password but no student profile | `students.auth_user_id`, active flag, portal RPC |
| Empty subject list | Signed-in identity, RLS, offerings and linked catalogue/term records |
| Assessment insert fails | Offering weightage, allocation trigger, unique name/position; new position is currently count + 1 and can collide after deletion |
| Student total but no breakdown | `is_published`, latest mobile RPC, frontend publication gap |
| Mark save fails | Enrolment/assessment IDs, `entered_by`, maximum, finalised submission and policy |
| Finalisation fails | Weight sum versus carry maximum; missing/null marks |
| Wrong compliance/deadline | `useAdminRecords` scope, counting and missing default-deadline resolution |
| Email fails | Function Auth/role checks, Resend sender/secrets, provider response and hourly key |
| Missing errors in UI | `.catch(console.error)` or unhandled async handlers in marks/export/settings |
| Android detail stays stale | Stored subject object in `Screen.Detail`, not just refresh success |

**Confirmed source-level security/integrity gaps, not live exploit tests:**

| Finding and evidence | Why it matters | Intended correction direction |
|---|---|---|
| `owns_offering` checks lecturer UUID, not active staff status ([initial schema](supabase/migrations/202609030001_initial_schema.sql)) | Disabled staff with a usable token may retain owner-policy access | Enforce active role in all relevant backend paths; test existing sessions |
| Finalisation trigger covers mark insert/update, while owner policies permit deletes and assessment changes | Finalised results can be changed indirectly or removed | Enforce locks for deletion, assessment edits and related operations; test cascades |
| Assessment/mark read policies lack publication checks ([access policies](supabase/migrations/202609040002_fix_student_rls_recursion.sql)) | Hiding unpublished details in the mobile RPC is not a confidentiality boundary | Decide visibility rules, then apply them consistently to direct reads, totals and RPCs |
| `join_class_by_code` counts capacity before insertion without serializing concurrent joins | Overlapping joins may exceed capacity; per-offering duplicate checks also need concurrency protection | Lock the relevant class/offering or redesign constraints; test simultaneous joins |
| CSV helpers quote fields but do not neutralize spreadsheet formulas (`ExportTab`, `ComplianceReports`) | Untrusted text may be interpreted as a formula by spreadsheet software | Define spreadsheet-safe export handling for formula-leading cells and test it |

Also review inherited database-function execution privileges: PostgreSQL's `PUBLIC` role means all roles. Several older migrations revoke from `anon` without revoking `PUBLIC`. Actual exposure depends on effective live privileges and function-body checks. Do not conclude that a function is private from one revoke line; inspect all grants and test callers.

**Other correctness gaps worth maintaining:** rapid score saves can finish out of order; deleting an assessment can make count-based ordering collide; settings saves are not atomic; semester parsing splits on `/` and can lose part of a year such as `2025/2026`; mobile weights are returned as integers; exported semester labels are hardcoded. Android sign-out catches errors but clears UI state regardless; web logout does not inspect the returned Auth error. Showing login is not alone proof that sign-out succeeded. These are improvement candidates, not changes made here.

**Validation** means checking input against rules. The frontend provides early feedback; backend constraints/functions provide enforcement. Example: the assessment form prevents excess weight, and the database trigger checks it too. Never fix a denied request by broadly disabling RLS.

**Existing checks:** inspect [tests](tests/), [function tests](supabase/functions/) and [SQL tests](supabase/tests/). The JavaScript tests exercise selected handlers with mocked dependencies; they do not prove live Auth/RLS/email delivery. SQL scripts create fixtures in a transaction and roll back; run them against an appropriate test database with the needed migrations, not casually against production.

```sh
# From the repository root, when you are ready to verify a future change:
node --test tests/*.test.mjs supabase/functions/*/*.test.mjs
npm run build
```

These commands were not run for this documentation-only task. A Vite build confirms bundling, not comprehensive TypeScript checking or security. There is no dedicated type-check script in the current package file.

For a future change: inspect `git diff`; understand existing user work; make a focused edit; run relevant checks; manually verify the affected flow. For database changes add a migration, test permitted and forbidden operations, and update client types. Keep deployment separate from local editing: changing a SQL file does not apply it to Supabase, and changing an Edge Function file does not deploy it.

**Remember/files:** start at the failing boundary; preserve errors; test with actual roles. Recognize the migrations, service, ViewModel and test directories rather than treating every issue as a screen bug.

**Quiz:** (1) What should you inspect before changing code after a failed save? (2) Does a successful build prove RLS works? (3) Why test as two lecturers? (4) Why is a count-before-insert capacity check insufficient? (5) Why can a hidden assessment still be readable?

**Exercise:** investigate “new assessment doesn't appear on Android” on paper. List three possible causes and the evidence that would distinguish them. Do not change publishing rules until you define who should see what and when.

## 12. Independent development and project defense

**Start simple:** ownership means you can justify a change, locate its layers, implement it, and verify its effects. Reading this file is preparation, not evidence that you have mastered those skills.

For any feature, answer: What is it? Why does it exist? Where is it used? Who calls it? What happens? What breaks without it? What must stay true? How would I extend it? Where would I debug it? The flow tables above are starting maps; practise answering without looking.

**A small feature to build later:** show a section's remaining capacity beside its invitation code. First predict the file and calculation yourself. Then inspect `MarksEntryTab` and `loadOfferingData`: capacity and enrolled student records already reach the screen. A display can derive `capacity - enrolled count`; no new table is inherently needed. Decide how to display over-capacity data. This display does not fix concurrent joining. Verify empty, partially filled, full and over-capacity cases.

**A backend exercise:** plan assessment publication. Define whether students may see draft totals and whether finalisation publishes details. Add owner/admin authorization, implement a controlled publish operation, align direct RLS reads and mobile payload visibility, connect the UI, and test an enrolled student plus an unrelated student. This is intentionally harder: a new button alone cannot enforce publication privacy.

**Likely defense questions and grounded answers:**

| Question | Answer to understand, not memorize |
|---|---|
| What is the architecture? | React staff website and Kotlin/Compose student app share Supabase Auth/PostgreSQL; two Edge Functions handle staff-ID login and manual email reminders. |
| Why use Supabase? | Managed identity/data APIs reduce infrastructure work while PostgreSQL holds shared relationships and rules. Tradeoff: deployment/configuration and permission correctness still need deliberate management. |
| Why separate subject and offering? | Catalogue details are shared; lecturer, academic term, class groups and assessments belong to a teaching offering. |
| How are carry marks calculated? | Sum each raw score divided by its assessment maximum times its carry weight; round the total to two decimals. Eligibility compares with a term threshold. |
| How do both apps agree? | Stored records and database calculations are shared. The web also calculates an immediate display total after saving, so consistency must be tested. |
| How is access enforced? | Auth identifies the user; grants, RLS and checked database/server functions enforce permissions. ProtectedRoute only controls the website. |
| Why are there Edge Functions? | Staff-ID login privately resolves the registered email; reminders require private Auth lookup and email credentials. |
| How does student class joining work? | A checked RPC resolves the active student, finds the code, checks membership/capacity and saves enrolment, then the app refreshes. Concurrency checks need strengthening. |
| Is it real time? | It loads from the shared backend at specific events, including Android resume; there are no application Realtime subscriptions. |
| Are reminders automatic? | Manual email is implemented. Automatic settings exist without a scheduler in this repository. |
| Are disputes fully managed? | Students can submit them; staff resolution is not implemented in the current UI. |
| What is tested? | Selected frontend handlers, login/reminder handlers with mocks, and SQL creation/weightage cases. This is not complete end-to-end coverage. |
| What would you improve first? | Close permission/finalisation/publication gaps, then address data consistency and misleading unfinished controls, based on verified requirements. |

**Readiness test:** without assistance, locate a feature, trace it to tables, explain one handler and one policy, write a read query, reproduce a failure, make a small reversible change and verify it. Then explain the architecture in two minutes, naming limitations honestly. If you cannot justify a step, return to that section; completing chapters is not the same as passing this test.

**Remember/files:** use the whole flow, not just the component. For the first feature recognize `MarksEntryTab.tsx` and `carryMarkApi.ts`; for backend changes recognize migrations and tests.

**Quiz:** (1) Does remaining-capacity display require a stored column? (2) Why doesn't it enforce capacity? (3) Which layers change for publication privacy? (4) Name one implemented and one unfinished feature. (5) What evidence would demonstrate independent ownership?

**Exercise:** write a five-step plan for the remaining-capacity feature before opening its implementation. Include input data, formula, display location, edge cases and verification. Only implement after you can explain the plan.

## Check your answers

Try first. These are short checks, not substitutes for explaining the reasoning. If your answer differs, trace the cited implementation and identify the first disagreement.

| Part | Quiz answers, in question order |
|---|---|
| 4 | No; it updates memory. Dependencies trigger effect reruns when changed. Ref changes do not render and can guard overlapping calls immediately. No, separate Hook instances. Local state is discarded. |
| 5 | Sends backend requests/manages Auth. No. Service-role/Resend secrets; also protect user tokens. Filters matching records. RPC runs SQL function; Edge Function runs server code. |
| 6 | Shared catalogue versus lecturer/term instance. Enrolment plus assessment. Reference to another table's key. No, calculated query results. No, threshold stays term-based. |
| 7 | Identity versus permission. Server resolves current Auth email. `students.auth_user_id`. Elevated function rights require explicit caller checks. No. |
| 8 | Database derives it from `auth.uid()`. `enrolment_id,assessment_id`. Missing scores or weights not matching maximum, among other validation failures. No. No, CSV download. |
| 9 | At least one class and all classes finalised. No. Server from linked Auth account. No. No. |
| 10 | StudentRepository. Latest state and updates. Map network names to Kotlin properties. On resume when signed in. No. |
| 11 | Request/response and error plus relevant handler. No. To prove ownership isolation. Concurrent requests can both see room. Direct read policies may permit it despite UI/RPC filtering. |
| 12 | No, existing fields allow a derived display. It cannot serialize server writes. UI, service/RPC, direct policies/payload and tests. Example: manual reminders versus automatic scheduler. Independently tracing, implementing, debugging and verifying a change. |

**Exercise checks:**

- Part 4: local boolean and filter of the selected section's students; no database write unless a persistent preference is explicitly required.
- Part 5: `db.from("class_sections").select("id,label,capacity").eq("offering_id", offeringId).order("label")`, then inspect `error`. Use a configured client and a real permitted offering ID.
- Part 6: mark → assessment → offering → lecturer profile; mark → enrolment → student. The enrolment also reaches the offering through its class section.
- Part 7: the lookup cannot find the joined active profile/Auth record, so staff login is denied; frontend profile loading also requires that row.
- Part 8: contributions 9 and 14, total 23. Allocated weight is 30, not 60, so finalisation fails even with every score present.
- Part 9: obtain the intended current term and scope offerings/counts consistently in `useAdminRecords`; apply matching scope in the reminder server query to avoid sending for other terms.
- Part 10: read `mark_disputes` under student RLS, model its fields, add repository/ViewModel/screen handling; existing student-read policy may already suffice. Test cross-student isolation.
- Part 11: unpublished row, wrong offering/enrolment, or outdated payload/model/data are distinct possibilities. Inspect saved row, RPC response and screen state to distinguish them.
- Part 12: use existing capacity and enrolled count, derive remaining places, show beside code, explicitly handle full/overfull classes, and verify boundary cases without claiming the display enforces database capacity.

When asking for help later, quote the section, name the file/function, state your prediction and show the observed result. That keeps follow-up questions small and makes each answer improve your own debugging skill.
