#!/usr/bin/env bash
# Keep Metro + the preferred device dev client connected without needless relaunches.
#
# Default (iOS simulator-friendly):
#   - Prefer packager host 127.0.0.1 (survives Wi-Fi / DHCP IP churn)
#   - Start Metro via scripts/start-metro.sh (--lan bind + advertise 127.0.0.1)
#   - Android: adb reverse Metro + agent-ui ports so emulator 127.0.0.1 reaches the host
#   - Align EXPO_PUBLIC_API_BASE_URL in .env.local when it looks like a local Metro URL
#   - Probe via agent-ui dump; reconnect the dev client if the probe fails
#     or if this run (re)launched Metro (new Metro = app's HMR socket is gone,
#     even though the agent-ui bridge in the stale bundle still answers)
#   - Never kill healthy Metro; with --start, replace IPv6-only or dead-watcher Metro
#   - Require a live Watchman client on Metro ( /status 200 alone is not enough )
#
# Usage:
#   ./scripts/ensure-packager.sh
#   ./scripts/ensure-packager.sh --start          # start Metro if down / fix IPv6-only / dead watcher
#   ./scripts/ensure-packager.sh --metro-only     # Metro/watcher/env only — do not boot a device
#   ./scripts/ensure-packager.sh --android        # boot Galaxy_S26 + reconnect Android (AGENT_UI_PLATFORM=android)
#   ./scripts/ensure-packager.sh --clear          # replace Metro and clear a poisoned cache
#   ./scripts/ensure-packager.sh --lan            # use en0 LAN IP (physical device)
#   ./scripts/ensure-packager.sh --force-reconnect
#   ./scripts/ensure-packager.sh --check-only
#   ./scripts/ensure-packager.sh --no-env         # skip .env.local sync
#
# Env overrides:
#   PACKAGER_HOST=127.0.0.1|lan|<ip>
#   BUNDLE_ID=com.imtihoss.ontracknow
#   METRO_PORT=8081
#   WAIT_SECS=8
#   START_WAIT_SECS=20
#   METRO_WATCHER_FS_PROBE=1   # also touch beacon + confirm Watchman sees it
#   ONTRACK_PACKAGER_TARGET=ios|android   # or pass --android
#   AGENT_UI_PLATFORM=ios|android         # agent-ui command pin (set with --android)
#   ONTRACK_IOS_SIMULATOR=onTrack iPhone 17 Pro  # default simulator device name
#   ONTRACK_IOS_SIMULATOR_UDID=<udid>            # optional exact device
#   ONTRACK_IOS_SIMULATOR_WINDOW=1               # open Simulator.app (default: headless)
#   ONTRACK_SIMCTL_TIMEOUT_SECS=10              # hard cap for simctl RPCs (anti-wedge)
#   ONTRACK_ANDROID_AVD=Galaxy_S26
#   ONTRACK_ANDROID_EMULATOR_WINDOW=1

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/metro-watcher.sh
source "$ROOT/scripts/lib/metro-watcher.sh"
# shellcheck source=lib/ios-simulator.sh
source "$ROOT/scripts/lib/ios-simulator.sh"
# shellcheck source=lib/android-emulator.sh
source "$ROOT/scripts/lib/android-emulator.sh"
# shellcheck source=lib/agent-ui-dev-client.sh
source "$ROOT/scripts/lib/agent-ui-dev-client.sh"

BUNDLE_ID="${BUNDLE_ID:-com.imtihoss.ontracknow}"
METRO_PORT="${METRO_PORT:-8081}"
WAIT_SECS="${WAIT_SECS:-8}"
START_WAIT_SECS="${START_WAIT_SECS:-20}"
NODE24_BIN="${NODE24_BIN:-$HOME/.nvm/versions/node/v24.12.0/bin}"
START_METRO_SH="$ROOT/scripts/start-metro.sh"
METRO_LOG="$ROOT/.cursor/metro-ensure.log"
# macOS puts lsof in /usr/sbin — keep it reachable even when agent PATH is minimal.
LSOF_BIN="${LSOF_BIN:-$(command -v lsof 2>/dev/null || true)}"
if [[ -z "$LSOF_BIN" && -x /usr/sbin/lsof ]]; then
  LSOF_BIN=/usr/sbin/lsof
fi
: "${LSOF_BIN:=lsof}"

DO_START=0
DO_CLEAR=0
DO_FORCE=0
CHECK_ONLY=0
METRO_ONLY=0
SYNC_ENV=1
HOST_MODE="${PACKAGER_HOST:-localhost}"
# Set when this run launches a new Metro process. A new Metro orphans the dev
# client's HMR socket even though the app's agent-ui bridge (plain HTTP polling)
# keeps answering — so probe_connected is a false positive and we must reconnect.
METRO_RELAUNCHED=0
# Prefer explicit --android / ONTRACK_PACKAGER_TARGET; also honor AGENT_UI_PLATFORM.
PACKAGER_TARGET="${ONTRACK_PACKAGER_TARGET:-}"
if [[ -z "$PACKAGER_TARGET" && "${AGENT_UI_PLATFORM:-}" == "android" ]]; then
  PACKAGER_TARGET="android"
fi
: "${PACKAGER_TARGET:=ios}"

usage() {
  sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start) DO_START=1 ;;
    --clear) DO_START=1; DO_CLEAR=1 ;;
    --metro-only) METRO_ONLY=1 ;;
    --android) PACKAGER_TARGET="android" ;;
    --ios) PACKAGER_TARGET="ios" ;;
    --force-reconnect) DO_FORCE=1 ;;
    --check-only) CHECK_ONLY=1 ;;
    --no-env) SYNC_ENV=0 ;;
    --lan) HOST_MODE="lan" ;;
    --localhost) HOST_MODE="localhost" ;;
    -h|--help) usage ;;
    *)
      echo "error: unknown arg: $1" >&2
      usage
      ;;
  esac
  shift
done

case "${PACKAGER_TARGET}" in
  android|ANDROID)
    PACKAGER_TARGET="android"
    export AGENT_UI_PLATFORM=android
    export ONTRACK_PACKAGER_TARGET=android
    ;;
  *)
    PACKAGER_TARGET="ios"
    # Don't clobber an explicit android pin from the environment mid-heal.
    if [[ "${AGENT_UI_PLATFORM:-}" != "android" ]]; then
      export AGENT_UI_PLATFORM=ios
    fi
    export ONTRACK_PACKAGER_TARGET=ios
    ;;
esac

# Final pin: --android / AGENT_UI_PLATFORM=android wins.
if [[ "${AGENT_UI_PLATFORM:-}" == "android" || "$PACKAGER_TARGET" == "android" ]]; then
  PACKAGER_TARGET="android"
  export AGENT_UI_PLATFORM=android
  export ONTRACK_PACKAGER_TARGET=android
fi

# Serialize device-touching ensure runs. Overlapping agents that each call
# `simctl get_app_container` / terminate / launch wedge CoreSimulator and freeze
# Simulator.app. Metro-only / check-only skip the lock (no device RPCs).
PACKAGER_LOCK_DIR="$ROOT/.cursor/ensure-packager.lockdir"
release_packager_lock() {
  rm -rf "$PACKAGER_LOCK_DIR" 2>/dev/null || true
}
acquire_packager_lock() {
  mkdir -p "$ROOT/.cursor"
  local deadline=$((SECONDS + 90))
  while (( SECONDS < deadline )); do
    if mkdir "$PACKAGER_LOCK_DIR" 2>/dev/null; then
      printf '%s\n' "$$" >"$PACKAGER_LOCK_DIR/pid"
      trap 'release_packager_lock' EXIT
      return 0
    fi
    local owner
    owner="$(cat "$PACKAGER_LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ -n "$owner" ]] && ! kill -0 "$owner" 2>/dev/null; then
      echo "ensure-packager: clearing stale lock (pid ${owner} gone)" >&2
      rm -rf "$PACKAGER_LOCK_DIR"
      continue
    fi
    sleep 0.4
  done
  echo "error: another ensure-packager is already running (lock: ${PACKAGER_LOCK_DIR})" >&2
  return 1
}
if [[ "$METRO_ONLY" != "1" && "$CHECK_ONLY" != "1" ]]; then
  acquire_packager_lock || exit 1
fi

http_ok() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 "$url" || true)"
  [[ "$code" == "200" ]]
}

resolve_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

resolve_host() {
  case "$HOST_MODE" in
    localhost|127.0.0.1|local)
      echo "127.0.0.1"
      ;;
    lan|LAN)
      local ip
      ip="$(resolve_lan_ip)"
      if [[ -z "$ip" ]]; then
        echo "error: could not resolve LAN IP (en0/en1)" >&2
        exit 1
      fi
      echo "$ip"
      ;;
    *)
      echo "$HOST_MODE"
      ;;
  esac
}

ensure_node24_path() {
  if [[ -d "$NODE24_BIN" ]]; then
    export PATH="$NODE24_BIN:/opt/homebrew/bin:/usr/sbin:/usr/bin:/bin:$PATH"
  fi
}

metro_status_url() {
  echo "http://$1:${METRO_PORT}/status"
}

metro_ipv4_ok() {
  http_ok "$(metro_status_url 127.0.0.1)"
}

metro_ipv6_ok() {
  http_ok "http://[::1]:${METRO_PORT}/status"
}

# True when ::1 answers and 127.0.0.1 does not — classic Expo --localhost trap.
is_ipv6_only_metro() {
  metro_ipv6_ok || return 1
  metro_ipv4_ok && return 1
  return 0
}

listening_pids() {
  "$LSOF_BIN" -nP -iTCP:"${METRO_PORT}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
}

listening_addresses() {
  # Compact NAME column values, e.g. *:8081 [::1]:8081 127.0.0.1:8081
  "$LSOF_BIN" -nP -iTCP:"${METRO_PORT}" -sTCP:LISTEN 2>/dev/null \
    | awk 'NR > 1 { print $9 }' \
    | sort -u \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]*$//' || true
}

pid_cwd() {
  local pid="$1"
  "$LSOF_BIN" -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

pid_belongs_to_repo() {
  local pid="$1"
  local cwd cmd
  cwd="$(pid_cwd "$pid")"
  if [[ -n "$cwd" && "$cwd" == "$ROOT" ]]; then
    return 0
  fi
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ -n "$cmd" && "$cmd" == *"$ROOT"* ]]; then
    return 0
  fi
  # Expo/Metro children often keep repo cwd even when argv omits the path.
  if [[ -n "$cwd" && "$cwd" == "$ROOT"/* ]]; then
    return 0
  fi
  return 1
}

node_version_label() {
  ensure_node24_path
  if command -v node >/dev/null 2>&1; then
    node -v 2>/dev/null || echo "unknown"
  else
    echo "missing"
  fi
}

simulator_booted() {
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    # Prefer sys.boot_completed over bare adb get-state (mid-boot false ready).
    android_emu_is_ready
    return $?
  fi
  if [[ -n "${ONTRACK_IOS_SIMULATOR_UDID:-}" ]]; then
    xcrun simctl list devices booted 2>/dev/null | grep -q "${ONTRACK_IOS_SIMULATOR_UDID}"
    return $?
  fi
  xcrun simctl list devices booted 2>/dev/null | grep -q Booted
}

app_installed() {
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    android_emu_adb shell pm path "$BUNDLE_ID" 2>/dev/null | grep -q "package:" || return 1
    # Metro/agent-ui requires a debuggable development client. Treat a stale
    # release install as missing so the pool replaces it instead of timing out.
    android_emu_adb shell run-as "$BUNDLE_ID" true >/dev/null 2>&1
    return $?
  fi
  ios_simctl_timed get_app_container "$(ios_sim_target)" "$BUNDLE_ID" data >/dev/null 2>&1
}

# True when the JS process is actually up (install ≠ running).
app_process_running() {
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    android_emu_adb shell pidof -s "$BUNDLE_ID" >/dev/null 2>&1
    return $?
  fi
  ios_simctl_timed spawn "$(ios_sim_target)" launchctl list 2>/dev/null \
    | grep -E "^[0-9]+[[:space:]]+.*UIKitApplication:${BUNDLE_ID}" >/dev/null
}

probe_connected() {
  # Agent-ui dump only succeeds when JS runtime is alive and listening for deep links.
  # Skip heal recursion (dump → open → heal → ensure → probe).
  # Skip simulator lease — we already hold ensure-packager.lockdir; taking the
  # agent-ui lease here can deadlock against a verify thread waiting on us.
  AGENT_UI_SKIP_HEAL=1 AGENT_UI_SKIP_LEASE=1 AGENT_UI_PLATFORM="${AGENT_UI_PLATFORM}" WAIT_SECS=3 \
    ./scripts/agent-ui-dump.sh >/dev/null 2>&1
}

ensure_fast_refresh_enabled() {
  # The dev client persists the Fast Refresh toggle. When it is off, edits
  # silently never apply no matter how healthy Metro/Watchman are.
  simulator_booted || return 0
  app_installed || return 0

  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    # Best-effort: debug builds allow run-as to read SharedPreferences.
    if ! android_emu_adb shell run-as "$BUNDLE_ID" true >/dev/null 2>&1; then
      return 0
    fi
    local prefs
    prefs="$(android_emu_adb shell run-as "$BUNDLE_ID" sh -c \
      'for f in shared_prefs/*.xml; do [ -f "$f" ] && cat "$f"; done' 2>/dev/null || true)"
    if ! printf '%s' "$prefs" | grep -qiE 'hotLoadingEnabled[^>]*value="false"|hotLoadingEnabled">false'; then
      return 0
    fi
    echo "Fast Refresh looks OFF in Android shared_prefs — clearing RCTDevMenu prefs…"
    android_emu_adb shell run-as "$BUNDLE_ID" sh -c \
      'rm -f shared_prefs/RCTDevMenu.xml shared_prefs/rkct_dev_menu.xml' \
      >/dev/null 2>&1 || true
    android_emu_adb shell am force-stop "$BUNDLE_ID" >/dev/null 2>&1 || true
    echo "Fast Refresh prefs cleared; app will be relaunched by the reconnect step."
    return 0
  fi

  local menu ios_target
  ios_target="$(ios_sim_target)"
  menu="$(ios_simctl_timed spawn "$ios_target" defaults read "$BUNDLE_ID" RCTDevMenu 2>/dev/null || true)"
  if [[ "$menu" != *"hotLoadingEnabled = 0"* ]]; then
    return 0
  fi
  echo "Fast Refresh is OFF in the dev client (RCTDevMenu.hotLoadingEnabled=0) — enabling…"
  # Terminate first so the running app cannot overwrite the setting on exit;
  # the normal probe/reconnect flow below relaunches it.
  ios_simctl_timed terminate "$ios_target" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  ios_simctl_timed spawn "$ios_target" defaults write "$BUNDLE_ID" RCTDevMenu -dict-add hotLoadingEnabled -bool YES
  echo "Fast Refresh re-enabled; app will be relaunched by the reconnect step."
}

print_packager_diagnostics() {
  local host="$1"
  local status="down"
  local listen
  local device="not booted"
  local preferred=""
  local app="n/a"
  local target_label="Simulator"

  if metro_ipv4_ok; then
    status="up (127.0.0.1)"
  elif [[ "$host" != "127.0.0.1" ]] && http_ok "$(metro_status_url "$host")"; then
    status="up (${host})"
  elif is_ipv6_only_metro; then
    status="IPv6-only (::1)"
  elif metro_ipv6_ok; then
    status="up (::1)"
  fi

  listen="$(listening_addresses)"
  [[ -z "$listen" ]] && listen="none"

  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    target_label="Emulator"
    preferred="$(android_emu_preferred_name)"
    local serial
    serial="$(android_emu_preferred_serial || true)"
    if [[ -n "$serial" ]]; then
      device="booted (${preferred} / ${serial})"
    else
      device="not booted (want ${preferred})"
    fi
  else
    preferred="$(ios_sim_preferred_name)"
    if simulator_booted; then
      local preferred_udid
      preferred_udid="$(ios_sim_preferred_booted_udid || true)"
      if [[ -n "$preferred_udid" ]]; then
        device="booted (${preferred})"
      else
        device="booted (not ${preferred})"
      fi
    fi
  fi

  if simulator_booted; then
    if app_installed; then
      if probe_connected; then
        app="installed + connected"
      else
        app="installed (not connected)"
      fi
    else
      app="not installed"
    fi
  fi

  cat <<EOF
--- packager diagnostic ---
Target:           ${PACKAGER_TARGET} (AGENT_UI_PLATFORM=${AGENT_UI_PLATFORM:-})
Metro status:     ${status}
Listening:        ${listen}
Watchman client:  $(metro_has_watchman_client && echo yes || echo NO)
Node:             $(node_version_label)
${target_label}:        ${device}
Preferred:        ${preferred}
App (${BUNDLE_ID}): ${app}
Host expected:    ${host}:${METRO_PORT}
---------------------------
EOF
  print_metro_watcher_diagnostics
}

stop_repo_metro_listeners() {
  local pids pid stopped=0
  pids="$(listening_pids)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  for pid in $pids; do
    if ! pid_belongs_to_repo "$pid"; then
      echo "error: port ${METRO_PORT} is held by pid ${pid} outside this repository — not replacing" >&2
      print_packager_diagnostics "$(resolve_host)"
      exit 1
    fi
  done

  for pid in $pids; do
    echo "Stopping repo Metro listener pid ${pid}…"
    kill "$pid" 2>/dev/null || true
    stopped=1
  done

  if [[ "$stopped" == "1" ]]; then
    local deadline=$((SECONDS + 8))
    while (( SECONDS < deadline )); do
      if [[ -z "$(listening_pids)" ]]; then
        return 0
      fi
      sleep 0.25
    done
    # Escalate only for repo-owned listeners that ignored SIGTERM.
    for pid in $(listening_pids); do
      if pid_belongs_to_repo "$pid"; then
        echo "Force-stopping pid ${pid}…"
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
    sleep 0.5
  fi
}

launch_metro_background() {
  local host="$1"
  ensure_node24_path
  if ! command -v node >/dev/null || [[ "$(node -p "process.versions.node.split('.')[0]")" -ge 25 ]]; then
    echo "error: need Node 24 on PATH to start Metro (see .nvmrc)" >&2
    exit 1
  fi
  if [[ ! -f "$START_METRO_SH" ]]; then
    echo "error: missing shared launcher ${START_METRO_SH}" >&2
    exit 1
  fi

  if ! wait_for_watchman; then
    echo "error: Watchman capabilities not ready — refusing to start Metro" >&2
    print_metro_watcher_diagnostics
    exit 1
  fi

  mkdir -p "$(dirname "$METRO_LOG")"
  : >"$METRO_LOG"
  echo "Starting Metro via scripts/start-metro.sh (advertise ${host}:${METRO_PORT}, Node $(node -v))…"
  local clear_flag=""
  [[ "$DO_CLEAR" == "1" ]] && clear_flag="--clear"
  # Detach into a new session so Cursor aborting an agent shell does not
  # SIGTERM Metro (the recurring "Failed to load app from 127.0.0.1:8081" cause).
  # Plain `nohup … &` stays in the agent process group and dies with the terminal.
  ROOT="$ROOT" START_METRO_SH="$START_METRO_SH" HOST="$host" METRO_LOG="$METRO_LOG" PATH="$PATH" \
    CLEAR_FLAG="$clear_flag" HOME="$HOME" USER="${USER:-}" TMPDIR="${TMPDIR:-/tmp}" \
    NODE24_BIN="${NODE24_BIN:-}" \
    python3 - <<'PY'
import os, subprocess, sys

root = os.environ["ROOT"]
script = os.environ["START_METRO_SH"]
host = os.environ["HOST"]
log_path = os.environ["METRO_LOG"]
extra = [f for f in [os.environ.get("CLEAR_FLAG", "")] if f]

# Launch with a *clean* environment. Inheriting Cursor/VS Code agent env
# (CURSOR_AGENT, VSCODE_*, sandbox restore hooks) can make Metro's
# `watchman list-capabilities --no-spawn` fail silently → NativeWatcher →
# Fast Refresh never applies for deep src/ edits while /status stays 200.
path = os.environ.get("PATH", "/usr/bin:/bin")
env = {
    "PATH": path,
    "HOME": os.environ.get("HOME", ""),
    "USER": os.environ.get("USER", ""),
    "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
    "TERM": "dumb",
    "LANG": os.environ.get("LANG", "en_US.UTF-8"),
    "REACT_NATIVE_PACKAGER_HOSTNAME": host,
    "DEBUG": "Metro:Watcher",
}
node24 = os.environ.get("NODE24_BIN") or ""
if node24:
    env["NODE24_BIN"] = node24
# Preserve Expo/EAS tokens if present (not required for local Fast Refresh).
for key in (
    "EXPO_TOKEN",
    "EXPO_PUBLIC_API_BASE_URL",
    "SSH_AUTH_SOCK",
):
    if key in os.environ:
        env[key] = os.environ[key]

with open(log_path, "ab", buffering=0) as logf:
    subprocess.Popen(
        ["bash", script, "--hostname", host, *extra],
        stdin=subprocess.DEVNULL,
        stdout=logf,
        stderr=subprocess.STDOUT,
        cwd=root,
        start_new_session=True,
        env=env,
    )
print("Metro detached (new session); logs →", log_path, file=sys.stderr)
PY
  METRO_RELAUNCHED=1
}

wait_for_metro_ipv4() {
  local host="$1"
  local deadline=$((SECONDS + START_WAIT_SECS))
  while (( SECONDS < deadline )); do
    if metro_ipv4_ok || { [[ "$host" != "127.0.0.1" ]] && http_ok "$(metro_status_url "$host")"; }; then
      echo "Metro is up on IPv4."
      return 0
    fi
    if is_ipv6_only_metro; then
      echo "error: Metro is bound to IPv6 only." >&2
      print_packager_diagnostics "$host"
      echo "error: see ${METRO_LOG}" >&2
      exit 1
    fi
    sleep 0.4
  done
  echo "error: Metro did not become ready within ${START_WAIT_SECS}s" >&2
  print_packager_diagnostics "$host"
  echo "error: see ${METRO_LOG}" >&2
  exit 1
}

replace_metro() {
  local host="$1"
  local reason="$2"
  echo "${reason}"
  print_packager_diagnostics "$host"
  reset_watchman_project
  stop_repo_metro_listeners
  launch_metro_background "$host"
  wait_for_metro_ipv4 "$host"
}

start_metro_if_needed() {
  local host="$1"

  # --clear is for a poisoned resolver/transform cache (e.g. Metro claims
  # node_modules/expo-router/entry does not exist). Replace even healthy Metro.
  if [[ "$DO_CLEAR" == "1" ]]; then
    replace_metro "$host" "Replacing Metro with a cleared cache…"
    return 0
  fi

  if metro_ipv4_ok || { [[ "$host" != "127.0.0.1" ]] && http_ok "$(metro_status_url "$host")"; }; then
    # /status 200 is necessary but not sufficient — a dead file watcher leaves
    # Fast Refresh permanently stuck while looking healthy.
    if metro_watcher_healthy; then
      return 0
    fi
    echo "Metro /status is up but the file watcher is dead (no Watchman client)."
    print_metro_watcher_diagnostics
    if [[ "$DO_START" != "1" ]]; then
      echo "error: re-run with --start to replace dead-watcher Metro (Fast Refresh will not apply until then)." >&2
      print_packager_diagnostics "$host"
      exit 1
    fi
    replace_metro "$host" "Replacing dead-watcher Metro…"
    return 0
  fi

  if is_ipv6_only_metro; then
    echo "Metro is bound to IPv6 only."
    print_packager_diagnostics "$host"
    if [[ "$DO_START" != "1" ]]; then
      echo "error: re-run with --start to replace this repo's IPv6-only Metro (scripts/start-metro.sh uses --lan)." >&2
      exit 1
    fi
    replace_metro "$host" "Replacing IPv6-only Metro…"
    return 0
  fi

  if [[ "$DO_START" != "1" ]]; then
    echo "error: Metro is down on :${METRO_PORT}. Re-run with --start, or: npm start" >&2
    print_packager_diagnostics "$host"
    exit 1
  fi

  ensure_watchman_project || true
  launch_metro_background "$host"
  wait_for_metro_ipv4 "$host"
}

# After Metro answers /status, confirm Watchman is actually attached. Retries one
# replace cycle when --start is set (covers races right after launch).
ensure_metro_watcher() {
  local host="$1"
  local attempt

  for attempt in 1 2 3; do
    if metro_watcher_healthy; then
      echo "Metro watcher: live (entry resolves + src edits observed)."
      return 0
    fi
    echo "Metro watcher not ready (attempt ${attempt}/3)…"
    print_metro_watcher_diagnostics
    sleep 1
  done

  if [[ "$DO_START" == "1" || "$DO_CLEAR" == "1" ]]; then
    METRO_WATCHER_HARD_RESET=1 replace_metro "$host" \
      "Metro watcher unhealthy (entry resolve or src-edit probe failed) — replacing…"
    for attempt in 1 2 3 4 5 6 7 8; do
      if metro_watcher_healthy; then
        echo "Metro watcher: live after replace."
        return 0
      fi
      sleep 1
    done
  fi

  echo "error: Metro watcher unhealthy — Fast Refresh will not apply." >&2
  print_packager_diagnostics "$host"
  exit 1
}

sync_env_local() {
  local host="$1"
  local env_file="$ROOT/.env.local"
  local desired="http://${host}:${METRO_PORT}"

  if [[ "$SYNC_ENV" != "1" ]]; then
    return 0
  fi
  if [[ ! -f "$env_file" ]]; then
    echo "note: no .env.local — skip API base sync"
    return 0
  fi

  python3 - "$env_file" "$desired" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
desired = sys.argv[2]
text = path.read_text()
# Only rewrite when the current value looks like a local Metro origin.
pattern = re.compile(
    r'^(EXPO_PUBLIC_API_BASE_URL=)(https?://(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?)(\s*)$',
    re.M,
)
match = pattern.search(text)
if not match:
    print("note: EXPO_PUBLIC_API_BASE_URL is missing or not a local Metro URL — left unchanged")
    raise SystemExit(0)
current = match.group(2)
if current == desired:
    print(f"EXPO_PUBLIC_API_BASE_URL already {desired}")
    raise SystemExit(0)
new_text, n = pattern.subn(rf"\g<1>{desired}\g<3>", text, count=1)
if n:
    path.write_text(new_text)
    print(f"Updated EXPO_PUBLIC_API_BASE_URL {current} → {desired}")
else:
    print("note: could not update EXPO_PUBLIC_API_BASE_URL")
PY
}

# H23: current sim/emu must run the latest local debug client before reconnect.
packager_ensure_native_fresh() {
  if [[ "${AGENT_UI_SKIP_NATIVE_FRESH:-0}" == "1" ]]; then
    return 0
  fi
  # shellcheck source=lib/virtual-device-build.sh
  source "$ROOT/scripts/lib/virtual-device-build.sh"
  local platform="ios"
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    platform=android
  fi
  vd_ensure_current_device_native_fresh "$platform" || true
  if [[ "${AGENT_UI_NATIVE_REFRESHED:-0}" == "1" ]]; then
    echo "Installed latest ${platform} debug client onto the current device."
  fi
}

# When ensuring a pool slot that has no build yet, clone from any peer device.
packager_pool_clone_app_if_needed() {
  if app_installed; then
    return 0
  fi
  case "${AGENT_UI_POOL_MODE:-0}" in
    1|true|TRUE|yes|YES) ;;
    *)
      [[ -n "${AGENT_UI_SLOT:-}" ]] || return 1
      ;;
  esac
  # shellcheck source=lib/agent-ui-pool.sh
  source "$ROOT/scripts/lib/agent-ui-pool.sh"
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    agent_ui_pool_clone_android_app "${ONTRACK_ANDROID_SERIAL:-}" || return 1
  else
    local udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
    if [[ -z "$udid" || "$udid" == "booted" ]]; then
      udid="$(ios_sim_preferred_booted_udid || ios_sim_resolve_udid || true)"
    fi
    [[ -n "$udid" ]] || return 1
    agent_ui_pool_clone_ios_app "$udid" || return 1
  fi
  app_installed
}

# iOS Documents pin only (Android slot = host port — H17).
packager_write_slot_pin() {
  [[ -n "${AGENT_UI_SLOT:-}" ]] || return 0
  case "${AGENT_UI_PLATFORM:-$PACKAGER_TARGET}" in android) return 0 ;; esac
  AGENT_UI_ROOT="$ROOT" \
  AGENT_UI_PLATFORM="${AGENT_UI_PLATFORM:-$PACKAGER_TARGET}" \
  AGENT_UI_SLOT="${AGENT_UI_SLOT}" \
  AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
  BUNDLE_ID="${BUNDLE_ID}" \
  ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
  ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
  ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
    python3 "$ROOT/scripts/lib/agent_ui_bridge.py" write-slot-pin >/dev/null 2>&1 || true
}


reconnect_dev_client() {
  local host="$1"
  local url
  url="$(agent_ui_dev_client_metro_url "$host")"

  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    if ! ensure_preferred_android_emulator; then
      print_packager_diagnostics "$host"
      exit 1
    fi
    if ! app_installed; then
      packager_pool_clone_app_if_needed || true
    fi
    if ! app_installed; then
      echo "error: ${BUNDLE_ID} is not installed on the preferred emulator ($(android_emu_preferred_name))" >&2
      print_packager_diagnostics "$host"
      exit 1
    fi
    if ! android_emu_prepare_metro_dev_client loud; then
      print_packager_diagnostics "$host"
      exit 1
    fi
    android_emu_adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 \
      >/dev/null 2>&1 || true
    echo "Reconnecting Android dev client → http://${host}:${METRO_PORT}"
    android_emu_adb shell am start -a android.intent.action.VIEW -d "$url" >/dev/null 2>&1 || true
    # SDK 57 may accept the VIEW intent but remain at the Development Build
    # server picker (and can then chain into a runtime permission prompt).
    # Clear that bounded native-sheet sequence before waiting for the bridge.
    AGENT_UI_ROOT="$ROOT" ROOT="$ROOT" AGENT_UI_PLATFORM=android \
    ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
    ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
    BUNDLE_ID="$BUNDLE_ID" \
      python3 "$ROOT/scripts/lib/android_system_alert.py" dismiss >/dev/null || true
  else
    if ! ensure_preferred_ios_simulator; then
      print_packager_diagnostics "$host"
      exit 1
    fi
    if ! app_installed; then
      packager_pool_clone_app_if_needed || true
    fi
    if ! app_installed; then
      echo "error: ${BUNDLE_ID} is not installed on the preferred simulator ($(ios_sim_preferred_name))" >&2
      print_packager_diagnostics "$host"
      exit 1
    fi

    local ios_target ios_udid
    ios_target="$(ios_sim_target)"
    ios_udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
    if [[ -z "$ios_udid" || "$ios_udid" == "booted" ]]; then
      ios_udid="$(ios_sim_preferred_booted_udid || ios_sim_resolve_udid || true)"
    fi
    if [[ -n "$ios_udid" ]]; then
      ios_sim_approve_url_schemes "$ios_udid" >/dev/null || true
    else
      ios_sim_approve_url_schemes >/dev/null || true
    fi
    ios_simctl_timed 12 launch "$ios_target" "$BUNDLE_ID" >/dev/null 2>&1 || true
    echo "Reconnecting dev client → http://${host}:${METRO_PORT}"
    ios_simctl_timed 12 openurl "$ios_target" "$url"
    packager_write_slot_pin
  fi

  # Cold starts need 20s+; pool Android cold-bundle needs more.
  local extra=30
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    if [[ "${AGENT_UI_POOL_MODE:-0}" == "1" ]] \
      || [[ "${ONTRACK_ANDROID_AVD:-}" =~ ^onTrack_Agent_[0-9]+$ ]]; then
      if android_emu_adb shell pidof "$BUNDLE_ID" >/dev/null 2>&1; then
        extra=45
      else
        extra=90
      fi
    else
      extra=45
    fi
  fi
  local deadline=$((SECONDS + WAIT_SECS + extra))
  local alert_ticks=0
  # Android: never VIEW a loading app (onNewIntent → FabricUIManager corpse). H17.
  local refire_every=8
  local refire_grace_deadline=$((SECONDS + 25))
  # H21: after H19 cold boot the first simctl launch often no-ops. Re-launch
  # while the process is dead; abort early if it never starts (host launches).
  local process_seen=0
  local process_deadline=$((SECONDS + 12))
  if [[ "$PACKAGER_TARGET" == "android" ]]; then
    refire_every=16
  fi
  while (( SECONDS < deadline )); do
    if probe_connected; then
      echo "Dev client connected (agent-ui dump ok)."
      return 0
    fi
    if app_process_running; then
      process_seen=1
    elif (( process_seen == 0 && SECONDS >= process_deadline )); then
      echo "error: app process never started after launch — aborting reconnect wait (caller will launch)" >&2
      print_packager_diagnostics "$host"
      exit 1
    fi
    if (( alert_ticks > 0 && alert_ticks % refire_every == 0 )); then
      if [[ "$PACKAGER_TARGET" == "android" ]]; then
        android_emu_ensure_adb_reverse >/dev/null 2>&1 || true
        if ! android_emu_adb shell pidof "$BUNDLE_ID" >/dev/null 2>&1; then
          android_emu_adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 \
            >/dev/null 2>&1 || true
          android_emu_adb shell am start -a android.intent.action.VIEW -d "$url" \
            >/dev/null 2>&1 || true
        elif (( SECONDS >= refire_grace_deadline )) \
          && android_emu_force_stop_if_wedged; then
          android_emu_adb shell am start -a android.intent.action.VIEW -d "$url" \
            >/dev/null 2>&1 || true
          refire_grace_deadline=$((SECONDS + 25))
        fi
      else
        # Mirror Android: dead process after cold boot → launch, then Metro URL.
        if ! app_process_running; then
          ios_simctl_timed 12 launch "$(ios_sim_target)" "$BUNDLE_ID" >/dev/null 2>&1 || true
        fi
        ios_simctl_timed 12 openurl "$(ios_sim_target)" "$url" >/dev/null 2>&1 || true
        packager_write_slot_pin
      fi
    fi
    # While waiting, clear native sheets that can arrive after the bundle paint.
    # Android commonly chains server picker -> blank frame -> location prompt,
    # so the one check immediately after VIEW is necessarily too early.
    if (( alert_ticks % 3 == 0 )); then
      if [[ "$PACKAGER_TARGET" == "android" ]]; then
        AGENT_UI_ROOT="$ROOT" ROOT="$ROOT" AGENT_UI_PLATFORM=android \
        ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
        ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
        BUNDLE_ID="$BUNDLE_ID" \
          python3 "$ROOT/scripts/lib/android_system_alert.py" ensure >/dev/null || true
      else
        AGENT_UI_ROOT="$ROOT" AGENT_UI_PLATFORM=ios \
          python3 "$ROOT/scripts/lib/ios_system_alert.py" ensure >/dev/null 2>&1 || true
      fi
    fi
    alert_ticks=$((alert_ticks + 1))
    sleep 0.75
  done
  echo "error: reconnect timed out — check Metro / device launcher" >&2
  print_packager_diagnostics "$host"
  exit 1
}

HOST="$(resolve_host)"
echo "Packager host: ${HOST}:${METRO_PORT}"

start_metro_if_needed "$HOST"

LOCAL_OK=0
HOST_OK=0
http_ok "$(metro_status_url 127.0.0.1)" && LOCAL_OK=1
http_ok "$(metro_status_url "$HOST")" && HOST_OK=1

if [[ "$LOCAL_OK" != "1" && "$HOST_OK" != "1" ]]; then
  if is_ipv6_only_metro; then
    echo "error: Metro is bound to IPv6 only." >&2
  else
    echo "error: Metro /status is not 200" >&2
  fi
  print_packager_diagnostics "$HOST"
  exit 1
fi
echo "Metro /status: localhost=$LOCAL_OK host=$HOST_OK"

ensure_metro_watcher "$HOST"

sync_env_local "$HOST"

# SessionStart / Metro keep-alive: never open Simulator/Emulator. Agents boot the
# preferred device only when verification (agent-ui / reconnect) needs it.
if [[ "$METRO_ONLY" == "1" ]]; then
  echo "Metro-only: skipping device boot/reconnect"
  exit 0
fi

if [[ "$CHECK_ONLY" == "1" ]]; then
  if simulator_booted && app_installed && probe_connected; then
    echo "App probe: connected"
    exit 0
  fi
  echo "App probe: not connected (check-only; not reconnecting)"
  print_packager_diagnostics "$HOST"
  exit 1
fi

# Heal a persisted "Fast Refresh: Off" before deciding whether to reconnect
# (it terminates the app when it flips the toggle, forcing the reconnect below).
ensure_fast_refresh_enabled

if [[ "$DO_FORCE" == "1" ]]; then
  reconnect_dev_client "$HOST"
  exit 0
fi

# Boot preferred device only. Never leave peer iOS sims / Android emulators up.
if [[ "$PACKAGER_TARGET" == "android" ]]; then
  if ! ensure_preferred_android_emulator; then
    echo "note: could not boot preferred emulator — Metro is healthy"
    exit 0
  fi
  if [[ -n "${ONTRACK_ANDROID_SERIAL:-}" ]]; then
    mkdir -p "$ROOT/.cursor"
    printf '%s\n' "$ONTRACK_ANDROID_SERIAL" >"$ROOT/.cursor/android-emulator.serial"
  fi
  if ! app_installed; then
    if packager_pool_clone_app_if_needed; then
      echo "Installed ${BUNDLE_ID} onto pool emulator $(android_emu_preferred_name) via clone."
    else
      echo "note: app not installed on $(android_emu_preferred_name) — Metro is healthy"
      exit 0
    fi
  fi
  packager_ensure_native_fresh
else
  if ! ensure_preferred_ios_simulator; then
    echo "note: could not boot preferred simulator — Metro is healthy"
    exit 0
  fi

  # Install check is cheap; only log when missing (H21 — "already installed"
  # spam made cold boots look like they were reinstalling every turn).
  if ! app_installed; then
    echo "App missing on $(ios_sim_preferred_name) — cloning onto pool simulator…"
    if packager_pool_clone_app_if_needed; then
      echo "Installed ${BUNDLE_ID} onto pool simulator $(ios_sim_preferred_name) via clone."
    else
      echo "note: app not installed on $(ios_sim_preferred_name) — Metro is healthy"
      exit 0
    fi
  fi
  packager_ensure_native_fresh
fi

# H21: cold-boot heal from ensure_app_up only needs the device up. The host
# launches next — burning a full reconnect timeout here just doubles the wait.
if [[ "${AGENT_UI_PACKAGER_SKIP_RECONNECT:-0}" == "1" ]]; then
  echo "Device ready (skip reconnect — caller will launch if needed)."
  exit 0
fi

if [[ "$METRO_RELAUNCHED" == "1" || "${AGENT_UI_NATIVE_REFRESHED:-0}" == "1" ]]; then
  # A fresh Metro process cannot have the app's HMR socket; the stale bundle's
  # agent-ui bridge still answers, so do NOT trust probe_connected here.
  # H23: replacing the native client also kills the JS process.
  echo "Metro or native client was refreshed this run — forcing dev client reconnect…"
  reconnect_dev_client "$HOST"
  exit 0
fi

if probe_connected; then
  # H20: bridge alive ≠ fresh JS. Warm Android often keeps answering on a stale
  # bundle after src edits; wait for the on-disk HMR beacon (watcher may have
  # just bumped it) and soft-reconnect when Fast Refresh missed the device.
  if [[ "${AGENT_UI_SKIP_JS_FRESH:-0}" != "1" ]]; then
    echo "App connected — ensuring JS matches Metro HMR beacon…"
    if ! AGENT_UI_SKIP_LEASE=1 AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
      AGENT_UI_PLATFORM="${AGENT_UI_PLATFORM:-${PACKAGER_TARGET}}" \
      ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
      ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
      python3 "${ROOT}/scripts/lib/agent_ui_bridge.py" ensure-js-fresh --no-bump; then
      echo "HMR beacon still stale — forcing dev client reconnect…"
      reconnect_dev_client "$HOST"
      exit 0
    fi
  fi
  echo "App already connected to packager (JS fresh)."
  exit 0
fi

if app_process_running; then
  echo "App running but agent-ui dump quiet — reconnecting…"
else
  echo "App not running — launching + connecting to Metro…"
fi
reconnect_dev_client "$HOST"
