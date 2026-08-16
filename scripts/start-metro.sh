#!/usr/bin/env bash
# Shared Metro launcher for `npm start` and `ensure-packager.sh`.
#
# Bind with Expo `--lan` (IPv4 + IPv6) while advertising a stable packager
# hostname. Default advertise host is 127.0.0.1 so the iOS Simulator survives
# Wi-Fi / DHCP churn. Override with REACT_NATIVE_PACKAGER_HOSTNAME or
# --hostname / --advertise-lan.
#
# Usage:
#   ./scripts/start-metro.sh
#   ./scripts/start-metro.sh --clear
#   ./scripts/start-metro.sh --ios
#   ./scripts/start-metro.sh --android
#   ./scripts/start-metro.sh --web
#   ./scripts/start-metro.sh --hostname 192.168.1.10
#   ./scripts/start-metro.sh --advertise-lan
#
# Do not pass Expo `--localhost` here — on some macOS setups that binds only
# to IPv6 ::1, which breaks clients that connect via 127.0.0.1.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE24_BIN="${NODE24_BIN:-$HOME/.nvm/versions/node/v24.12.0/bin}"
if [[ -d "$NODE24_BIN" ]]; then
  export PATH="$NODE24_BIN:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
fi

MODE="dev-client"
CLEAR=0
ADVERTISE_LAN=0
HOSTNAME_OVERRIDE="${REACT_NATIVE_PACKAGER_HOSTNAME:-}"
EXTRA=()

resolve_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clear) CLEAR=1 ;;
    --ios) EXTRA+=(--ios) ;;
    --android) EXTRA+=(--android) ;;
    --web) MODE="web" ;;
    --advertise-lan) ADVERTISE_LAN=1 ;;
    --hostname)
      shift
      [[ $# -gt 0 ]] || { echo "error: --hostname requires a value" >&2; exit 2; }
      HOSTNAME_OVERRIDE="$1"
      ;;
    -h|--help) usage ;;
    *) EXTRA+=("$1") ;;
  esac
  shift
done

if [[ "$ADVERTISE_LAN" == "1" ]]; then
  HOSTNAME_OVERRIDE="$(resolve_lan_ip)"
  if [[ -z "$HOSTNAME_OVERRIDE" ]]; then
    echo "error: could not resolve LAN IP (en0/en1)" >&2
    exit 1
  fi
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="${HOSTNAME_OVERRIDE:-127.0.0.1}"

node ./scripts/assert-node.js

# Expo Router API routes execute inside the Metro server during local native
# development. Load only the analytics server credentials here; Expo exposes
# only EXPO_PUBLIC_* values to the native bundle.
ANALYTICS_ENV_FILE="$ROOT/.living-system-map/runtime-analytics.local"
node "$ROOT/scripts/ensure-local-analytics-env.mjs"
if [[ -f "$ANALYTICS_ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      SUPABASE_URL=*|SUPABASE_SERVICE_ROLE_KEY=*|ANALYTICS_INSTALL_HASH_SECRET=*)
        key="${line%%=*}"
        value="${line#*=}"
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        [[ -n "${!key:-}" ]] || export "$key=$value"
        ;;
    esac
  done < "$ANALYTICS_ENV_FILE"
fi

# Node crawl + Watchman watch (Expo's null hybrid, fixed for SDK 56+/57).
bash "$ROOT/scripts/patch-expo-metro-watchman.sh"

# shellcheck source=lib/metro-watcher.sh
source "$ROOT/scripts/lib/metro-watcher.sh"
if ! wait_for_watchman; then
  echo "warn: Watchman not ready — Metro may use NativeWatcher" >&2
fi

ARGS=(expo start --lan)
if [[ "$MODE" == "web" ]]; then
  ARGS+=(--web)
else
  ARGS+=(--dev-client)
fi
if [[ "$CLEAR" == "1" ]]; then
  ARGS+=(--clear)
fi
if [[ ${#EXTRA[@]} -gt 0 ]]; then
  ARGS+=("${EXTRA[@]}")
fi

echo "Metro launch: ${ARGS[*]} (advertise ${REACT_NATIVE_PACKAGER_HOSTNAME})"
# Metro workers set FORCE_COLOR=1; Node 24 warns if NO_COLOR is also set.
unset NO_COLOR NODE_DISABLE_COLORS
exec npx "${ARGS[@]}"
