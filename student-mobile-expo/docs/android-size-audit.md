# Android binary size audit — 1 November 2026

All MB figures below are decimal (1 MB = 1,000,000 bytes). MiB uses
1,048,576 bytes. APK size, unpacked ZIP contents, and Android Settings storage
are different measurements.

## Measured baseline

Latest existing EAS development build: `c145147a-d4f7-44ee-8130-7319ec6a5dfa`.

- Artifact: **283,663,921 bytes = 283.66 MB = 270.52 MiB**.
- ZIP entry contents before compression: **318.10 MB**.
- Native `.so` libraries: **256.50 MB**, stored uncompressed for direct loading.
- Architectures: arm64-v8a, armeabi-v7a, x86, x86_64.
- Manifest: `debuggable`, package `my.edu.uitm.carrymark.student`.
- Android installed storage was not measured: no physical device was connected.
- A separate older local arm64-only debug APK is 81.93 MB; this is not the
  current EAS universal development artifact and is not a release comparison.

### Ten largest contributors in the development APK

Native totals combine all four architectures. DEX unpacked size differs from
its compressed APK footprint.

| Contributor | Unpacked MB | Stored APK MB |
| --- | ---: | ---: |
| React Native `libreactnative.so` | 84.34 | 84.34 |
| DEX Java/Kotlin code | 54.99 | 21.24 |
| Reanimated | 32.78 | 32.78 |
| Barcode scanner `libbarhopper_v3.so` | 20.22 | 20.22 |
| Worklets | 19.43 | 19.43 |
| App/codegen modules | 18.87 | 18.87 |
| Hermes runtime | 16.53 | 16.53 |
| Native screen/navigation codegen | 14.03 | 14.03 |
| SVG codegen | 8.59 | 8.59 |
| Expo modules core | 6.78 | 6.78 |

The barcode scanner is a debug-only dependency of Expo Dev Launcher. Dev Menu
also contributes Inter/JetBrains Mono fonts (2.20 MB); CAMS uses system fonts.
There are no bundled student-app audio/video files. Optional GIF/WebP-related
entries total about 3.30 MB in this development artifact.

## Measured optimized preview

EAS release build `c0bcdfc9-7566-40b2-be40-e5d10516d10c` completed successfully
with `:app:assembleRelease`, R8, and resource shrinking (18m 31s Gradle build).

- APK: **96,978,210 bytes = 96.98 MB = 92.49 MiB**.
- Reduction from development APK: **186.69 MB / 65.81%**.
- Unpacked ZIP contents: **100.03 MB** (not installed application storage).
- Native libraries: **86.10 MB**, still covering all four architectures.
- DEX: **6.37 MB unpacked / 2.84 MB stored**, down from 54.99 / 21.24 MB.
- Bundled Hermes JavaScript: **4.53 MB**; runs without Metro. A separate local
  production export with the installed dev-client package produced 5.74 MB.
- Manifest is non-debuggable and has no Dev Launcher/Dev Menu activity.
- Barcode native library and custom development fonts are absent.
- Hermes support libraries are retained; no manual `.so` exclusion was used.
- Package, `cmms` scheme, FirebaseInitProvider, Expo Firebase messaging service,
  and notification permission are present.
- Signing certificate SHA-256 matches the prior EAS development build:
  `cf2e53f9d1992b268d13a34e2655540cd5fbcf3ce3af072f4b6f53339adbc51b`.
- Bundle checks confirm the existing public Supabase URL/key, hidden demo-login
  code, token registration, and WhatsApp link handling are included.

[Download the standalone preview APK](https://expo.dev/artifacts/eas/PAsxYBSKhq5cgo1KRUwwV4JqgWHaRoRk6DgXBk21Y3E.apk)

Production AAB was **not built**. A compression-only model using the release
APK's native libraries gives a roughly 39.53 MB ZIP payload. A provisional AAB
upload estimate is **40–60 MB**, not a measured result: protobuf resources,
bundle metadata, debug-symbol metadata, compression, and signing differ. This
also does not estimate the Play download or installed storage for a specific
device; measure those with bundletool/Play after producing the actual AAB.

Installing the signed preview APK is required to use this size reduction.
Because it uses the same package and signing certificate, it can update the
existing EAS app without intentionally clearing student/session data. Keep the
development APK available if Metro debugging is needed later.

## Build profiles and safe changes

- `development`: dev client APK, for Metro/debugging.
- `preview`: standalone release APK, `developmentClient: false`, internal
  distribution. Bundles JavaScript and runs without Metro.
- `production`: standalone release AAB, for Play distribution. An AAB is not
  directly installable; Play delivers device-specific architecture/resource
  splits. Its upload size is not the user's download/installed size.

`expo-build-properties` applies R8 release minification and Android resource
shrinking through generated native configuration. GIF, static WebP, and
animated WebP extensions are disabled because CAMS only renders PNG assets and
SVG icons/charts, with no remote media UI. Launcher WebP resources are handled
by Android itself, not these optional React Native image decoders.

The existing public Supabase URL/key and demo/test flags were configured in the
EAS **preview** environment to match the working local app. No service-role key
or other backend secret is bundled. Production environment configuration is
separate and must be supplied before a production build.

## Optimizations intentionally avoided

- No architecture removals: keep compatibility and use Play splits for stores.
- Keep `expo-dev-client` installed: its debug tooling is omitted from release
  variants; removing it would break the development workflow.
- No manual removal of navigation peer/native modules (Reanimated, Worklets,
  gesture handling) without a separate navigation compatibility investigation.
- Keep Hermes, FCM, SecureStore, OAuth/browser/linking, SVG, and all app features.
- Keep `useLegacyPackaging: false` and default bundle compression; reducing APK
  bytes by compression can trade off startup/loading or installed extraction.
- No lossy logo compression or deletion of unused source assets: source-folder
  size is not APK size, and unused assets are already excluded from bundles.
- No broad dependency upgrades, signing changes, or business-logic changes.

## Reproduce measurements

```sh
python3 scripts/analyze-android-artifact.py /path/to/app.apk
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
```

Use Android's APK Analyzer for a graphical view. The included Python script
reads ZIP metadata without modifying/extracting the artifact and also supports
AABs. Compare the same architecture coverage, build type, and measurement units.

Release verification includes typecheck/lint, an Android Hermes bundle export,
resolved native properties, and the EAS preview build. Runtime verification of
Google OAuth, push/tap navigation, and app data still requires installing the
signed release on a physical phone. CAMS uses browser-based Supabase Google
OAuth with its existing `cmms://auth/callback`; do not change the package,
signing key, or callback scheme.
