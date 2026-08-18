#!/usr/bin/env bash
# Shared host helpers for agent-ui file-command bridge (sourced by agent-ui-*.sh).
# Prefer file commands over simctl openurl when the app is already mounted.
# Hot path: scripts/lib/agent_ui_bridge.py (one process per op; disk-cached data dir).

: "${BUNDLE_ID:=com.imtihoss.ontracknow}"
: "${DUMP_NAME:=agent-ui-dump.json}"
: "${STATUS_NAME:=agent-ui-status.json}"
: "${COMMAND_NAME:=agent-ui-command.json}"
: "${POLL_SLEEP:=0.016}"
: "${METRO_PORT:=8081}"
# Host pin for dual-device runs (ios | android). Default ios.
: "${AGENT_UI_PLATFORM:=ios}"
# Wait ceilings (fail-fast when warm). Explicit WAIT_SECS always wins.
: "${AGENT_UI_WARM_WAIT_SECS:=2.5}"
: "${AGENT_UI_WARM_FLOW_WAIT_SECS:=5}"
: "${AGENT_UI_COLD_WAIT_SECS:=6}"
: "${AGENT_UI_COLD_FLOW_WAIT_SECS:=10}"
# Android seed/flow + colder JS need more headroom than iOS.
: "${AGENT_UI_ANDROID_WARM_WAIT_SECS:=5}"
: "${AGENT_UI_ANDROID_WARM_FLOW_WAIT_SECS:=12}"
: "${AGENT_UI_ANDROID_COLD_WAIT_SECS:=12}"
: "${AGENT_UI_ANDROID_COLD_FLOW_WAIT_SECS:=20}"
: "${AGENT_UI_WAIT_TIMEOUT_MS:=2000}"
: "${AGENT_UI_ANDROID_WAIT_TIMEOUT_MS:=4000}"
# If the device/bridge stays quiet this long, assume it went down and restart once.
: "${AGENT_UI_DEVICE_RESPOND_SECS:=10}"
# After an intentional device restart, allow more settle time for boot + JS mount.
: "${AGENT_UI_DEVICE_POST_RESTART_WAIT_SECS:=30}"
: "${AGENT_UI_ANDROID_POST_RESTART_WAIT_SECS:=45}"
# Device pool lease — agent-only devices, 2 slots per platform (4 total).
# No free slot → stop without UI verify (exit 3); 0 = do not queue.
: "${AGENT_UI_LOCK_WAIT_SECS:=0}"
: "${AGENT_UI_POOL_MAX:=2}"
# A device that needs longer than this to launch is a defect to diagnose.
: "${AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS:=30}"

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-ui-pool.sh"
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-ui-dev-client.sh"

# Abort when THIS entry script is piped through head/tail — those buffer until
# exit so Cursor shows “Running…” with no progress for minutes.
# Prefer bare invoke or tee. Escape: AGENT_UI_ALLOW_PIPED_TAIL=1
#
# Only inspect shell lines that mention this entry script. Cursor agent shells
# often pack many commands into one zsh -c blob; a sibling `| tail` must not
# block `agent-ui.sh once` on the next line.
agent_ui_refuse_piped_head_tail() {
  local label="${1:-agent-ui}"
  if [[ "${AGENT_UI_ALLOW_PIPED_TAIL:-0}" == "1" ]]; then
    return 0
  fi
  if [[ -t 1 ]]; then
    return 0
  fi

  local parent_cmd user_cmd entry_base util_h util_t line matched_line=""
  # Use $0 (main script), not BASH_SOURCE[1]: this function is called from
  # host.sh itself, so BASH_SOURCE[1] is agent-ui-host.sh and would no-op.
  entry_base="$(basename "${0:-}")"
  if [[ -z "${entry_base}" || "${entry_base}" == "agent-ui-host.sh" || "${entry_base}" == "bash" || "${entry_base}" == "sh" ]]; then
    return 0
  fi

  parent_cmd="$(ps -o command= -p "${PPID}" 2>/dev/null || true)"
  # Cursor wraps as: zsh -c '…' -- <user command>.
  if [[ "${parent_cmd}" == *' -- '* ]]; then
    user_cmd="${parent_cmd##* -- }"
  else
    user_cmd="${parent_cmd}"
  fi

  util_h="he"; util_h="${util_h}ad"
  util_t="ta"; util_t="${util_t}il"

  # Cursor ps(1) often embeds literal \012 for newlines inside zsh -c blobs.
  user_cmd="${user_cmd//\\012/$'\n'}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${line}" != *"${entry_base}"* ]]; then
      continue
    fi
    # Only when THIS entry's stdout is piped: `script … | head|tail`.
    # Sibling `jest | tail && script` must not match (runtime false positive).
    # Allow `/usr/bin/head` as well as bare `head`.
    if printf '%s\n' "${line}" | grep -Eq "${entry_base}"'.*\|[[:space:]]*(.*/)?('"${util_h}"'|'"${util_t}"')([[:space:]]|$)'; then
      matched_line="${line:0:180}"
      echo "error: ${label}: stdout is piped through head/tail — progress buffers until exit (looks hung). Drop the pipe (or use tee). Escape: AGENT_UI_ALLOW_PIPED_TAIL=1" >&2
      exit 2
    fi
  done <<< "${user_cmd}"
}

agent_ui_platform() {
  case "${AGENT_UI_PLATFORM:-ios}" in
    android|ANDROID) printf '%s\n' "android" ;;
    *) printf '%s\n' "ios" ;;
  esac
}

agent_ui_is_android() {
  [[ "$(agent_ui_platform)" == "android" ]]
}

agent_ui_repo_root() {
  if [[ -n "${AGENT_UI_ROOT:-}" ]]; then
    printf '%s\n' "${AGENT_UI_ROOT}"
    return 0
  fi
  if [[ -n "${ROOT:-}" && -f "${ROOT}/scripts/ensure-packager.sh" ]]; then
    printf '%s\n' "${ROOT}"
    return 0
  fi
  # scripts/lib → repo root (subshell so sourcing never chdirs the caller)
  printf '%s\n' "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
}

agent_ui_lock_dir() {
  if [[ -n "${AGENT_UI_LOCK_DIR:-}" ]]; then
    printf '%s\n' "${AGENT_UI_LOCK_DIR}"
    return 0
  fi
  if [[ -n "${AGENT_UI_SLOT:-}" ]]; then
    agent_ui_pool_slot_lockdir "$AGENT_UI_SLOT"
    return 0
  fi
  printf '%s\n' "$(agent_ui_repo_root)/.cursor/agent-ui.lockdir"
}

# agent_ui_ensure_lease / agent_ui_release_lease → scripts/lib/agent-ui-pool.sh

agent_ui_bridge_py() {
  printf '%s\n' "$(agent_ui_repo_root)/scripts/lib/agent_ui_bridge.py"
}

agent_ui_ios_lib() {
  # shellcheck disable=SC1091
  source "$(agent_ui_repo_root)/scripts/lib/ios-simulator.sh"
}

# True when the daemon is up and a successful op landed recently (~30s).
agent_ui_bridge_is_warm() {
  AGENT_UI_ROOT="$(agent_ui_repo_root)" \
    python3 "$(agent_ui_bridge_py)" warm >/dev/null 2>&1
}

agent_ui_bridge_http_port() {
  local platform="${1:-$(agent_ui_platform)}"
  local port="${AGENT_UI_HTTP_PORT:-8191}"
  if [[ "$platform" != "android" ]]; then
    printf '%s\n' "$port"
    return 0
  fi
  if [[ "$port" == "8191" && -n "${AGENT_UI_SLOT:-}" && "${AGENT_UI_SLOT}" =~ ^[1-9][0-9]*$ ]]; then
    printf '%s\n' "$((port + AGENT_UI_SLOT))"
    return 0
  fi
  printf '%s\n' "$port"
}

agent_ui_ensure_daemon() {
  AGENT_UI_ROOT="$(agent_ui_repo_root)" \
    AGENT_UI_HTTP_PORT="$(agent_ui_bridge_http_port)" \
    python3 "$(agent_ui_bridge_py)" ensure-daemon >/dev/null 2>&1
}

# Apply fail-fast WAIT_SECS for simple|flow budgets.
# Respects an already-set WAIT_SECS (e.g. WAIT_SECS=30 ./scripts/agent-ui-flow.sh …).
# Usage: agent_ui_apply_wait_budget simple|flow
agent_ui_apply_wait_budget() {
  local kind="${1:-simple}"
  if [[ -n "${WAIT_SECS:-}" ]]; then
    export WAIT_SECS
    return 0
  fi
  if agent_ui_is_android; then
    if agent_ui_bridge_is_warm; then
      if [[ "${kind}" == "flow" ]]; then
        WAIT_SECS="${AGENT_UI_ANDROID_WARM_FLOW_WAIT_SECS}"
      else
        WAIT_SECS="${AGENT_UI_ANDROID_WARM_WAIT_SECS}"
      fi
    else
      if [[ "${kind}" == "flow" ]]; then
        WAIT_SECS="${AGENT_UI_ANDROID_COLD_FLOW_WAIT_SECS}"
      else
        WAIT_SECS="${AGENT_UI_ANDROID_COLD_WAIT_SECS}"
      fi
    fi
    # Bump in-app wait ceiling unless the caller already overrode it.
    if [[ "${AGENT_UI_WAIT_TIMEOUT_MS}" == "2000" ]]; then
      AGENT_UI_WAIT_TIMEOUT_MS="${AGENT_UI_ANDROID_WAIT_TIMEOUT_MS}"
    fi
    export AGENT_UI_WAIT_TIMEOUT_MS
  elif agent_ui_bridge_is_warm; then
    if [[ "${kind}" == "flow" ]]; then
      WAIT_SECS="${AGENT_UI_WARM_FLOW_WAIT_SECS}"
    else
      WAIT_SECS="${AGENT_UI_WARM_WAIT_SECS}"
    fi
  else
    if [[ "${kind}" == "flow" ]]; then
      WAIT_SECS="${AGENT_UI_COLD_FLOW_WAIT_SECS}"
    else
      WAIT_SECS="${AGENT_UI_COLD_WAIT_SECS}"
    fi
  fi
  export WAIT_SECS
}

agent_ui_android_lib() {
  # shellcheck source=android-emulator.sh
  source "$(agent_ui_repo_root)/scripts/lib/android-emulator.sh"
}

# Pin adb to the preferred AVD serial. Required when Galaxy_S26 and onTrack_Agent_N
# are both booted — bare `adb` otherwise hits the first emulator.
agent_ui_pin_android_serial() {
  agent_ui_is_android || return 0
  agent_ui_android_lib
  local serial
  serial="$(android_emu_preferred_serial || true)"
  if [[ -z "$serial" ]]; then
    return 1
  fi
  export ONTRACK_ANDROID_SERIAL="$serial"
  export ANDROID_SERIAL="$serial"
  return 0
}

# True when the host device answers a cheap RPC within AGENT_UI_DEVICE_RESPOND_SECS.
# Timed so a wedged CoreSimulator / dead qemu cannot hang the agent forever.
agent_ui_device_host_responds() {
  local secs="${AGENT_UI_DEVICE_RESPOND_SECS:-10}"
  if agent_ui_is_android; then
    agent_ui_android_lib
    agent_ui_pin_android_serial || return 1
    local adb_bin
    adb_bin="$(android_emu_sdk_bin adb)"
    [[ -n "$adb_bin" ]] || return 1
    local -a adb_cmd=("$adb_bin")
    if [[ -n "${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" ]]; then
      adb_cmd+=(-s "${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL}}")
    fi
    adb_cmd+=(get-state)
    perl -e 'alarm shift @ARGV; exec @ARGV' "$secs" "${adb_cmd[@]}" >/dev/null 2>&1
    return $?
  fi
  agent_ui_ios_lib
  ios_simctl_timed "$secs" list devices booted >/dev/null 2>&1
}

# Shut down + reboot the preferred sim/emu for this platform (once per call site).
# Escape: AGENT_UI_SKIP_DEVICE_RESTART=1.
agent_ui_restart_device() {
  if [[ "${AGENT_UI_SKIP_DEVICE_RESTART:-0}" == "1" ]]; then
    return 1
  fi
  if agent_ui_is_android; then
    agent_ui_android_lib
    local name serial
    name="$(android_emu_preferred_name)"
    serial="$(android_emu_preferred_serial || true)"
    echo "agent-ui: ${name} not responding — restarting emulator…" >&2
    if [[ -n "$serial" ]]; then
      android_emu_adb emu kill >/dev/null 2>&1 || true
      local kill_deadline=$((SECONDS + 20))
      while (( SECONDS < kill_deadline )); do
        serial="$(android_emu_preferred_serial || true)"
        [[ -z "$serial" ]] && break
        sleep 0.5
      done
    fi
    unset ONTRACK_ANDROID_SERIAL ANDROID_SERIAL
    ensure_preferred_android_emulator || return 1
    agent_ui_pin_android_serial || true
    return 0
  fi
  agent_ui_ios_lib
  local name udid root
  name="$(ios_sim_preferred_name)"
  udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  if [[ -z "$udid" || "$udid" == "booted" ]]; then
    udid="$(ios_sim_resolve_udid 2>/dev/null || true)"
  fi
  echo "agent-ui: ${name} not responding — restarting simulator…" >&2
  if [[ -n "$udid" ]]; then
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  fi
  # Container path can change after reboot — drop stale caches.
  root="$(agent_ui_repo_root)"
  rm -f "${root}/.cursor/agent-ui-data-dir" 2>/dev/null || true
  if [[ -n "$udid" ]]; then
    rm -f "${root}/.cursor/agent-ui-data-dir-${udid}" 2>/dev/null || true
  fi
  unset AGENT_UI_DATA_DIR
  ensure_preferred_ios_simulator || return 1
  return 0
}

agent_ui_simulator_booted() {
  if agent_ui_is_android; then
    agent_ui_android_lib
    agent_ui_pin_android_serial || return 1
    # Require sys.boot_completed — adb "device" alone is mid-boot and flaky.
    android_emu_is_ready
    return $?
  fi
  agent_ui_ios_lib
  local secs="${AGENT_UI_DEVICE_RESPOND_SECS:-10}"
  local listed
  listed="$(ios_simctl_timed "$secs" list devices booted 2>/dev/null || true)"
  [[ -n "$listed" ]] || return 1
  if [[ -n "${ONTRACK_IOS_SIMULATOR_UDID:-}" ]]; then
    printf '%s\n' "$listed" | grep -q "${ONTRACK_IOS_SIMULATOR_UDID}"
    return $?
  fi
  printf '%s\n' "$listed" | grep -q Booted
}

agent_ui_app_installed() {
  if agent_ui_is_android; then
    agent_ui_pin_android_serial || return 1
    android_emu_adb shell pm path "$BUNDLE_ID" 2>/dev/null | grep -q "package:" || return 1
    # Agent UI is dev-only. A release APK can launch successfully while never
    # mounting the HTTP bridge, which otherwise looks like a Metro timeout.
    android_emu_adb shell run-as "$BUNDLE_ID" true >/dev/null 2>&1
    return $?
  fi
  agent_ui_ios_lib
  ios_simctl_timed get_app_container "$(ios_sim_target)" "$BUNDLE_ID" data >/dev/null 2>&1
}

# True when the app process has a PID in the simulator (not merely installed).
agent_ui_app_process_running() {
  if agent_ui_is_android; then
    agent_ui_android_lib
    android_emu_adb shell pidof -s "$BUNDLE_ID" >/dev/null 2>&1
    return $?
  fi
  agent_ui_ios_lib
  ios_simctl_timed spawn "$(ios_sim_target)" launchctl list 2>/dev/null \
    | grep -E "^[0-9]+[[:space:]]+.*UIKitApplication:${BUNDLE_ID}" >/dev/null
}

agent_ui_launch_app() {
  if agent_ui_is_android; then
    agent_ui_android_lib
    android_emu_adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 \
      >/dev/null 2>&1 || \
      android_emu_adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
        -n "${BUNDLE_ID}/.MainActivity" >/dev/null 2>&1 || true
    return 0
  fi
  agent_ui_ios_lib
  ios_simctl_timed 12 launch "$(ios_sim_target)" "$BUNDLE_ID" >/dev/null 2>&1 || true
}

agent_ui_open_dev_client_url() {
  local url="$1"
  if agent_ui_is_android; then
    agent_ui_android_lib
    android_emu_adb shell am start -a android.intent.action.VIEW -d "$url" >/dev/null 2>&1 || true
    return 0
  fi
  agent_ui_ios_lib
  # Trust custom schemes before openurl so SpringBoard skips "Open in …?".
  if [[ -n "${ONTRACK_IOS_SIMULATOR_UDID:-}" ]]; then
    ios_sim_approve_url_schemes "$ONTRACK_IOS_SIMULATOR_UDID" >/dev/null || true
  else
    ios_sim_approve_url_schemes >/dev/null || true
  fi
  ios_simctl_timed 12 openurl "$(ios_sim_target)" "$url" >/dev/null 2>&1 || true
}


# iOS only: deep-link the pool slot. Android uses host-port routing (H17).
agent_ui_pin_slot() {
  local slot="${1:-${AGENT_UI_SLOT:-}}"
  [[ -n "$slot" ]] || return 0
  agent_ui_is_android && return 0
  local url="ontrack://agent/ui?op=route&slot=${slot}"
  agent_ui_open_dev_client_url "$url"
}

# Cheap bridge liveness (route status). Skips nested app-up / heal recursion.
# Requires ok=true + non-empty route (agent-ui-route.sh exits 1 on allow_fail timeouts).
agent_ui_bridge_answers() {
  local root wait_secs=1.5 route
  root="$(agent_ui_repo_root)" || return 1
  if agent_ui_is_android; then
    wait_secs=3
    # HTTP status can come from any android client (e.g. Galaxy while the
    # pool targets onTrack_Agent_N). Require the pinned AVD actually runs the app.
    agent_ui_android_lib
    agent_ui_pin_android_serial || return 1
    agent_ui_app_process_running || return 1
    # A live PID is not a live bridge: a dead JS runtime keeps the process up,
    # so the route below can be answered by a leftover app on a peer AVD that
    # adopted our slot while this device shows nothing (asserts fail route=?).
    if ! android_emu_app_bridge_connected; then
      return 1
    fi
  else
    # Same hazard on iOS: the user's headed sim answers :8191 while the lease
    # targets a Shutdown 'onTrack Agent N'. Host ops (screenshot / --color) are
    # bound to the leased UDID, so a foreign answer means "up" here and
    # "device not Booted" there. Require the leased sim to run the app.
    agent_ui_ios_lib
    agent_ui_app_process_running || return 1
  fi
  route="$(
    AGENT_UI_SKIP_APP_UP=1 AGENT_UI_SKIP_HEAL=1 AGENT_UI_PLATFORM="$(agent_ui_platform)" \
      AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-0}" \
      AGENT_UI_LOCK_ACQUIRED=0 \
      AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
      AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
      ONTRACK_IOS_SIMULATOR="${ONTRACK_IOS_SIMULATOR:-}" \
      ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
      ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
      ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
      WAIT_SECS="${wait_secs}" \
      "${root}/scripts/agent-ui-route.sh" 2>/dev/null
  )" || return 1
  [[ -n "${route}" ]]
}

# True when a successful agent-ui op landed recently (avoids heal churn).
agent_ui_bridge_recently_ok() {
  local root path age
  root="$(agent_ui_repo_root)" || return 1
  path="${root}/.cursor/agent-ui-last-ok"
  [[ -f "$path" ]] || return 1
  age="$(python3 -c "import time,pathlib; p=pathlib.Path(r'''${path}''');
print(time.time()-float(p.read_text().strip() or 0))" 2>/dev/null || echo 999)"
  python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) < 45 else 1)" "$age" 2>/dev/null
}

# Start/reconnect Metro only after a real bridge timeout — never on the happy path.
# Skips when AGENT_UI_SKIP_HEAL=1 (ensure-packager probes must not recurse).
agent_ui_heal_packager() {
  if [[ "${AGENT_UI_SKIP_HEAL:-0}" == "1" ]]; then
    return 1
  fi
  local root
  root="$(agent_ui_repo_root)" || return 1
  local ensure="${root}/scripts/ensure-packager.sh"
  if [[ ! -x "$ensure" && ! -f "$ensure" ]]; then
    return 1
  fi

  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 \
    "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null || true)"
  if [[ "$code" == "200" ]]; then
    # Metro is up — cheap route probe (not a full dump).
    if AGENT_UI_SKIP_APP_UP=1 AGENT_UI_SKIP_HEAL=1 WAIT_SECS=1.5 \
      AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-0}" \
      AGENT_UI_LOCK_ACQUIRED=0 \
      "${root}/scripts/agent-ui-route.sh" >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "agent-ui: healing packager (Metro status=${code:-down})…" >&2
  local -a ensure_flags=(--start)
  if agent_ui_is_android; then
    ensure_flags+=(--android)
  fi
  if AGENT_UI_SKIP_HEAL=1 AGENT_UI_SKIP_APP_UP=1 AGENT_UI_PLATFORM="$(agent_ui_platform)" \
    AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-0}" \
    AGENT_UI_LOCK_ACQUIRED=0 \
    AGENT_UI_PACKAGER_SKIP_RECONNECT="${AGENT_UI_PACKAGER_SKIP_RECONNECT:-0}" \
    bash "$ensure" "${ensure_flags[@]}"; then
    return 0
  fi
  return 1
}

# Dismiss blocking iOS SpringBoard sheets (Apple Account, etc.) when present.
# No-op on Android / when AGENT_UI_SKIP_IOS_ALERTS=1. Cached clear ~90s.
agent_ui_ensure_ios_system_alerts_clear() {
  if agent_ui_is_android; then
    return 0
  fi
  if [[ "${AGENT_UI_SKIP_IOS_ALERTS:-0}" == "1" ]]; then
    return 0
  fi
  AGENT_UI_ROOT="$(agent_ui_repo_root)" AGENT_UI_PLATFORM="$(agent_ui_platform)" \
    python3 "$(agent_ui_repo_root)/scripts/lib/ios_system_alert.py" ensure
}

# Dismiss blocking Android Expo Dev Menu (intro Continue / tools BACK) and
# persist showsAtLaunch=false so cold starts stay clear. Cached clear ~90s.
# No-op on iOS / when AGENT_UI_SKIP_ANDROID_ALERTS=1.
agent_ui_ensure_android_system_alerts_clear() {
  if ! agent_ui_is_android; then
    return 0
  fi
  if [[ "${AGENT_UI_SKIP_ANDROID_ALERTS:-0}" == "1" ]]; then
    return 0
  fi
  AGENT_UI_ROOT="$(agent_ui_repo_root)" AGENT_UI_PLATFORM=android \
  ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
  ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
  BUNDLE_ID="${BUNDLE_ID}" \
    python3 "$(agent_ui_repo_root)/scripts/lib/android_system_alert.py" ensure
}

# iOS Documents pin so the bridge polls platform:slot. Android: no-op (H17).
agent_ui_write_slot_pin() {
  [[ -n "${AGENT_UI_SLOT:-}" ]] || return 0
  agent_ui_is_android && return 0
  AGENT_UI_ROOT="$(agent_ui_repo_root)" \
  AGENT_UI_PLATFORM="$(agent_ui_platform)" \
  AGENT_UI_SLOT="${AGENT_UI_SLOT}" \
  AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
  BUNDLE_ID="${BUNDLE_ID}" \
  ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
  ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
  ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
    python3 "$(agent_ui_bridge_py)" write-slot-pin >/dev/null 2>&1 || true
}

# Soft reconnect Metro. Android: reverse + wedge heal + VIEW (H17). iOS: + pin.
agent_ui_soft_reconnect_dev_client() {
  local url
  url="$(agent_ui_dev_client_metro_url)"
  if agent_ui_is_android; then
    agent_ui_android_lib
    android_emu_prepare_metro_dev_client || true
    agent_ui_open_dev_client_url "$url"
    # Expo SDK 57 can land on the Development Build server picker after a
    # cold install even when the custom URL was delivered. Select the visible
    # Metro server semantically instead of waiting out the bridge budget.
    AGENT_UI_ROOT="$(agent_ui_repo_root)" AGENT_UI_PLATFORM=android \
    ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
    ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-${ANDROID_SERIAL:-}}" \
    BUNDLE_ID="${BUNDLE_ID}" \
      python3 "$(agent_ui_repo_root)/scripts/lib/android_system_alert.py" dismiss \
      >/dev/null || true
    return 0
  fi
  agent_ui_open_dev_client_url "$url"
  agent_ui_write_slot_pin
  sleep 0.8
  agent_ui_pin_slot "${AGENT_UI_SLOT:-}" || true
  return 0
}

# Clone the app onto a pool device when the slot is empty.
agent_ui_pool_ensure_app_installed() {
  [[ -n "${AGENT_UI_SLOT:-}" || "${AGENT_UI_POOL_MODE:-0}" == "1" ]] || return 1
  if agent_ui_app_installed; then
    return 0
  fi
  if agent_ui_is_android; then
    echo "agent-ui: cloning app onto pool Android device…" >&2
    agent_ui_android_lib
    agent_ui_pool_clone_android_app "${ONTRACK_ANDROID_SERIAL:-}" || return 1
  else
    echo "agent-ui: cloning app onto pool iOS device…" >&2
    local udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
    if [[ -z "$udid" || "$udid" == "booted" ]]; then
      agent_ui_ios_lib
      udid="$(ios_sim_resolve_udid 2>/dev/null || true)"
    fi
    [[ -n "$udid" ]] || return 1
    agent_ui_pool_clone_ios_app "$udid" || return 1
  fi
  agent_ui_app_installed
}

# Wait until the bridge answers (or deadline). iOS pin once up front.
agent_ui_wait_for_bridge() {
  local deadline_secs="${1:-12}"
  local started=$SECONDS
  local deadline=$((SECONDS + deadline_secs))
  local last_beat=$SECONDS
  local label="iOS bridge"
  if agent_ui_is_android; then
    label="Android bridge"
  fi
  agent_ui_write_slot_pin
  while (( SECONDS < deadline )); do
    if agent_ui_bridge_answers; then
      return 0
    fi
    if (( SECONDS - last_beat >= 5 )); then
      echo "agent-ui: still waiting for ${label}… ($((SECONDS - started))s / ${deadline_secs}s)" >&2
      last_beat=$SECONDS
    fi
    sleep 0.4
  done
  return 1
}

# Bridge answered — pin (iOS only) + clear covering system sheets.
agent_ui_finish_app_up() {
  if [[ -n "${AGENT_UI_SLOT:-}" ]]; then
    agent_ui_write_slot_pin
    agent_ui_pin_slot "${AGENT_UI_SLOT}" || true
  fi
  # Headed Android: bridge-ok can still be a blank SurfaceView after window restart.
  if agent_ui_is_android; then
    agent_ui_android_lib
    if android_emu_want_app_surface; then
      if ! android_emu_ensure_app_surface 0; then
        echo "error: Android app surface still blank/white after handoff heal" >&2
        return 1
      fi
    fi
  fi
  # Drop orphaned CoreSimulator screenshot RPCs left by prior timed-out xcrun
  # parents — they wedge install/launch for every other agent on the host.
  if ! agent_ui_is_android; then
    local udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
    if [[ -n "$udid" && "$udid" != "booted" ]]; then
      pkill -9 -f "simctl io ${udid} screenshot" 2>/dev/null || true
    fi
  fi
  # Alert OCR: headed viewer hard-fails if surfaces stay unavailable (never
  # green-blind). True headless + headless Agent-pool leases soft-continue
  # inside ios_system_alert.py after a bounded capture heal.
  if ! agent_ui_ensure_ios_system_alerts_clear; then
    agent_ui_ios_lib 2>/dev/null || true
    if ios_sim_app_running 2>/dev/null && [[ "${ONTRACK_IOS_SIMULATOR_WINDOW:-0}" == "1" ]]; then
      echo "error: iOS system-alert clear failed while headed Simulator is required" >&2
      return 1
    fi
    echo "agent-ui: iOS system-alert clear failed — continuing (bridge is up)" >&2
  fi
  # Android Expo Dev Menu intro/tools sheet blocks taps + screenshots until
  # Continue/BACK — mirror iOS ensure (also suppresses showsAtLaunch prefs).
  if ! agent_ui_ensure_android_system_alerts_clear; then
    echo "agent-ui: Android system-alert clear failed — continuing (bridge is up)" >&2
  fi
  return 0
}

# Install the latest local debug client onto the current sim/emu when the
# on-disk .app/.apk is newer than the last install (H23). Rebuilds only when
# native sources outpace that artifact. Escape: AGENT_UI_SKIP_NATIVE_FRESH=1.
agent_ui_ensure_native_fresh() {
  AGENT_UI_NATIVE_REFRESHED=0
  if [[ "${AGENT_UI_SKIP_NATIVE_FRESH:-0}" == "1" ]]; then
    return 0
  fi
  if [[ "${AGENT_UI_NATIVE_FRESH_DONE:-0}" == "1" ]]; then
    return 0
  fi
  # shellcheck source=virtual-device-build.sh
  source "$(agent_ui_repo_root)/scripts/lib/virtual-device-build.sh"
  if agent_ui_is_android; then
    agent_ui_android_lib
    vd_ensure_current_device_native_fresh android || return 1
  else
    agent_ui_ios_lib
    vd_ensure_current_device_native_fresh ios || return 1
  fi
  AGENT_UI_NATIVE_FRESH_DONE=1
}

# Gate verification: app must be up on the device (bridge answering).
# Happy path = one cheap route probe. Soft-launch / heal only when down.
# Skip with AGENT_UI_SKIP_APP_UP=1 (nested probes / ensure-packager recursion).
agent_ui_ensure_app_up() {
  if [[ "${AGENT_UI_SKIP_APP_UP:-0}" == "1" ]]; then
    return 0
  fi

  # Agent-only devices: refuse to drive the user's simulator/emulator.
  if agent_ui_is_android; then
    agent_ui_assert_agent_device_bound android || return 1
  else
    agent_ui_assert_agent_device_bound ios || return 1
  fi

  # Android: emulator must be fully booted before any bridge/test work.
  # Mid-boot adb "device" + allow_fail route timeouts used to look "up" and
  # produce verify failed route=?. Pin serial before any probe so we never talk to Galaxy_S26
  # while ONTRACK_ANDROID_AVD=onTrack_Agent_N.
  if agent_ui_is_android; then
    agent_ui_android_lib
    if ! android_emu_is_ready; then
      echo "agent-ui: Android emulator not ready — ensuring boot…" >&2
      if ! android_emu_ensure_ready; then
        echo "error: Android emulator is not up and ready" >&2
        return 1
      fi
    else
      agent_ui_pin_android_serial || true
      android_emu_ensure_adb_reverse >/dev/null 2>&1 || true
    fi
  fi

  # H23: warm bridge can still be a stale native binary. Refresh the current
  # device from the latest local debug client before trusting the probe.
  if agent_ui_simulator_booted; then
    if ! agent_ui_app_installed; then
      agent_ui_pool_ensure_app_installed || true
    fi
    agent_ui_ensure_native_fresh || return 1
    if [[ "${AGENT_UI_NATIVE_REFRESHED:-0}" == "1" ]]; then
      echo "agent-ui: relaunching after native debug client refresh…" >&2
      agent_ui_launch_app
      agent_ui_soft_reconnect_dev_client
      if agent_ui_wait_for_bridge "${AGENT_UI_DEVICE_RESPOND_SECS:-10}"; then
        agent_ui_finish_app_up
        return $?
      fi
    elif agent_ui_bridge_answers; then
      agent_ui_finish_app_up
      return $?
    fi
  elif agent_ui_bridge_answers; then
    agent_ui_finish_app_up
    return $?
  fi

  local device_label="simulator"
  local reverse_was_missing=0
  local respond_secs="${AGENT_UI_DEVICE_RESPOND_SECS:-10}"
  local device_restarted=0
  if agent_ui_is_android; then
    device_label="emulator"
    # Cheap fix first: missing adb reverse breaks 127.0.0.1 Metro + daemon.
    agent_ui_pin_android_serial || true
    agent_ui_android_lib
    if android_emu_ensure_adb_reverse >/dev/null 2>&1; then
      if [[ "${ANDROID_EMU_REVERSE_ADDED:-0}" == "1" ]]; then
        reverse_was_missing=1
      fi
      if agent_ui_bridge_answers; then
        agent_ui_finish_app_up
        return $?
      fi
    fi
  fi

  # Prefer soft wait over reconnect/heal when the app is still alive.
  # (Android heal drops onto `/`; iOS sim restart is also expensive.)
  if agent_ui_app_process_running && agent_ui_bridge_recently_ok; then
    if agent_ui_is_android; then
      echo "agent-ui: Android bridge quiet but recently ok — soft wait…" >&2
    else
      echo "agent-ui: iOS bridge quiet but recently ok — soft wait…" >&2
    fi
    if agent_ui_wait_for_bridge "$respond_secs"; then
      agent_ui_finish_app_up
      return $?
    fi
  fi

  # Host RPC dead within the respond window → assume device went down.
  if ! agent_ui_device_host_responds; then
    echo "agent-ui: ${device_label} host not responding within ${respond_secs}s — restarting…" >&2
    if agent_ui_restart_device; then
      device_restarted=1
    fi
  fi

  if ! agent_ui_simulator_booted; then
    # H21: boot only — do not wait on ensure-packager's reconnect timeout.
    # After H19 safe-shutdown the app process is dead; launch below is the
    # real connect step. A failed reconnect used to burn 40–60s first.
    echo "agent-ui: ${device_label} not booted — booting device…" >&2
    if AGENT_UI_PACKAGER_SKIP_RECONNECT=1 agent_ui_heal_packager \
      && agent_ui_bridge_answers; then
      agent_ui_finish_app_up
      return $?
    fi
    # Heal often boots the device even when the bridge is still quiet (e.g. app
    # missing on a fresh pool slot). Fall through to clone/launch instead of
    # mis-reporting "not booted".
    if ! agent_ui_simulator_booted; then
      if (( device_restarted == 0 )); then
        echo "agent-ui: ${device_label} still down — restarting once…" >&2
        if agent_ui_restart_device; then
          device_restarted=1
        fi
      fi
      if ! agent_ui_simulator_booted; then
        echo "error: ${device_label} is not booted (and restart/heal failed)" >&2
        return 1
      fi
    fi
  fi

  if ! agent_ui_app_installed; then
    if agent_ui_pool_ensure_app_installed; then
      :
    else
      echo "error: ${BUNDLE_ID} is not installed on the booted ${device_label}" >&2
      return 1
    fi
  fi
  agent_ui_ensure_native_fresh || return 1

  if ! agent_ui_app_process_running; then
    echo "agent-ui: app not running — launching ${BUNDLE_ID}…" >&2
    agent_ui_launch_app
    # Fresh pool slots need the Metro deep-link, not just a launcher start.
    if [[ -n "${AGENT_UI_SLOT:-}" || "${AGENT_UI_POOL_MODE:-0}" == "1" ]]; then
      agent_ui_soft_reconnect_dev_client
    else
      agent_ui_write_slot_pin
    fi
  else
    # Soft reconnect (Metro URL) before assuming the device is dead.
    echo "agent-ui: ${device_label} bridge quiet — soft reconnecting dev client…" >&2
    agent_ui_soft_reconnect_dev_client
  fi

  if [[ "$reverse_was_missing" == "1" ]]; then
    echo "agent-ui: adb reverse was missing — healing packager once…" >&2
    if agent_ui_heal_packager && agent_ui_bridge_answers; then
      agent_ui_finish_app_up
      return $?
    fi
  fi

  # After launch/reconnect, wait for the JS bridge. Android cold bundles often
  # need far longer than AGENT_UI_DEVICE_RESPOND_SECS (default 10) — restarting
  # qemu here was the main Android verify flake (kill mid-bundle → minutes lost).
  # Warm path (process up + recent ok) uses a shorter budget on both platforms.
  local bridge_wait="$respond_secs"
  if agent_ui_is_android; then
    if agent_ui_app_process_running && agent_ui_bridge_recently_ok; then
      bridge_wait="${AGENT_UI_ANDROID_WARM_BRIDGE_WAIT_SECS:-15}"
    else
      bridge_wait="${AGENT_UI_ANDROID_BRIDGE_WAIT_SECS:-60}"
    fi
  elif agent_ui_app_process_running && agent_ui_bridge_recently_ok; then
    bridge_wait="${AGENT_UI_IOS_WARM_BRIDGE_WAIT_SECS:-10}"
  fi
  if agent_ui_wait_for_bridge "$bridge_wait"; then
    agent_ui_finish_app_up
    return $?
  fi

  # App process alive ⇒ device is fine. Soft-reconnect / heal only — never
  # restart qemu / simctl mid-bundle.
  if agent_ui_app_process_running; then
    if agent_ui_is_android; then
      echo "agent-ui: Android app running but bridge quiet — soft reconnect + wait…" >&2
    else
      echo "agent-ui: iOS app running but bridge quiet — soft reconnect + wait…" >&2
    fi
    agent_ui_soft_reconnect_dev_client
    local quiet_wait="$bridge_wait"
    if agent_ui_is_android; then
      quiet_wait="${AGENT_UI_ANDROID_BRIDGE_WAIT_SECS:-60}"
      if agent_ui_bridge_recently_ok; then
        quiet_wait="${AGENT_UI_ANDROID_WARM_BRIDGE_WAIT_SECS:-15}"
      fi
    elif agent_ui_bridge_recently_ok; then
      quiet_wait="${AGENT_UI_IOS_WARM_BRIDGE_WAIT_SECS:-10}"
    else
      quiet_wait="${AGENT_UI_IOS_BRIDGE_WAIT_SECS:-30}"
    fi
    if agent_ui_wait_for_bridge "$quiet_wait"; then
      agent_ui_finish_app_up
      return $?
    fi
    echo "agent-ui: app bridge not answering — healing packager…" >&2
    if agent_ui_heal_packager && agent_ui_bridge_answers; then
      agent_ui_finish_app_up
      return $?
    fi
    echo "error: ${BUNDLE_ID} is not up on the ${device_label} (bridge not answering)" >&2
    return 1
  fi

  if (( device_restarted == 0 )); then
    echo "agent-ui: ${device_label} not responding within ${bridge_wait}s — assuming down, restarting…" >&2
    if agent_ui_restart_device; then
      device_restarted=1
      if ! agent_ui_app_installed; then
        agent_ui_pool_ensure_app_installed || true
      fi
      if ! agent_ui_app_installed; then
        echo "error: ${BUNDLE_ID} is not installed after ${device_label} restart" >&2
        return 1
      fi
      echo "agent-ui: relaunching ${BUNDLE_ID} after ${device_label} restart…" >&2
      agent_ui_launch_app
      agent_ui_soft_reconnect_dev_client
      local post_wait="${AGENT_UI_DEVICE_POST_RESTART_WAIT_SECS:-30}"
      if agent_ui_is_android; then
        post_wait="${AGENT_UI_ANDROID_POST_RESTART_WAIT_SECS:-60}"
      fi
      if agent_ui_wait_for_bridge "$post_wait"; then
        agent_ui_finish_app_up
        return $?
      fi
    fi
  fi

  echo "agent-ui: app bridge not answering — healing packager…" >&2
  if agent_ui_heal_packager && agent_ui_bridge_answers; then
    agent_ui_finish_app_up
    return $?
  fi

  echo "error: ${BUNDLE_ID} is not up on the ${device_label} (bridge not answering)" >&2
  return 1
}

agent_ui_data_dir() {
  if agent_ui_is_android; then
    # Host-side dump cache (no adb Documents pull).
    local root
    root="$(agent_ui_repo_root)"
    mkdir -p "${root}/.cursor"
    printf '%s\n' "${root}/.cursor"
    return 0
  fi
  if [[ -n "${AGENT_UI_DATA_DIR:-}" && -d "${AGENT_UI_DATA_DIR}" ]]; then
    printf '%s\n' "${AGENT_UI_DATA_DIR}"
    return 0
  fi
  local dir
  dir="$(AGENT_UI_ROOT="$(agent_ui_repo_root)" \
    BUNDLE_ID="${BUNDLE_ID}" \
    python3 "$(agent_ui_bridge_py)" data-dir)" || return 1
  AGENT_UI_DATA_DIR="${dir}"
  export AGENT_UI_DATA_DIR
  printf '%s\n' "${dir}"
}

agent_ui_paths() {
  if agent_ui_is_android; then
    local root
    root="$(agent_ui_repo_root)"
    mkdir -p "${root}/.cursor"
    AGENT_UI_DUMP_PATH="${root}/.cursor/agent-ui-android-dump.json"
    AGENT_UI_STATUS_PATH="${root}/.cursor/agent-ui-android-status.json"
    AGENT_UI_COMMAND_PATH="${root}/.cursor/agent-ui-android-command.json"
    export AGENT_UI_DUMP_PATH AGENT_UI_STATUS_PATH AGENT_UI_COMMAND_PATH
    return 0
  fi
  local data_dir
  data_dir="$(agent_ui_data_dir)" || return 1
  AGENT_UI_DUMP_PATH="${data_dir}/Documents/${DUMP_NAME}"
  AGENT_UI_STATUS_PATH="${data_dir}/Documents/${STATUS_NAME}"
  AGENT_UI_COMMAND_PATH="${data_dir}/Documents/${COMMAND_NAME}"
  export AGENT_UI_DUMP_PATH AGENT_UI_STATUS_PATH AGENT_UI_COMMAND_PATH
}

# Write a command JSON object and wait until status matches expected_op.
# Prints status JSON on success. Returns 0 when status.ok is true (or --allow-fail).
# Usage: agent_ui_send [--allow-fail] [--expect-dump] '<json object>'
agent_ui_send() {
  local allow_fail=0
  local expect_dump=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --allow-fail) allow_fail=1; shift ;;
      --expect-dump) expect_dump=1; shift ;;
      *) break ;;
    esac
  done
  local payload="${1:-}"
  if [[ -z "${payload}" ]]; then
    echo "error: agent_ui_send requires JSON payload" >&2
    return 2
  fi

  : "${WAIT_SECS:=${AGENT_UI_COLD_WAIT_SECS}}"
  local -a flags=(
    --op raw
    --payload-json "${payload}"
    --wait-secs "${WAIT_SECS}"
  )
  if (( allow_fail )); then
    flags+=(--allow-fail)
  fi
  if (( expect_dump )); then
    flags+=(--expect-dump)
  fi

  AGENT_UI_ROOT="$(agent_ui_repo_root)" \
  AGENT_UI_PLATFORM="$(agent_ui_platform)" \
  AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
  AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
  AGENT_UI_HTTP_PORT="$(agent_ui_bridge_http_port)" \
  BUNDLE_ID="${BUNDLE_ID}" \
  DUMP_NAME="${DUMP_NAME}" \
  STATUS_NAME="${STATUS_NAME}" \
  COMMAND_NAME="${COMMAND_NAME}" \
  POLL_SLEEP="${POLL_SLEEP}" \
  AGENT_UI_DATA_DIR="${AGENT_UI_DATA_DIR:-}" \
  ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
  ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
  python3 "$(agent_ui_bridge_py)" send "${flags[@]}"
}

agent_ui_send_op() {
  # agent_ui_send_op dump|tap|scroll|exists|prefix|route|goto|reset|seed|flow|wait|batch|assert|hit|overlay|devmode|login …
  local op="$1"
  shift || true
  : "${WAIT_SECS:=${AGENT_UI_COLD_WAIT_SECS}}"
  local -a flags=(--op "${op}" --wait-secs "${WAIT_SECS}")

  case "${op}" in
    dump)
      flags+=(--expect-dump)
      ;;
    tap|scroll|exists)
      flags+=(--id "${1:-}")
      if [[ "${op}" == "exists" ]]; then
        flags+=(--allow-fail)
      fi
      ;;
    prefix)
      flags+=(--prefix "${1:-}" --allow-fail)
      ;;
    route)
      flags+=(--allow-fail)
      ;;
    goto)
      flags+=(--to "${1:-}")
      ;;
    reset) ;;
    seed)
      flags+=(--to "${1:-travel-demo}")
      ;;
    flow)
      flags+=(--to "${1:-}")
      ;;
    overlay)
      flags+=(--to "${1:-toggle}")
      ;;
    devmode)
      flags+=(--to "${1:-status}")
      ;;
    login)
      # Password travels via ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED (never argv).
      flags+=(--email "${1:-${ONTRACK_AGENT_ACCOUNT_EMAIL:-}}" --allow-fail)
      ;;
    hit)
      # agent_ui_send_op hit <x> <y>
      flags+=(--x "${1:-}" --y "${2:-}" --allow-fail)
      ;;
    assert)
      # Remaining args are bridge --id/--to/--prefix/--contains/--missing flags.
      while [[ $# -gt 0 ]]; do
        flags+=("$1")
        shift
      done
      flags+=(--allow-fail)
      ;;
    wait)
      local mode="prefix"
      local target=""
      local timeout="${AGENT_UI_WAIT_TIMEOUT_MS}"
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --prefix) mode="prefix"; target="${2:-}"; shift 2 ;;
          --id) mode="id"; target="${2:-}"; shift 2 ;;
          --route) mode="route"; target="${2:-}"; shift 2 ;;
          --timeout) timeout="${2:-${AGENT_UI_WAIT_TIMEOUT_MS}}"; shift 2 ;;
          *)
            if [[ -z "${target}" ]]; then target="$1"; shift
            else echo "error: unknown wait arg $1" >&2; return 2; fi
            ;;
        esac
      done
      flags+=(--timeout-ms "${timeout}")
      case "${mode}" in
        id) flags+=(--id "${target}") ;;
        route) flags+=(--to "${target}") ;;
        *) flags+=(--prefix "${target}") ;;
      esac
      ;;
    batch)
      flags+=(--ops-json "${1:-}")
      ;;
    *)
      echo "error: unknown op ${op}" >&2
      return 2
      ;;
  esac

  AGENT_UI_ROOT="$(agent_ui_repo_root)" \
  AGENT_UI_PLATFORM="$(agent_ui_platform)" \
  AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
  AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
  AGENT_UI_HTTP_PORT="$(agent_ui_bridge_http_port)" \
  BUNDLE_ID="${BUNDLE_ID}" \
  DUMP_NAME="${DUMP_NAME}" \
  STATUS_NAME="${STATUS_NAME}" \
  COMMAND_NAME="${COMMAND_NAME}" \
  POLL_SLEEP="${POLL_SLEEP}" \
  AGENT_UI_DATA_DIR="${AGENT_UI_DATA_DIR:-}" \
  ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
  ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
  python3 "$(agent_ui_bridge_py)" send "${flags[@]}"
}

# Agent device policy: no headed viewer handoff. Agents drive only their own
# pool devices (onTrack Agent N / onTrack_Agent_N) and never boot, repoint,
# adopt, or land on the user's onTrack iPhone 17 Pro / Galaxy_S26 — not even to
# leave a window on the verified surface. Headed devices are user-invoked only
# (ONTRACK_IOS_SIMULATOR_WINDOW=1 / ensure-android-emulator.sh --window).

# Auto-lease when sourced by agent-ui CLI entrypoints. Nested children inherit
# AGENT_UI_LOCK_HELD; verify-both sources this first so dual close-out stays atomic.
# Refuse head/tail pipes BEFORE leasing — otherwise Cursor shows a silent
# “Running…” spinner while the pool boots (looks hung for minutes).
agent_ui_refuse_piped_head_tail "agent-ui"
if [[ "${AGENT_UI_SKIP_LEASE:-0}" != "1" ]]; then
  # Propagate AGENT_UI_NO_SLOT_EXIT (3) so entry scripts can report a clean
  # "skipped, nothing tested" instead of looking like a UI failure.
  agent_ui_lease_rc=0
  agent_ui_ensure_lease || agent_ui_lease_rc=$?
  if (( agent_ui_lease_rc != 0 )); then
    return "${agent_ui_lease_rc}"
  fi
fi
