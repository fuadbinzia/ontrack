#!/usr/bin/env bash
# Shared debug-client build + current-device install for sim/emu testing.
# Sourced by update-virtual-devices.sh and agent-ui host/packager.

: "${VD_BUNDLE_ID:=com.imtihoss.ontracknow}"
: "${VD_IOS_USER_SIM:=onTrack iPhone 17 Pro}"
: "${VD_ANDROID_USER_AVD:=Galaxy_S26}"

vd_repo_root() {
  if [[ -n "${VD_ROOT:-}" ]]; then
    printf '%s\n' "$VD_ROOT"
    return 0
  fi
  if [[ -n "${AGENT_UI_ROOT:-}" && -f "${AGENT_UI_ROOT}/scripts/ensure-packager.sh" ]]; then
    printf '%s\n' "$AGENT_UI_ROOT"
    return 0
  fi
  if [[ -n "${ROOT:-}" && -f "${ROOT}/scripts/ensure-packager.sh" ]]; then
    printf '%s\n' "$ROOT"
    return 0
  fi
  printf '%s\n' "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
}

vd_ios_app() {
  printf '%s\n' "$(vd_repo_root)/ios/build/Build/Products/Debug-iphonesimulator/onTrack.app"
}

vd_android_apk() {
  printf '%s\n' "$(vd_repo_root)/android/app/build/outputs/apk/debug/app-debug.apk"
}

vd_freshness_js() {
  printf '%s\n' "$(vd_repo_root)/scripts/lib/native-build-freshness.js"
}

vd_stamp_dir() {
  local dir
  dir="$(vd_repo_root)/.cursor/native-fresh"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

vd_stamp_path() {
  local platform="$1" device_id="$2"
  local safe
  safe="$(printf '%s' "$device_id" | tr -c 'A-Za-z0-9._-' '_')"
  printf '%s/%s-%s\n' "$(vd_stamp_dir)" "$platform" "$safe"
}

vd_read_stamp() {
  local path="$1"
  [[ -f "$path" ]] || { printf '\n'; return 0; }
  tr -d '\n' <"$path"
}

vd_write_stamp() {
  local path="$1" identity="$2"
  printf '%s\n' "$identity" >"$path"
}

vd_artifact_identity() {
  local path="$1"
  node "$(vd_freshness_js)" identity --path "$path"
}

vd_rebuild_needed() {
  local platform="$1" artifact="$2"
  local extra=()
  if [[ "${AGENT_UI_NATIVE_REBUILD:-0}" == "1" ]]; then
    extra+=(--force)
  fi
  node "$(vd_freshness_js)" rebuild-needed \
    --root "$(vd_repo_root)" \
    --platform "$platform" \
    --artifact "$artifact" \
    "${extra[@]+"${extra[@]}"}"
}

vd_install_needed() {
  local installed="$1" stamp="$2" identity="$3"
  node "$(vd_freshness_js)" install-needed \
    --installed "$installed" \
    --stamp "$stamp" \
    --artifact-id "$identity"
}

validate_ios_app() {
  local app="${1:-$(vd_ios_app)}"
  [[ -d "$app" ]] || { echo "error: missing iOS app: $app" >&2; return 1; }
  [[ -f "$app/Info.plist" ]] || { echo "error: incomplete iOS app (no Info.plist)" >&2; return 1; }
  local executable
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Info.plist")"
  [[ -n "$executable" && -x "$app/$executable" ]] || {
    echo "error: incomplete iOS app (missing executable)" >&2
    return 1
  }
}

vd_ios_identity_file() {
  local app="${1:-$(vd_ios_app)}"
  local executable
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Info.plist" 2>/dev/null || true)"
  if [[ -n "$executable" && -f "$app/$executable" ]]; then
    printf '%s\n' "$app/$executable"
    return 0
  fi
  printf '%s\n' "$app/Info.plist"
}

build_ios() {
  local root
  root="$(vd_repo_root)"
  echo "Building onTrack for Apple Silicon iOS simulators…"
  bash "$root/scripts/ensure-ios-simulator-codesign.sh"
  xcodebuild \
    -workspace "$root/ios/onTrack.xcworkspace" \
    -scheme onTrack \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath "$root/ios/build" \
    ARCHS=arm64 \
    ONLY_ACTIVE_ARCH=YES \
    CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY='Apple Development: onTrack Local' \
    build
}

build_android() {
  local root
  root="$(vd_repo_root)"
  echo "Building onTrack Android debug APK…"
  (cd "$root/android" && ./gradlew :app:assembleDebug)
}

vd_ensure_ios_artifact() {
  local app
  app="$(vd_ios_app)"
  if [[ "$(vd_rebuild_needed ios "$app")" == "1" ]]; then
    echo "agent-ui: iOS debug client stale vs native sources — rebuilding…" >&2
    build_ios
  fi
  [[ -d "$app" ]] || return 1
  validate_ios_app "$app"
  node "$(vd_repo_root)/scripts/resign-ios-simulator-app.js" "$app"
}

vd_ensure_android_artifact() {
  local apk
  apk="$(vd_android_apk)"
  if [[ "$(vd_rebuild_needed android "$apk")" == "1" ]]; then
    echo "agent-ui: Android debug client stale vs native sources — rebuilding…" >&2
    build_android
  fi
  [[ -s "$apk" ]] || return 1
}

vd_install_ios_udid() {
  local udid="$1" app="${2:-$(vd_ios_app)}"
  [[ -n "$udid" ]] || return 1
  validate_ios_app "$app"
  xcrun simctl terminate "$udid" "$VD_BUNDLE_ID" >/dev/null 2>&1 || true
  if command -v ios_simctl_timed >/dev/null 2>&1; then
    ios_simctl_timed 90 install "$udid" "$app" >/dev/null
  else
    xcrun simctl install "$udid" "$app"
  fi
  xcrun simctl get_app_container "$udid" "$VD_BUNDLE_ID" app >/dev/null
}

vd_install_android_serial() {
  local serial="$1" apk="${2:-$(vd_android_apk)}"
  local root adb_bin
  [[ -n "$serial" && -s "$apk" ]] || return 1
  root="$(vd_repo_root)"
  # shellcheck source=android-emulator.sh
  source "$root/scripts/lib/android-emulator.sh"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  "$adb_bin" -s "$serial" install -r -d "$apk" >/dev/null
  "$adb_bin" -s "$serial" shell pm path "$VD_BUNDLE_ID" | grep -q '^package:'
}

vd_ios_user_sim_name() {
  printf '%s\n' "${ONTRACK_IOS_VIEWER_SIMULATOR:-$VD_IOS_USER_SIM}"
}

vd_android_user_avd_name() {
  printf '%s\n' "${ONTRACK_ANDROID_USER_AVD:-$VD_ANDROID_USER_AVD}"
}

# Print "udid<TAB>state" for an available simulator name, or empty.
vd_ios_lookup_named() {
  local name="$1"
  xcrun simctl list devices available -j 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
data = json.load(sys.stdin)
booted = []
available = []
for devices in data.get("devices", {}).values():
    for device in devices:
        if device.get("name") != name or device.get("isAvailable") is False:
            continue
        entry = (device.get("udid") or "", device.get("state") or "")
        if not entry[0]:
            continue
        available.append(entry)
        if entry[1] == "Booted":
            booted.append(entry)
chosen = (booted or available)
if not chosen:
    raise SystemExit(0)
udid, state = chosen[-1]
print(f"{udid}\t{state}")
' "$name"
}

vd_android_serial_for_avd() {
  local name="$1" root
  [[ -n "$name" ]] || return 1
  root="$(vd_repo_root)"
  # shellcheck source=android-emulator.sh
  source "$root/scripts/lib/android-emulator.sh"
  ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial
}

# Install onto a specific iOS UDID when the stamp lags. Echoes "1" if replaced.
vd_refresh_ios_udid() {
  local udid="$1" app="$2" identity="$3" label="${4:-$1}"
  local installed=0 stamp_file stamp
  [[ -n "$udid" && -n "$identity" ]] || return 1
  if xcrun simctl get_app_container "$udid" "$VD_BUNDLE_ID" data >/dev/null 2>&1; then
    installed=1
  fi
  stamp_file="$(vd_stamp_path ios "$udid")"
  stamp="$(vd_read_stamp "$stamp_file")"
  if [[ "$(vd_install_needed "$installed" "$stamp" "$identity")" != "1" ]]; then
    printf '0\n'
    return 0
  fi
  echo "agent-ui: installing latest iOS debug client onto ${label}…" >&2
  vd_install_ios_udid "$udid" "$app" || return 1
  vd_write_stamp "$stamp_file" "$identity"
  printf '1\n'
}

vd_refresh_android_serial() {
  local serial="$1" apk="$2" identity="$3" label="${4:-$1}"
  local installed=0 stamp_file stamp root adb_bin
  [[ -n "$serial" && -n "$identity" && -s "$apk" ]] || return 1
  root="$(vd_repo_root)"
  # shellcheck source=android-emulator.sh
  source "$root/scripts/lib/android-emulator.sh"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  if "$adb_bin" -s "$serial" shell run-as "$VD_BUNDLE_ID" true >/dev/null 2>&1; then
    installed=1
  fi
  stamp_file="$(vd_stamp_path android "$label")"
  stamp="$(vd_read_stamp "$stamp_file")"
  if [[ "$(vd_install_needed "$installed" "$stamp" "$identity")" != "1" ]]; then
    printf '0\n'
    return 0
  fi
  echo "agent-ui: installing latest Android debug client onto ${label}…" >&2
  vd_install_android_serial "$serial" "$apk" || return 1
  vd_write_stamp "$stamp_file" "$identity"
  printf '1\n'
}

# Sidecar install onto the user's headed devices. Never binds verify to them.
# iOS Pro may be booted just for install (then shut down if we started it)
# when the caller is refreshing iOS. Galaxy is updated only when already
# running — never boot it beside an agent AVD.
vd_refresh_user_devices() {
  local platform="${1:-both}"
  if [[ "$platform" == "ios" || "$platform" == "both" ]]; then
    VD_BOOT_USER_IOS=1 vd_refresh_user_ios || true
  else
    VD_BOOT_USER_IOS=0 vd_refresh_user_ios || true
  fi
  vd_refresh_user_android || true
}

vd_refresh_user_ios() {
  local app name row udid state booted_temp=0 identity current
  app="$(vd_ios_app)"
  [[ -d "$app" ]] || return 0
  validate_ios_app "$app" || return 0
  identity="$(vd_artifact_identity "$(vd_ios_identity_file "$app")")"
  [[ -n "$identity" ]] || return 0
  name="$(vd_ios_user_sim_name)"
  row="$(vd_ios_lookup_named "$name")"
  [[ -n "$row" ]] || {
    echo "agent-ui: user iOS simulator '${name}' is unavailable — skip app update" >&2
    return 0
  }
  udid="${row%%$'\t'*}"
  state="${row#*$'\t'}"
  current="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  if [[ -n "$current" && "$current" != "booted" && "$current" == "$udid" ]]; then
    return 0
  fi
  if [[ "$state" != "Booted" ]]; then
    if [[ "${VD_BOOT_USER_IOS:-1}" != "1" ]]; then
      echo "agent-ui: ${name} is not running — skip app update" >&2
      return 0
    fi
    echo "agent-ui: booting ${name} for app update…" >&2
    xcrun simctl boot "$udid" >/dev/null 2>&1 || true
    xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
    booted_temp=1
  fi
  vd_refresh_ios_udid "$udid" "$app" "$identity" "$name" >/dev/null || true
  if ((booted_temp == 1)); then
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  fi
}

vd_refresh_user_android() {
  local apk name serial identity current
  apk="$(vd_android_apk)"
  [[ -s "$apk" ]] || return 0
  identity="$(vd_artifact_identity "$apk")"
  [[ -n "$identity" ]] || return 0
  name="$(vd_android_user_avd_name)"
  current="${ONTRACK_ANDROID_AVD:-}"
  if [[ "$current" == "$name" ]]; then
    return 0
  fi
  serial="$(vd_android_serial_for_avd "$name" 2>/dev/null || true)"
  if [[ -z "$serial" ]]; then
    echo "agent-ui: ${name} is not running — skip app update (will not boot beside agent AVDs)" >&2
    return 0
  fi
  vd_refresh_android_serial "$serial" "$apk" "$identity" "$name" >/dev/null || true
}

# Install the latest local debug client onto the current sim/emu, then the
# user's Pro / Galaxy. Sets AGENT_UI_NATIVE_REFRESHED=1 when the current
# (agent) binary was replaced — never because a user device was updated.
vd_ensure_current_device_native_fresh() {
  AGENT_UI_NATIVE_REFRESHED=0
  if [[ "${AGENT_UI_SKIP_NATIVE_FRESH:-0}" == "1" ]]; then
    echo "agent-ui: skipping native build refresh (AGENT_UI_SKIP_NATIVE_FRESH=1)" >&2
    return 0
  fi

  local platform="${1:-}"
  if [[ -z "$platform" ]]; then
    if [[ "${AGENT_UI_PLATFORM:-}" == "android" || "${ONTRACK_PACKAGER_TARGET:-}" == "android" ]]; then
      platform=android
    else
      platform=ios
    fi
  fi

  if [[ "$platform" == "android" ]]; then
    vd_ensure_current_android_native_fresh || return 1
  else
    vd_ensure_current_ios_native_fresh || return 1
  fi
  vd_refresh_user_devices "$platform"
}

vd_ensure_current_ios_native_fresh() {
  local app udid identity replaced
  app="$(vd_ios_app)"
  if [[ ! -d "$app" ]]; then
    if [[ "$(vd_rebuild_needed ios "$app")" == "1" ]]; then
      vd_ensure_ios_artifact || return 1
    else
      return 0
    fi
  elif [[ "$(vd_rebuild_needed ios "$app")" == "1" ]]; then
    vd_ensure_ios_artifact || return 1
  else
    validate_ios_app "$app" || return 1
  fi

  udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  if [[ -z "$udid" || "$udid" == "booted" ]]; then
    if command -v ios_sim_resolve_udid >/dev/null 2>&1; then
      udid="$(ios_sim_resolve_udid 2>/dev/null || true)"
    elif command -v ios_sim_preferred_booted_udid >/dev/null 2>&1; then
      udid="$(ios_sim_preferred_booted_udid 2>/dev/null || true)"
    fi
  fi
  if [[ -n "$udid" && "$udid" != "booted" ]]; then
    identity="$(vd_artifact_identity "$(vd_ios_identity_file "$app")")"
    if [[ -n "$identity" ]]; then
      replaced="$(vd_refresh_ios_udid "$udid" "$app" "$identity" "${ONTRACK_IOS_SIMULATOR:-$udid}" || true)"
      if [[ "$replaced" == "1" ]]; then
        AGENT_UI_NATIVE_REFRESHED=1
      fi
    fi
  fi
}

vd_ensure_current_android_native_fresh() {
  local apk serial identity replaced
  apk="$(vd_android_apk)"
  if [[ ! -s "$apk" ]]; then
    if [[ "$(vd_rebuild_needed android "$apk")" == "1" ]]; then
      vd_ensure_android_artifact || return 1
    else
      return 0
    fi
  elif [[ "$(vd_rebuild_needed android "$apk")" == "1" ]]; then
    vd_ensure_android_artifact || return 1
  fi
  [[ -s "$apk" ]] || return 0

  serial="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}"
  if [[ -z "$serial" ]]; then
    local root
    root="$(vd_repo_root)"
    # shellcheck source=android-emulator.sh
    source "$root/scripts/lib/android-emulator.sh"
    serial="$(android_emu_preferred_serial 2>/dev/null || true)"
  fi
  [[ -n "$serial" ]] || return 0
  identity="$(vd_artifact_identity "$apk")"
  [[ -n "$identity" ]] || return 0
  replaced="$(vd_refresh_android_serial "$serial" "$apk" "$identity" "${ONTRACK_ANDROID_AVD:-$serial}" || true)"
  if [[ "$replaced" == "1" ]]; then
    AGENT_UI_NATIVE_REFRESHED=1
  fi
}
