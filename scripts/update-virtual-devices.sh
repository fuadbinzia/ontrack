#!/usr/bin/env bash
# Build onTrack once per platform and install that build on every onTrack-owned
# simulator/emulator without uninstalling the app or erasing device data.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IOS_BUNDLE_ID="com.imtihoss.ontracknow"
ANDROID_PACKAGE="com.imtihoss.ontracknow"

IOS_NAMES=(
  "onTrack Agent 1"
  "onTrack Agent 2"
  "onTrack Agent 3"
  "onTrack Agent 4"
  "onTrack iPhone 17 Pro"
)
ANDROID_NAMES=(
  "Galaxy_S26"
  "onTrack_Agent_1"
  "onTrack_Agent_2"
  "onTrack_Agent_3"
  "onTrack_Agent_4"
)

DO_IOS=1
DO_ANDROID=1
BUILD=1
CURRENT_ONLY=0

# shellcheck source=lib/virtual-device-build.sh
source "$ROOT/scripts/lib/virtual-device-build.sh"
IOS_APP="$(vd_ios_app)"
ANDROID_APK="$(vd_android_apk)"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Usage: scripts/update-virtual-devices.sh [--ios|--android] [--install-only] [--current]

  --ios           Update only onTrack iOS simulators.
  --android       Update only onTrack Android emulators.
  --install-only  Reuse the newest validated local debug build.
  --current       Refresh the current sim/emu plus onTrack iPhone 17 Pro and
                  Galaxy_S26. Used by agent-ui verify.

Unrelated Apple simulator templates and Android AVDs are never touched.
Initially stopped devices are stopped again after installation. Android AVDs
are updated sequentially to stay within the host memory budget.
EOF
}

while (($# > 0)); do
  case "$1" in
    --ios) DO_IOS=1; DO_ANDROID=0 ;;
    --android) DO_IOS=0; DO_ANDROID=1 ;;
    --install-only) BUILD=0 ;;
    --current) CURRENT_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

declare -a TEMP_IOS_UDIDS=()
declare -a ORIGINAL_ANDROID_NAMES=()
declare -a ORDERED_ANDROID_NAMES=()
ORIGINAL_ANDROID_WINDOW=0
ANDROID_RESTORE_NEEDED=0

shutdown_temporary_ios() {
  local udid
  for udid in "${TEMP_IOS_UDIDS[@]:-}"; do
    [[ -n "$udid" ]] && xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  done
  TEMP_IOS_UDIDS=()
}

restore_original_android() {
  ((ANDROID_RESTORE_NEEDED == 1)) || return 0
  ((${#ORIGINAL_ANDROID_NAMES[@]} == 1)) || return 0
  local name="${ORIGINAL_ANDROID_NAMES[0]}"
  echo "Restoring originally running Android AVD: $name"
  if [[ "$ORIGINAL_ANDROID_WINDOW" == "1" ]]; then
    ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= \
      bash "$ROOT/scripts/ensure-android-emulator.sh" --window </dev/null || true
  else
    ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= \
      bash "$ROOT/scripts/ensure-android-emulator.sh" </dev/null || true
  fi
  ANDROID_RESTORE_NEEDED=0
}

cleanup() {
  local status=$?
  shutdown_temporary_ios
  restore_original_android
  exit "$status"
}
trap cleanup EXIT INT TERM

resolve_ios_devices() {
  xcrun simctl list devices available -j | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const wanted = new Set(process.argv.slice(1));
      const devices = Object.values(JSON.parse(input).devices).flat();
      for (const device of devices) {
        if (wanted.has(device.name)) {
          process.stdout.write(`${device.name}\t${device.udid}\t${device.state}\n`);
        }
      }
    });
  ' "${IOS_NAMES[@]}"
}

update_ios() {
  ((BUILD == 0)) || build_ios
  validate_ios_app
  node "$ROOT/scripts/resign-ios-simulator-app.js" "$IOS_APP"

  local rows name udid state count=0
  rows="$(resolve_ios_devices)"
  for name in "${IOS_NAMES[@]}"; do
    if ! printf '%s\n' "$rows" | awk -F '\t' -v wanted="$name" '$1 == wanted { found=1 } END { exit !found }'; then
      echo "error: required iOS simulator is unavailable: $name" >&2
      return 1
    fi
  done

  while IFS=$'\t' read -r name udid state; do
    [[ -n "$udid" ]] || continue
    if [[ "$state" != "Booted" ]]; then
      echo "Booting $name for installation…"
      xcrun simctl boot "$udid"
      xcrun simctl bootstatus "$udid" -b
      TEMP_IOS_UDIDS+=("$udid")
    fi
    xcrun simctl terminate "$udid" "$IOS_BUNDLE_ID" >/dev/null 2>&1 || true
    xcrun simctl install "$udid" "$IOS_APP"
    xcrun simctl get_app_container "$udid" "$IOS_BUNDLE_ID" app >/dev/null
    echo "Updated iOS: $name"
    count=$((count + 1))
  done <<< "$rows"

  shutdown_temporary_ios
  echo "iOS simulators updated: $count"
}

record_running_android() {
  # shellcheck source=lib/android-emulator.sh
  source "$ROOT/scripts/lib/android-emulator.sh"
  local adb_bin serial name
  adb_bin="$(android_emu_sdk_bin adb)"
  while IFS= read -r serial; do
    [[ -n "$serial" ]] || continue
    name="$($adb_bin -s "$serial" emu avd name 2>/dev/null | awk 'NF && $0 != "OK" { print; exit }')"
    case "$name" in
      Galaxy_S26|onTrack_Agent_1|onTrack_Agent_2|onTrack_Agent_3|onTrack_Agent_4) ;;
      *) continue ;;
    esac
    ORIGINAL_ANDROID_NAMES+=("$name")
    if ONTRACK_ANDROID_AVD="$name" android_emu_is_headless "$name"; then
      ORIGINAL_ANDROID_WINDOW=0
    else
      ORIGINAL_ANDROID_WINDOW=1
    fi
  done < <("$adb_bin" devices | awk '/^emulator-[0-9]+[[:space:]]+device/ { print $1 }')

  if ((${#ORIGINAL_ANDROID_NAMES[@]} > 1)); then
    echo "error: more than one onTrack Android AVD is running; stop extras before syncing all builds" >&2
    return 1
  fi
  ((${#ORIGINAL_ANDROID_NAMES[@]} == 0)) || ANDROID_RESTORE_NEEDED=1
}

android_was_running() {
  local wanted="$1" name
  for name in "${ORIGINAL_ANDROID_NAMES[@]:-}"; do
    [[ "$name" == "$wanted" ]] && return 0
  done
  return 1
}

prepare_ordered_android_names() {
  local name
  ORDERED_ANDROID_NAMES=()
  for name in "${ANDROID_NAMES[@]}"; do
    android_was_running "$name" || ORDERED_ANDROID_NAMES+=("$name")
  done
  for name in "${ORIGINAL_ANDROID_NAMES[@]:-}"; do
    [[ -n "$name" ]] && ORDERED_ANDROID_NAMES+=("$name")
  done
  return 0
}

update_android() {
  # shellcheck source=lib/android-emulator.sh
  source "$ROOT/scripts/lib/android-emulator.sh"
  local emu_bin adb_bin name serial count=0 leave_running=0
  emu_bin="$(android_emu_sdk_bin emulator)"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$emu_bin" && -n "$adb_bin" ]] || { echo "error: Android SDK tools not found" >&2; return 1; }

  for name in "${ANDROID_NAMES[@]}"; do
    "$emu_bin" -list-avds | grep -qx "$name" || {
      echo "error: required Android AVD is unavailable: $name" >&2
      return 1
    }
  done
  record_running_android
  prepare_ordered_android_names
  ((BUILD == 0)) || build_android
  [[ -s "$ANDROID_APK" ]] || { echo "error: missing Android APK: $ANDROID_APK" >&2; return 1; }

  for name in "${ORDERED_ANDROID_NAMES[@]}"; do
    leave_running=0
    if android_was_running "$name"; then
      leave_running=1
    fi
    if ((leave_running == 1)) && [[ "$ORIGINAL_ANDROID_WINDOW" == "1" ]]; then
      ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= \
        bash "$ROOT/scripts/ensure-android-emulator.sh" --window </dev/null
    else
      ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= \
        bash "$ROOT/scripts/ensure-android-emulator.sh" </dev/null
    fi
    serial="$(ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial)"
    [[ -n "$serial" ]] || { echo "error: no adb serial for $name" >&2; return 1; }
    "$adb_bin" -s "$serial" install -r -d "$ANDROID_APK" >/dev/null
    "$adb_bin" -s "$serial" shell pm path "$ANDROID_PACKAGE" | grep -q '^package:'
    echo "Updated Android: $name ($serial)"
    count=$((count + 1))
    if ((leave_running == 0)); then
      ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_shutdown_named "$name"
    else
      ANDROID_RESTORE_NEEDED=0
    fi
  done

  echo "Android emulators updated: $count"
}

if ((CURRENT_ONLY == 1)); then
  if ((DO_IOS == 1)); then
    # shellcheck source=lib/ios-simulator.sh
    source "$ROOT/scripts/lib/ios-simulator.sh"
    vd_ensure_current_device_native_fresh ios
  fi
  if ((DO_ANDROID == 1)); then
    vd_ensure_current_device_native_fresh android
  fi
  trap - EXIT INT TERM
  echo "Current onTrack virtual device plus iPhone 17 Pro / Galaxy_S26 have the latest local native build."
  exit 0
fi

((DO_IOS == 0)) || update_ios
((DO_ANDROID == 0)) || update_android

trap - EXIT INT TERM
echo "All requested onTrack virtual devices have the latest local native builds."
