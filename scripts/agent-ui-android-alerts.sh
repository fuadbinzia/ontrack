#!/usr/bin/env bash
# Detect / dismiss blocking Android Expo Dev Menu sheets (intro + tools).
#
#   ./scripts/agent-ui-android-alerts.sh ensure   # default — clear if present
#   ./scripts/agent-ui-android-alerts.sh dismiss  # force attempt
#   ./scripts/agent-ui-android-alerts.sh probe    # print JSON; exit 1 if blocking
#   ./scripts/agent-ui-android-alerts.sh suppress-prefs
#
# Env: AGENT_UI_SKIP_ANDROID_ALERTS=1 to bypass.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export AGENT_UI_ROOT="$ROOT"
export AGENT_UI_PLATFORM="${AGENT_UI_PLATFORM:-android}"
exec python3 "$ROOT/scripts/lib/android_system_alert.py" "${1:-ensure}" "${@:2}"
