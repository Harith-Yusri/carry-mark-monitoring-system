# CAMS localization — 19 November 2026

CAMS now has bundled, offline interface translations for English, Bahasa Melayu, Simplified Chinese and Tamil, plus Auto detection. The implementation uses i18next 27.2.1 with a small React `useSyncExternalStore` adapter; no translation API, extra native module, database migration, RPC change, permission change or academic calculation change is involved.

## Interface and preference behavior

Staff have a globe dropdown in the portal header and on sign-in/registration. Students have Language in Settings, with an accessible native choice dialog. Manual choices apply immediately, without remounting the authenticated app, losing typed form content or triggering academic requests. The shared key `cams.language.v1` is stored in browser localStorage for Staff and SecureStore for the native Student app. Expo web uses localStorage. Auto itself is remembered; it does not store a detected locale as a manual override.

Auto matches browser preference tags, or the device's standard Intl default locale, against en/ms/zh/ta subtags (for example ms-MY, zh-Hans, ta-IN). Chinese variants use the available Simplified Chinese translation. Unsupported tags fall back to English; missing translations also use English. Browser language changes and native app foregrounding redetect only when Auto is selected. Manual preference wins over detection and delayed asynchronous storage restore. Rapid writes are serialized. Storage failure leaves the selected session language usable; mobile Settings reports the failed save.

There are 764 entries per dictionary. CAMS-generated interface text is translated; names, programme/subject/assessment/class values, explanations, lecturer responses and correction reasons remain unchanged. Templates interpolate these values without recursively interpreting translation syntax. The notification formatter matches complete CAMS sentence templates against existing subject/assessment data and retains their embedded dynamic values. Unknown messages keep an English/source fallback. Existing CSV formats and externally delivered push/email bodies remain unchanged. Native OS/browser permission and built-in validation dialogs follow the OS/browser language.

## Screens and files

- Shared resources/engine: `student-mobile-expo/src/locales/{en,ms,zh,ta}.json`, locales README, `student-mobile-expo/src/localization/{core.ts,react.tsx,LanguageSetting.tsx}`.
- Staff adapter/control: `src/localization/{react.tsx,LanguageSelect.tsx}`, `src/app/App.tsx`, `src/layouts/PortalLayout.tsx`, `src/components/StaffDataState.tsx`.
- Staff auth: `WebLogin.tsx`, `WebRegister.tsx`.
- Admin: dashboard/overview, Submission Monitor and filters, Lecturer Directory, Reports & Exports, Past Semesters, System Settings, shared status badges, sidebar navigation and associated dialogs.
- Lecturer: My Subjects/current and reachable archived detail, Subject Hub, assessment structure/create/edit dialogs, Marks Entry & Eligibility/class dialogs, export preview, Mark Issues and history, exact Released mark correction panel, bell inbox, loading/error/confirmation states.
- Student: startup, sign-in landing, OAuth callback, onboarding, tabs/navigation, My Subjects/join class/in-app notifications, My Progress/charts, subject and individual assessment detail, mark reporting/history/outcomes, Settings/profile/theme/notification controls/Language, shared cards/fields/errors/avatar accessibility text.
- Dependencies: both package manifests/locks add the same pure JavaScript i18next version. Root lock preserves unrelated dependency versions.
- Tests: existing isolated component harnesses import a real-English translator helper; `tests/localization.test.mjs`, `tests/localization-mobile.test.mjs`, `tests/helpers/localization.mjs`, `scripts/audit-localization.cjs`, `scripts/check-localization.cjs` add coverage. Existing assertions about marks, statuses and request behavior stay intact.
- Small existing Staff type errors exposed by the requested check were fixed: auth controls use the existing `maroon` theme token, and `src/types/database.ts` declares the already-deployed `delete_my_lecturer_subject` signature. No RPC implementation was changed.

Obsolete/unreachable Kotlin and legacy component screens were excluded. Unrelated existing working-tree drafts are preserved and excluded from the Staff source/release. Android preview continues the existing process of bundling the mobile working tree, preserving its previously deployed mobile UI drafts rather than replacing their appearance with the older clean source baseline.

## Verification

- Catalogue keys and interpolation parity; Auto tags/default/fallback; manual override; reopening; delayed restore; repeated choices; serial persistence; storage failures; missing-key fallback; dynamic names/nested translation syntax and CAMS notifications.
- Native screen render tests cover all four locales and both themes, using native/context boundaries as fixtures, including data names deliberately equal to UI labels. Student report descriptions/responses remain unchanged; native adapter tests exercise the actual SecureStore integration with a storage fixture.
- Production Staff browser checks: 18 localization scenarios across both roles/themes and four locales, current Admin tabs, Lecturer Hub/mark issues/correction form, translated sign-in, repeated switching, unchanged network call counts and score, unchanged form input, Auto and unsupported fallback, preference after reload. Tamil screenshots checked at desktop and 390px width; no page overflow in the correction scenario.
- Existing browser loading regression: 10 scenarios. Existing exact Released mark edit and lecturer bell suites also pass, including both themes and narrow layouts. Requests/WebSockets in these browser tests are synthetic and intercepted, not live academic writes.
- Native pixels/device receipt and native OS dialogs have not been tested on physical hardware. Translation copy has not had independent native-speaker review. Browser screenshot and native render/style checks do not claim full device accessibility certification.

## Build and deployment results

Implementation source commit: `be5e7e4c56b611c5764235fb7d168b78136f9436` (pushed to main). The complete implementation file manifest and artifact hashes are in `docs/localization-release-2026-11-19.json`.

- `node --test tests/*.test.mjs`: **102/102** in the working tree, **87/87** in the isolated source release (the working tree also has pre-existing draft tests).
- Staff no-emit TypeScript, mobile `npx tsc --noEmit`, mobile `npm run lint`: **pass**, lint with no warnings. Staff has no configured ESLint command; its source was checked with TypeScript, literal-text audit and browser suites.
- Staff `npm run build`: **pass**. Entry JavaScript is 743,807 bytes / approximately 206.3 kB gzip, including all four offline dictionaries. Vite emits its normal >500 kB chunk advisory. Page modules remain lazy-loaded; the dictionaries are intentionally available without a runtime translation request.
- Android `npx expo export --platform android`: **pass**; EAS also performed a successful Android bundle export for publication. No new native dependency or binary.
- Staff Wrangler dry-run and deploy: **success**, existing Worker `cams-staff`, https://unicams.online. Version `bcea46b6-d0bb-433f-bfaf-e73ecd36d8ff`. Live sign-in/registration/dashboard SPA routes and entry JS/CSS were verified byte-for-byte against the isolated release. Live sign-in/registration dropdowns were exercised in every locale.
- EAS Android **preview** publication: **success**. Update `01a1f3be-f9e5-706f-bb43-f8d6fe89e371`; group `4b12b9ef-1cee-4f93-8fc6-a52b84a58458`. The preview channel's newest group was independently queried after publication. Runtime `29797fbf5d8d4b0719c4a4c7ac7f9cff2d863c05` matches the existing Android preview build and the pre/post-localization fingerprints. No iOS/store/production-channel release or physical-device OTA receipt is claimed.
- No Supabase migration was required or applied. Existing pending unrelated migrations were not deployed.
