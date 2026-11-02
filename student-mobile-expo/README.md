# CAMS — Student Expo app

Cross-platform React Native student app for the Continuous Assessment Monitoring System. It shares the existing Supabase backend with the staff portal.

## Architecture

- Expo SDK 58, React Native and TypeScript
- Expo Router routes in `src/app`
- `StudentContext` owns authenticated portal state and refresh behavior
- `studentApi` calls the existing secured Supabase RPCs
- Supabase Google OAuth sessions are stored in Expo SecureStore
- Active-semester, subject, assessment, released-mark and notification data comes from `get_my_mobile_portal()`

The app uses only the Supabase publishable key. Never add a service-role key or `RESEND_API_KEY` here.

## Configure

Copy `.env.example` to `.env.local` and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_PUSH_TEST_MODE=false
```

The Supabase project must have the repository migrations applied, including `202610280001_student_google_oauth.sql`, the current `get_my_mobile_portal()`, `join_class_by_code(text)` and `submit_mark_dispute(uuid,text,text)` functions and their backend authorization.

Enable the Google provider in Supabase Auth and add `cmms://auth/callback` to
**Authentication > URL Configuration > Additional Redirect URLs**. OAuth uses
the configured native `cmms` scheme on both Android and iOS. Test it with a
development, preview or production build: Expo Go does not contain this app's
custom native scheme and therefore cannot receive this callback reliably. Enable
the `public.hook_restrict_student_google_domain` **Before User Created** Auth
hook so non-`@student.uitm.edu.my` Google identities are rejected before an Auth
user is created.

## Hidden demo login

The normal student sign-in remains Google OAuth. For a temporary development
demo, set `EXPO_PUBLIC_DEMO_MODE=true`, restart Expo, and tap the CAMS logo five
times within 2.5 seconds. This reveals a small **Continue as Demo Student** action.

Demo credentials are never bundled into Expo. Configure them as Supabase Edge
Function secrets and deploy the development-only function:

```sh
npx supabase secrets set \
  DEMO_LOGIN_ENABLED=true \
  DEMO_STUDENT_EMAIL=prepared-demo@student.uitm.edu.my \
  DEMO_STUDENT_PASSWORD='replace-with-the-demo-password' \
  --project-ref YOUR_PROJECT_REF

npx supabase functions deploy student-demo-login \
  --no-verify-jwt \
  --project-ref YOUR_PROJECT_REF
```

The function signs in through Supabase Auth, validates that the account resolves
to a real active student portal profile, and returns the ordinary access/refresh
session. RLS therefore remains active. Google and demo sessions both persist in
the existing chunked Expo SecureStore adapter, and Supabase refreshes expired
access tokens using the stored refresh token. Demo restoration loads the existing
student portal instead of Google's onboarding RPC. Manual sign-out clears local
auth data; a temporary startup/network error retains it and offers a retry.

Before production, set `EXPO_PUBLIC_DEMO_MODE=false` in the production build and
`DEMO_LOGIN_ENABLED=false` in Supabase secrets (or delete the Edge Function).

## Run

```bash
cd student-mobile-expo
npm install
npm start
```

Android development build:

```bash
npx expo run:android
```

iOS development build on macOS with Xcode:

```bash
npx expo run:ios
```

Cloud development builds:

```bash
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
```

For a standalone Android APK without Metro or developer tooling, use:

```sh
npx eas-cli@latest build --profile preview --platform android
```

The preview profile uses the EAS `preview` environment and the existing Android
signing credentials. Its public Supabase configuration must be present in that
environment. Google OAuth, push notifications, demo login (when enabled), and
the `cmms` callback use the same app code. Install the APK and launch it directly;
no `expo start` is needed.

The production profile produces an AAB for Google Play:

```sh
npx eas-cli@latest build --profile production --platform android
```

Configure public Supabase variables separately in the EAS `production`
environment before building. An AAB is uploaded to Play rather than installed
directly. See [the binary size audit](docs/android-size-audit.md) for measured
development/release sizes and packaging trade-offs.

The normal app can be previewed with Expo Go. Some push-notification behavior requires a development or production build.

## EAS Update

`expo-updates` is configured for the existing EAS project with isolated `preview`
and `production` build channels. The `fingerprint` runtime policy automatically
separates updates when native dependencies/configuration change, protecting
installed builds from incompatible JavaScript. Keep dependency lockfiles and
native configuration consistent between a build and its compatible updates.

Build and install one new preview APK to enable updates; older APKs built before
this configuration cannot acquire the native update client through an update:

```sh
cd student-mobile-expo
npx eas-cli@latest build --profile preview --platform android
```

For later compatible JavaScript/UI/bundled asset changes, publish explicitly to
the preview channel using the same EAS environment as the APK:

```sh
npx eas-cli@latest update --channel preview --environment preview --platform android --message "Describe the UI change"
```

The `--environment preview` flag uses the EAS preview variables (including the
public Supabase configuration and demo/test flags), rather than relying on a
developer's `.env.local`. Production uses the separate `production` channel and
environment; configure its public variables before building/publishing there.

The app checks on launch without waiting for the network before displaying the
embedded/cached application. A downloaded update normally runs on the following
launch. To test a future published update, open the app online, let it download,
then fully close and reopen it. No update was published during this setup.

Native packages/SDK upgrades, permissions, config-plugin changes, launcher
icons/splash, app name, package/bundle/scheme changes, or Firebase native config
still require a new native build. Ordinary React Native screen styling, text,
business JavaScript and bundled in-app images can update when compatible with
the installed runtime. EAS Update does not deploy Supabase migrations/functions.

## Migrated behavior

- Google OAuth restricted to official `@student.uitm.edu.my` accounts
- Server-derived Student ID and first-login profile onboarding
- Secure session persistence and seven-day inactivity expiry
- Current-semester dashboard, class joining and refresh
- Subject and assessment details
- Marks/carry total shown only after backend finalisation
- Mark issue submission
- Subject bar chart and dynamic component-type radar chart
- Supabase in-app finalisation notifications
- Profile/settings, theme and logout

## Platform limitations

- Remote push notifications require a physical-device development/production
  build and valid FCM credentials on Android. Expo Go does not support remote
  push on current SDKs. iOS delivery additionally requires paid Apple Developer
  push credentials. The app remains usable when permission or credentials are
  unavailable; marks and in-app data are unaffected.

## Student push notifications

Apply `202610290004_student_push_notifications.sql` and deploy the secured
function:

```sh
npx supabase functions deploy send-student-push --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

Apply `202611010001_student_push_webhook.sql` to connect `marks_released`
notification inserts to the Edge Function through asynchronous `pg_net`.
Provision a matching random `PUSH_WEBHOOK_SECRET` Edge Function secret and
`cams_push_webhook_secret` database Vault secret; store the function URL in
Vault as `cams_push_webhook_url`. These have been provisioned in the linked
CAMS project. No additional Dashboard webhook is needed there. Do not create
a second webhook for the same event. Server credentials never belong in Expo.

For enhanced Expo push security, create an Expo access token and store it only
as `EXPO_ACCESS_TOKEN` in Supabase Edge Function secrets. Set
`PUSH_TEST_ENABLED=true` server-side and `EXPO_PUBLIC_PUSH_TEST_MODE=true` in a
development build to expose the rate-limited self-test in Settings. Disable both
flags for production.

Android requires an FCM V1 service account configured in EAS and the matching
Firebase `google-services.json`. `app.config.js` loads the local file when
present, or the path supplied through the EAS `GOOGLE_SERVICES_JSON` file
environment variable, into `expo.android.googleServicesFile`.
The default path is explicitly `./google-services.json` in `app.json`.
Android EAS builds fail with an actionable error if the file is missing, and
configuration rejects a Firebase client file for another Android package.
After adding native credentials/configuration, rebuild and reinstall the
development client. iOS requires an APNs push key and paid Apple Developer
membership.

### Android Firebase/EAS checklist

1. Create or select a Firebase project. Add an Android app with package
   `my.edu.uitm.carrymark.student`. Analytics, Firebase Auth, and Firestore are
   not required. SHA fingerprints are not required for this FCM-only setup.
2. Download that Android app's `google-services.json` from Firebase Project
   settings > General and place it at `student-mobile-expo/google-services.json`.
   This is client configuration, not the service-account key. It can be
   committed because it contains public identifiers; alternatively use an EAS
   file variable named `GOOGLE_SERVICES_JSON` available to the build environment.
3. Confirm Firebase Cloud Messaging API (V1) is enabled for that project.
   Under Project settings > Service accounts, generate a private key for the
   service account authorized for Firebase Cloud Messaging. Keep this private
   file outside the repository or inside the ignored `credentials/` folder.
4. Run `npx eas-cli@latest credentials --platform android`. Choose the build
   profile/application, then Google Service Account > Manage your Google Service
   Account Key for Push Notifications (FCM V1) > Upload a new service account key.
   Use the same Firebase project as the client configuration file.
5. Run `npx eas-cli@latest build --profile development --platform android`,
   install the resulting build on the physical phone, then run
   `npx expo start --dev-client --clear`. Sign in and allow notification permission.

Changing JavaScript or clearing Metro alone cannot add Firebase configuration
to an already installed Android build. Supabase remains the app's authentication
and database backend; FCM only transports Android notifications from Expo.
