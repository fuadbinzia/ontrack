#!/usr/bin/env bash
# Export the OTA bundle once (iOS + Android, no source maps), upload to
# testflight, then republish the same group to the device channel.
#
# Usage (from repo root):
#   bash scripts/publish-ota.sh -m "Why this ships"
#   bash scripts/publish-ota.sh -m "…" --export-only
#   bash scripts/publish-ota.sh -m "…" --upload-only
#   bash scripts/publish-ota.sh -m "…" --dry-run
#
# Flags:
#   -m, --message    OTA message (required)
#   --export-only    Metro export only (skip upload)
#   --upload-only    Skip export; upload existing dist/
#   --dry-run        Print eas/expo commands only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MESSAGE=""
DRY_RUN=0
DO_EXPORT=1
DO_UPLOAD=1

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
    --export-only) DO_UPLOAD=0; shift ;;
    --upload-only) DO_EXPORT=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0
      ;;
    *)
      die "unknown arg: $1"
      ;;
  esac
done

[[ -n "$MESSAGE" ]] || die "pass -m \"OTA message\""

EAS=(npx --yes --prefer-offline eas-cli@latest)
GROUP_ID_HELPER="$ROOT/scripts/lib/eas-update-group-id.mjs"
EXPORT_CMD="npx expo export --output-dir dist --dump-assetmap --platform ios --platform android"
export EXPO_NO_TELEMETRY=1

export_complete() {
  [[ -f "$ROOT/dist/metadata.json" && -f "$ROOT/dist/assetmap.json" ]]
}

export_bundle() {
  echo "==> Exporting OTA bundle (ios+android, no source maps)"
  rm -rf "$ROOT/dist"
  # `eas env:exec` can exit non-zero after a successful `expo export`
  # (Metro teardown / FORCE_COLOR warnings). Dist is the source of truth.
  set +e
  "${EAS[@]}" env:exec preview --non-interactive "$EXPORT_CMD"
  local status=$?
  set -e
  if ! export_complete; then
    die "OTA export failed (status $status)"
  fi
  if [[ "$status" -ne 0 ]]; then
    echo "warning: eas env:exec exited $status after a complete dist/; continuing" >&2
  fi
}

upload_bundle() {
  [[ -d "$ROOT/dist" ]] || die "dist/ missing; run export first"
  echo "==> Uploading TestFlight OTA (--skip-bundler)"
  local update_json group_id
  update_json="$(
    "${EAS[@]}" update \
      --channel testflight \
      --environment preview \
      --skip-bundler \
      --input-dir dist \
      --source-maps false \
      --message "$MESSAGE" \
      --json \
      --non-interactive
  )"
  if group_id="$(printf '%s\n' "$update_json" | node "$GROUP_ID_HELPER")"; then
    echo "    update group: $group_id"
    echo "==> Republishing same bundle to device channel"
    "${EAS[@]}" update:republish \
      --group "$group_id" \
      --destination-channel device \
      --message "$MESSAGE" \
      --non-interactive
  else
    echo "warning: could not parse update group id; publishing device channel from dist without re-bundling" >&2
    echo "==> Publishing device OTA (--skip-bundler)"
    "${EAS[@]}" update \
      --channel device \
      --skip-bundler \
      --input-dir dist \
      --source-maps false \
      --message "$MESSAGE" \
      --non-interactive
  fi
}

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$DO_EXPORT" -eq 1 ]]; then
    echo "[dry-run] ${EAS[*]} env:exec preview --non-interactive $(printf %q "$EXPORT_CMD")"
  fi
  if [[ "$DO_UPLOAD" -eq 1 ]]; then
    echo "[dry-run] ${EAS[*]} update --channel testflight --skip-bundler --input-dir dist --source-maps false --message $(printf %q "$MESSAGE") --json --non-interactive"
    echo "[dry-run] ${EAS[*]} update:republish --group <id> --destination-channel device --message $(printf %q "$MESSAGE") --non-interactive"
  fi
  exit 0
fi

[[ "$DO_EXPORT" -eq 1 ]] && export_bundle
[[ "$DO_UPLOAD" -eq 1 ]] && upload_bundle
