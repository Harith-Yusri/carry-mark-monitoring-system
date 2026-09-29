#!/bin/zsh

set -euo pipefail

ANDROID_SDK_PATH="${ANDROID_SDK_ROOT:-/Users/harithyusri/Library/Android/sdk}"
ANDROID_ADB="$ANDROID_SDK_PATH/platform-tools/adb"

launchctl remove my.edu.uitm.carrymark.emulator >/dev/null 2>&1 || true

if [[ -x "$ANDROID_ADB" ]]; then
  "$ANDROID_ADB" devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1 }' | while read -r emulator_serial; do
    "$ANDROID_ADB" -s "$emulator_serial" emu kill >/dev/null 2>&1 || true
  done
fi

echo "Android emulator stopped."
