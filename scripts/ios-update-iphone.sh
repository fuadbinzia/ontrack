#!/usr/bin/env bash
# Put the current JS on the USB iPhone via the device-channel OTA.
# Use --ipa only when the native binary / runtimeVersion is stale.
#
# Usage (from repo root):
#   npm run ios:update-iphone
#   ./scripts/ios-update-iphone.sh
#   ./scripts/ios-update-iphone.sh -m "Why this ships"
#   ./scripts/ios-update-iphone.sh --ipa
#
# Prerequisites:
#   - Rocky’s iPhone unlocked on USB
#   - Standalone device-channel build already installed (Face ID / OTA runtime)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUNDLE_ID="com.imtihoss.ontracknow"
IPA_OUT="$ROOT/onTrack-ios-device.ipa"
PICKER="$ROOT/scripts/lib/ios-usb-iphone.mjs"
MESSAGE="Device OTA"
DO_IPA=0

die() {
  echo "error: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || die "--message requires a value"
      MESSAGE="$2"
      shift 2
      ;;
    --ipa|--native) DO_IPA=1; shift ;;
    -h|--help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0
      ;;
    *)
      die "unknown arg: $1"
      ;;
  esac
done

usb_udid() {
  local json udid
  json="$(mktemp)"
  xcrun devicectl list devices --json-output "$json" >/dev/null
  if ! udid="$(node "$PICKER" < "$json")"; then
    rm -f "$json"
    return 1
  fi
  rm -f "$json"
  [[ -n "$udid" ]] || return 1
  printf '%s' "$udid"
}

relaunch() {
  local udid="$1"
  xcrun devicectl device process launch --terminate-existing --device "$udid" "$BUNDLE_ID"
}

UDID="$(usb_udid)" || die "no connected iPhone (plug in USB and unlock)"
[[ -n "$UDID" ]] || die "no connected iPhone (plug in USB and unlock)"
echo "==> iPhone $UDID"

if [[ "$DO_IPA" -eq 1 ]]; then
  echo "==> Local standalone IPA (native / runtimeVersion)"
  npx --yes --prefer-offline eas-cli@latest build \
    --platform ios \
    --profile device \
    --local \
    --non-interactive \
    --output "$IPA_OUT"
  xcrun devicectl device install app --device "$UDID" "$IPA_OUT"
  relaunch "$UDID"
  exit 0
fi

echo "==> Device-channel OTA (JS only; pass --ipa for a native binary)"
npx --yes --prefer-offline eas-cli@latest update \
  --channel device \
  --environment preview \
  --non-interactive \
  --message "$MESSAGE"
echo "==> Relaunch so ON_LOAD picks up the update"
relaunch "$UDID"
