#!/usr/bin/env bash
# Build a local Android release APK and replace the shared Google Drive copy.
# Use for native / runtimeVersion binary refreshes only — day-to-day JS ships via
# `ship:push` / `update:device` (EAS Update on the device channel).
#
# Usage (from repo root):
#   npm run android:release-to-drive
#   ./scripts/android-release-to-drive.sh
#   ./scripts/android-release-to-drive.sh --upload-only   # reuse newest staged APK
#   ./scripts/android-release-to-drive.sh --no-upload     # build only
#
# Prerequisites:
#   - JDK 17 (Homebrew openjdk@17)
#   - Android SDK at ~/Library/Android/sdk
#   - rclone remote `gdrive` authorized (see ~/.config/rclone/rclone.conf)
#   - android/ present (expo prebuild / prior local native build)
#
# Drive folder (internal sideload APK):
#   https://drive.google.com/drive/folders/162sjQp7GPhie7MCJMdIAbEXPATmIa1Pa
#
# Notes:
#   - OTA (`npm run update:production`) cannot ship native module changes.
#     Use this script when Kotlin/Java under modules/ (or other native code) changed.
#   - Always deletes existing *.apk in the folder before upload so only one remains.
#   - Uploaded name is onTrack-<expo.version>-<YYYYMMDD-HHMMSS>-android-release.apk

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOLDER_ID="${ONTRACK_DRIVE_APK_FOLDER_ID:-162sjQp7GPhie7MCJMdIAbEXPATmIa1Pa}"
REMOTE="${ONTRACK_DRIVE_RCLONE_REMOTE:-gdrive}"
APP_VERSION="$(
  node -e "const a=require('${ROOT}/app.json'); process.stdout.write(String(a?.expo?.version||''))" 2>/dev/null || true
)"
if [[ -z "$APP_VERSION" ]]; then
  echo "error: could not read expo.version from app.json" >&2
  exit 1
fi
APK_SRC="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
APK_OUTPUT_DIR="$ROOT/.eas-local-build/apks"
JAVA_HOME_DEFAULT="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"

DO_BUILD=1
DO_UPLOAD=1
CLEAN_NATIVE=1

for arg in "$@"; do
  case "$arg" in
    --upload-only) DO_BUILD=0 ;;
    --no-upload) DO_UPLOAD=0 ;;
    --no-clean-native) CLEAN_NATIVE=0 ;;
    -h|--help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"

if [[ ! -d "$JAVA_HOME" ]]; then
  echo "error: JAVA_HOME missing at $JAVA_HOME (install openjdk@17)" >&2
  exit 1
fi
if [[ ! -d "$ROOT/android" ]]; then
  echo "error: android/ missing — run a local native prebuild first" >&2
  exit 1
fi

SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

# Newest staged sideload APK.
newest_local_apk() {
  local newest=""
  shopt -s nullglob
  local candidates=( "$APK_OUTPUT_DIR"/onTrack-*.apk )
  shopt -u nullglob
  ((${#candidates[@]})) || { printf ''; return 0; }
  # shellcheck disable=SC2012
  newest="$(ls -t "${candidates[@]}" 2>/dev/null | head -1 || true)"
  printf '%s' "$newest"
}

# expo-updates reads UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY (not *_JSON).
# Wrong key → EAS returns "channel-name: Required" and Android OTA never applies.
assert_device_channel_headers() {
  local manifest="$ROOT/android/app/src/main/AndroidManifest.xml"
  if [[ ! -f "$manifest" ]]; then
    echo "error: missing $manifest" >&2
    exit 1
  fi
  if rg -q 'UPDATES_CONFIGURATION_REQUEST_HEADERS_JSON' "$manifest"; then
    echo "error: AndroidManifest uses UPDATES_CONFIGURATION_REQUEST_HEADERS_JSON;" >&2
    echo "       expo-updates expects UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" >&2
    exit 1
  fi
  if ! rg -q 'expo\.modules\.updates\.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY' "$manifest"; then
    echo "error: AndroidManifest missing UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" >&2
    exit 1
  fi
  if ! rg -q 'expo-channel-name' "$manifest"; then
    echo "error: AndroidManifest missing expo-channel-name in request headers" >&2
    exit 1
  fi
}

assert_device_channel_headers

if [[ "$DO_BUILD" -eq 1 ]]; then
  BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
  APK_NAME="onTrack-${APP_VERSION}-${BUILD_STAMP}-android-release.apk"
  APK_DEST="$APK_OUTPUT_DIR/$APK_NAME"

  echo "==> Building release APK v${APP_VERSION} @ ${BUILD_STAMP} (commit $SHA)"
  echo "==> Syncing app.json into the existing Android native project"
  cd "$ROOT"
  npx expo prebuild --platform android --no-install --no-clean
  assert_device_channel_headers
  cd "$ROOT/android"
  GRADLE_ARGS=()
  if [[ "$CLEAN_NATIVE" -eq 1 ]]; then
    # Local Expo modules under modules/ — clean so Kotlin edits are never stale.
    for mod_dir in "$ROOT"/modules/*/; do
      [[ -d "$mod_dir" ]] || continue
      name="$(basename "$mod_dir")"
      [[ -d "$mod_dir/android" ]] || continue
      GRADLE_ARGS+=(":${name}:clean" ":${name}:compileReleaseKotlin")
    done
  fi
  GRADLE_ARGS+=(":app:assembleRelease")
  ./gradlew --no-daemon "${GRADLE_ARGS[@]}"
  if [[ ! -f "$APK_SRC" ]]; then
    echo "error: expected APK missing: $APK_SRC" >&2
    exit 1
  fi
  mkdir -p "$APK_OUTPUT_DIR"
  cp -f "$APK_SRC" "$APK_DEST"
  echo "Built $(du -h "$APK_DEST" | awk '{print $1}') → $APK_DEST"
else
  APK_DEST="$(newest_local_apk)"
  if [[ -z "$APK_DEST" && -f "$APK_SRC" ]]; then
    BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
    APK_NAME="onTrack-${APP_VERSION}-${BUILD_STAMP}-android-release.apk"
    APK_DEST="$APK_OUTPUT_DIR/$APK_NAME"
    mkdir -p "$APK_OUTPUT_DIR"
    cp -f "$APK_SRC" "$APK_DEST"
  fi
  if [[ -z "$APK_DEST" || ! -f "$APK_DEST" ]]; then
    echo "error: no local APK in $APK_OUTPUT_DIR (run without --upload-only first)" >&2
    exit 1
  fi
  APK_NAME="$(basename "$APK_DEST")"
  echo "==> Reusing local APK $APK_NAME"
fi

if [[ "$DO_UPLOAD" -eq 0 ]]; then
  echo "Skip upload (--no-upload). Local: $APK_DEST"
  exit 0
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "error: rclone not found" >&2
  exit 1
fi
if [[ ! -f "$HOME/.config/rclone/rclone.conf" ]]; then
  echo "error: missing ~/.config/rclone/rclone.conf (authorize remote '$REMOTE')" >&2
  exit 1
fi

echo "==> Replacing APKs in Drive folder $FOLDER_ID"
rclone delete "${REMOTE}:" \
  --drive-root-folder-id "$FOLDER_ID" \
  --drive-use-trash=false \
  --include "*.apk" \
  -v 2>&1 | grep -v NOTICE || true

rclone copy "$APK_DEST" "${REMOTE}:" \
  --drive-root-folder-id "$FOLDER_ID" \
  --progress \
  --stats 15s \
  -v 2>&1 | grep -v NOTICE

echo "==> Folder contents"
rclone lsl "${REMOTE}:" --drive-root-folder-id "$FOLDER_ID" 2>&1 | grep -v NOTICE
LINK="$(rclone link "${REMOTE}:${APK_NAME}" --drive-root-folder-id "$FOLDER_ID" 2>&1 | grep -v NOTICE | tail -1)"
echo
echo "version=$APP_VERSION"
echo "commit=$SHA"
echo "apk=$APK_NAME"
echo "file=$LINK"
echo "folder=https://drive.google.com/drive/folders/${FOLDER_ID}"
