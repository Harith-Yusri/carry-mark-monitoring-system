# UiTM CAMS Student — Expo

Cross-platform React Native student app for the Continuous Assessment Monitoring System. It shares the existing Supabase backend with the staff portal.

## Architecture

- Expo SDK 58, React Native and TypeScript
- Expo Router routes in `src/app`
- `StudentContext` owns authenticated portal state and refresh behavior
- `studentApi` calls the existing secured Supabase RPCs
- Supabase Auth tokens are stored in Expo SecureStore only when **Keep me signed in** is selected
- Active-semester, subject, assessment, released-mark and notification data comes from `get_my_mobile_portal()`

The app uses only the Supabase publishable key. Never add a service-role key or `RESEND_API_KEY` here.

## Configure

Copy `.env.example` to `.env.local` and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The Supabase project must have the repository migrations applied, including the current `get_my_mobile_portal()`, `join_class_by_code(text)` and `submit_mark_dispute(uuid,text,text)` functions and their backend authorization.

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

The normal app can be previewed with Expo Go. Some push-notification behavior requires a development or production build.

## Migrated behavior

- Student ID/password authentication using the UiTM student email convention
- Optional secure persistence and seven-day inactivity expiry
- Current-semester dashboard, class joining and refresh
- Subject and assessment details
- Marks/carry total shown only after backend finalisation
- Mark issue submission
- Subject bar chart and dynamic component-type radar chart
- Supabase in-app finalisation notifications
- Profile/settings, theme and logout

## Platform limitations

- The existing notification flow supplies in-app notifications through Supabase. Remote push delivery would need a push-token table, RLS and a trusted server/Edge Function; none is invented here.
