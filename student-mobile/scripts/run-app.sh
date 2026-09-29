#!/bin/zsh

set -euo pipefail

ANDROID_SDK_PATH="${ANDROID_SDK_ROOT:-/Users/harithyusri/Library/Android/sdk}"
ANDROID_ADB="$ANDROID_SDK_PATH/platform-tools/adb"
ANDROID_EMULATOR="$ANDROID_SDK_PATH/emulator/emulator"
ANDROID_AVD="${CARRYMARK_AVD:-Medium_Phone}"
ANDROID_PROJECT="${0:A:h:h}"
ANDROID_JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
EMULATOR_LOG="/tmp/carrymark-android-emulator.log"

if [[ ! -x "$ANDROID_ADB" || ! -x "$ANDROID_EMULATOR" ]]; then
  echo "Android SDK tools were not found at: $ANDROID_SDK_PATH"
  exit 1
fi

"$ANDROID_ADB" start-server >/dev/null

EMULATOR_SERIAL=$("$ANDROID_ADB" devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')

if [[ -z "$EMULATOR_SERIAL" ]]; then
  echo "Starting Android emulator: $ANDROID_AVD"
  launchctl remove my.edu.uitm.carrymark.emulator >/dev/null 2>&1 || true
  launchctl submit \
    -l my.edu.uitm.carrymark.emulator \
    -o "$EMULATOR_LOG" \
    -e "$EMULATOR_LOG" \
    -- "$ANDROID_EMULATOR" -avd "$ANDROID_AVD"

  while [[ -z "$EMULATOR_SERIAL" ]]; do
    sleep 1
    EMULATOR_SERIAL=$("$ANDROID_ADB" devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')
  done

  echo "Waiting for Android to finish starting..."
  while [[ "$("$ANDROID_ADB" -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; do
    sleep 1
  done
fi

echo "Building and updating CarryMark..."
cd "$ANDROID_PROJECT"
JAVA_HOME="$ANDROID_JAVA_HOME" ./gradlew :app:installDebug

echo "Opening CarryMark..."
"$ANDROID_ADB" -s "$EMULATOR_SERIAL" shell am force-stop my.edu.uitm.carrymark
"$ANDROID_ADB" -s "$EMULATOR_SERIAL" shell am start -n my.edu.uitm.carrymark/.MainActivity

EMULATOR_PID=$(pgrep -f "qemu-system.*-avd $ANDROID_AVD" | head -n 1 || true)
if [[ -n "$EMULATOR_PID" ]]; then
  osascript -e "tell application \"System Events\" to set frontmost of first process whose unix id is $EMULATOR_PID to true" >/dev/null 2>&1 || true
fi

echo "CarryMark is running on $EMULATOR_SERIAL."
