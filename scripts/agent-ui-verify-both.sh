#!/usr/bin/env bash
# Verify the same surface on iOS and Android (required dual-platform close-out).
#
# Usage (same flags as agent-ui-verify / once asserts):
#   ./scripts/agent-ui-verify-both.sh --route /travel/trip-agent-ui-demo --flow travel-demo \
#     --exists travel.planDetail.transportSection
# Internal flow-proof mode:
#   ./scripts/agent-ui-verify-both.sh --proof-flow travel-demo
#
# Default: run iOS + Android **in parallel** (daemon queues are platform:slot —
# no cross-talk). Wall-clock ≈ max(ios, android) instead of sum.
# Ensures Android packager/emulator if needed. Exits non-zero if either side fails.
# Exit 3 = no free agent device slot; nothing was tested (not a UI failure).
#
# Env:
#   SKIP_IOS=1 / SKIP_ANDROID=1 — escape hatches (do not use for normal close-out)
#   AGENT_UI_VERIFY_SERIAL=1 — iOS then Android (debug only; slower)
#   ONTRACK_ANDROID_AVD / AGENT_UI_DEVICE — android device pin
#   AGENT_UI_SKIP_LEASE=1 — bypass device pool / lease (escape hatch only)
#   AGENT_UI_LOCK_WAIT_SECS — wait for a free slot (default 0 = stop, exit 3)
#   AGENT_UI_POOL_MAX — agent device slots (default/max 2 → 4 devices total)
#   AGENT_UI_KEEP_IOS=0 / KEEP_ANDROID=0 (default) — safe shutdown on lease EXIT
#     (Android saves default_boot first for fast reload; never leave orphans)
#   AGENT_UI_KEEP_IOS=1 / KEEP_ANDROID=1 — park that platform warm (debug)
#   AGENT_UI_KEEP_DEVICES=1 — park both platforms warm (debug)
#   AGENT_UI_SKIP_NATIVE_FRESH=1 — skip installing the latest local debug client
#   AGENT_UI_IOS_BRIDGE_RECONNECT_MAX / AGENT_UI_ANDROID_BRIDGE_RECONNECT_MAX — soft
#   bridge reconnect attempts before hard ensure path (defaults: 1 / 2)
#
# Agents: do NOT pipe this script through `tail`/`head` — progress is on stderr/stdout
# and pipes buffer until exit (looks hung for minutes). Prefer bare invoke or `tee`.
# Piping through head/tail is a hard error (see agent_ui_refuse_piped_head_tail).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat >&2 <<'EOF'
usage: agent-ui-verify-both.sh --route <path> [--flow <name>] [--exists <id>|…]…
       agent-ui-verify-both.sh --proof-flow <name>

Same assert flags as agent-ui-verify / once. Runs iOS + Android in parallel
(AGENT_UI_VERIFY_SERIAL=1 → sequential). Do NOT pipe through head/tail
(buffers until exit). Use bare invoke or tee.
EOF
  exit 2
}

for arg in "$@"; do
  case "${arg}" in
    -h|--help) usage ;;
  esac
done

if [[ $# -lt 1 ]]; then
  usage
fi

PROOF_FLOW=""
if [[ "${1:-}" == "--proof-flow" ]]; then
  [[ $# -eq 2 && -n "${2:-}" ]] || usage
  PROOF_FLOW="$2"
fi

proof_flow_requires_account() {
  case "${PROOF_FLOW}" in
    open-developer) return 0 ;;
    *) return 1 ;;
  esac
}

proof_flow_has_account() {
  proof_flow_requires_account || return 0
  # shellcheck source=lib/agent-credentials.sh
  source "${ROOT}/scripts/lib/agent-credentials.sh"
  if agent_creds_load_account >/dev/null 2>&1; then
    return 0
  fi
  agent_creds_account_hint >&2
  return 1
}

now_ms() {
  python3 -c 'import time; print(int(time.time() * 1000))'
}

emit_flow_metrics() {
  local platform="$1"
  local total_ms="${2:-0}"
  local infra_ms="${3:-0}"
  local flow_ms="${4:-0}"
  local command_ms="${5:-0}"
  local reconnect_count="${6:-0}"
  printf 'verify-both: flow-metrics %s {"platform":"%s","totalMs":%s,"infraMs":%s,"flowMs":%s,"commandMs":%s,"bridgeReconnectCount":%s}\n' \
    "${platform}" "${platform}" "${total_ms}" "${infra_ms}" "${flow_ms}" "${command_ms}" "${reconnect_count}" >&2
}

# Hold the simulator lease for the whole dual run so another thread cannot
# interleave between iOS and Android (children inherit AGENT_UI_LOCK_HELD).
# Pipe refuse runs at the end of host.sh (before auto-lease).
echo "verify-both: sourcing host (lease + pipe guard)…" >&2
# shellcheck source=lib/agent-ui-host.sh
LEASE_RC=0
source "${ROOT}/scripts/lib/agent-ui-host.sh" || LEASE_RC=$?
if (( LEASE_RC != 0 )); then
  if (( LEASE_RC == 3 )); then
    echo "verify-both: skipped UI verify — no free agent device slot (nothing tested; agent devices only)" >&2
  fi
  exit "${LEASE_RC}"
fi
if [[ "${AGENT_UI_VERIFY_SERIAL:-0}" == "1" ]]; then
  echo "verify-both: host ready slot=${AGENT_UI_SLOT:-?} — serial iOS then Android" >&2
else
  echo "verify-both: host ready slot=${AGENT_UI_SLOT:-?} — parallel iOS + Android" >&2
fi

# H20: bump the Metro HMR beacon once before forking platforms. Each side's
# verify waits for that nonce (or soft-reconnects). Without a shared bump,
# warm Android keeps answering the bridge on a stale bundle while iOS reloads.
if [[ "${AGENT_UI_SKIP_JS_FRESH:-0}" != "1" ]]; then
  AGENT_UI_EXPECTED_HMR_BEACON="$(
    AGENT_UI_SKIP_LEASE=1 AGENT_UI_LOCK_HELD=1 \
      python3 "${ROOT}/scripts/lib/agent_ui_bridge.py" ensure-js-fresh --bump-only
  )"
  export AGENT_UI_EXPECTED_HMR_BEACON
  echo "verify-both: HMR beacon ${AGENT_UI_EXPECTED_HMR_BEACON} (both platforms must match before assert)" >&2
fi

ARGS=("$@")
IOS_OK=0
ANDROID_OK=0

run_ios() {
  if [[ "${SKIP_IOS:-0}" == "1" ]]; then
    echo "verify-both: skipping iOS (SKIP_IOS=1)" >&2
    return 0
  fi
  echo "verify-both: iOS (AGENT_UI_PLATFORM unset → ios)" >&2

  local ios_started_ms ios_infra_ms ios_flow_start_ms ios_flow_ms ios_total_ms
  local ios_command_exit=0
  local ios_bridge_reconnect_count=0
  local ios_bridge_retry_max=1
  ios_started_ms="$(now_ms)"
  if [[ -n "${AGENT_UI_IOS_BRIDGE_RECONNECT_MAX:-}" ]]; then
    ios_bridge_retry_max="${AGENT_UI_IOS_BRIDGE_RECONNECT_MAX}"
  fi

  # Warm reuse: app process often still alive — soft reconnect before verify.
  export AGENT_UI_PLATFORM=ios
  unset ONTRACK_PACKAGER_TARGET AGENT_UI_DEVICE || true
  export AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}"
  export AGENT_UI_LOCK_ACQUIRED=0
  while (( ios_bridge_reconnect_count < ios_bridge_retry_max )) && ! agent_ui_bridge_answers; do
    if ! agent_ui_app_process_running; then
      break
    fi
    (( ios_bridge_reconnect_count += 1 ))
    echo "verify-both: iOS app up but bridge quiet — soft reconnect… (${ios_bridge_reconnect_count}/${ios_bridge_retry_max})" >&2
    agent_ui_soft_reconnect_dev_client || true
    if agent_ui_wait_for_bridge "${AGENT_UI_IOS_WARM_BRIDGE_WAIT_SECS:-10}"; then
      break
    fi
  done

  # Clear sticky android pin so default host stamp is ios.
  # Keep lease env so the child does not wait on our lockdir.
  local -a command=(verify "${ARGS[@]}")
  if [[ -n "${PROOF_FLOW}" ]]; then
    command=(once --flow "${PROOF_FLOW}")
  fi
  if proof_flow_requires_account; then
    echo "verify-both: iOS flow ${PROOF_FLOW} requires agent account access" >&2
    if proof_flow_has_account; then
      env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE \
        AGENT_UI_PLATFORM=ios \
        AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
        AGENT_UI_LOCK_ACQUIRED=0 \
        AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
        AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
        ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
        "${ROOT}/scripts/agent-ui-login.sh" || return 1
    else
      echo "verify-both: skipping iOS flow ${PROOF_FLOW} (agent account credentials not available)" >&2
      return 0
    fi
  fi

  ios_flow_start_ms="$(now_ms)"
  env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE \
    AGENT_UI_PLATFORM=ios \
    AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
    AGENT_UI_LOCK_ACQUIRED=0 \
    AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
    AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
    AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
    AGENT_UI_EXPECTED_HMR_BEACON="${AGENT_UI_EXPECTED_HMR_BEACON:-}" \
    ONTRACK_IOS_SIMULATOR="${ONTRACK_IOS_SIMULATOR:-}" \
    ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
    ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
    "${ROOT}/scripts/agent-ui.sh" "${command[@]}"
  ios_command_exit=$?
  local ios_flow_end_ms
  ios_flow_end_ms="$(now_ms)"
  ios_flow_ms="$(( ios_flow_end_ms - ios_flow_start_ms ))"
  ios_infra_ms="$(( ios_flow_start_ms - ios_started_ms ))"
  ios_total_ms="$(( ios_flow_end_ms - ios_started_ms ))"
  emit_flow_metrics ios "${ios_total_ms}" "${ios_infra_ms}" "${ios_flow_ms}" "${ios_flow_ms}" "${ios_bridge_reconnect_count}"
  return "${ios_command_exit}"
}

run_android() {
  if [[ "${SKIP_ANDROID:-0}" == "1" ]]; then
    echo "verify-both: skipping Android (SKIP_ANDROID=1)" >&2
    return 0
  fi
  echo "verify-both: Android (AGENT_UI_PLATFORM=android)" >&2

  local android_started_ms android_infra_ms android_flow_start_ms android_flow_ms android_total_ms
  local android_command_exit=0
  local android_bridge_reconnect_count=0
  local android_bridge_retry_max=2
  android_started_ms="$(now_ms)"
  if [[ -n "${AGENT_UI_ANDROID_BRIDGE_RECONNECT_MAX:-}" ]]; then
    android_bridge_retry_max="${AGENT_UI_ANDROID_BRIDGE_RECONNECT_MAX}"
  fi

  # Boot + wait for sys.boot_completed before any route/verify work.
  # Mid-boot adb "device" previously raced into verify and failed with route=?.
  # shellcheck source=lib/android-emulator.sh
  source "${ROOT}/scripts/lib/android-emulator.sh"
  # Agent device policy: a leased agent always stays on its own onTrack_Agent_N
  # AVD. A live headed Galaxy neither wins the device nor gets killed — sticky
  # android-headed.keep is ignored here (ONTRACK_ANDROID_KEEP_HEADED=1 is the
  # only escape, and it means the user asked for the window).
  if [[ -n "${AGENT_UI_SLOT:-}" || "${AGENT_UI_POOL_MODE:-0}" == "1" ]]; then
    if [[ "${ONTRACK_ANDROID_KEEP_HEADED:-}" != "1" ]]; then
      export ONTRACK_ANDROID_KEEP_HEADED=0
      echo "verify-both: pool Android stays on Agent AVD (headed Galaxy never adopted, never killed)" >&2
    fi
  fi
  echo "verify-both: ensuring Android emulator is up and ready (${ONTRACK_ANDROID_AVD:-preferred})…" >&2
  if ! android_emu_ensure_ready; then
    echo "error: verify-both: Android emulator failed to become ready" >&2
    return 1
  fi

  # Ensure packager/app bridge without killing a healthy Metro. Fail hard —
  # do not proceed to verify when ensure fails (|| true hid dead emulators).
  # After reconnect the app wakes on `/` — force land in verify (no skip).
  #
  # When not on headed keep: Galaxy can spoof while pool Agent has no app —
  # pin serial + process check. When headed keep is on, Galaxy *is* the target.
  local android_force_land=0
  local android_route=""
  local android_bridge_ok=0
  agent_ui_pin_android_serial || true
  # Soft-path FIRST without killing Galaxy — emu kill + Agent reconnect is the
  # multi-minute “hang” on 16GB (runtime evidence: bridge quiet after Galaxy kill).
  if agent_ui_bridge_answers; then
    android_bridge_ok=1
    android_route="$(
      AGENT_UI_PLATFORM=android AGENT_UI_SKIP_APP_UP=1 AGENT_UI_SKIP_HEAL=1 WAIT_SECS=3 \
        AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
        AGENT_UI_LOCK_ACQUIRED=0 \
        AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
        AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
        AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
        ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
        ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
        "${ROOT}/scripts/agent-ui-route.sh" 2>/dev/null || true
    )"
  fi
  if [[ "${android_bridge_ok}" != "1" || -z "${android_route}" || "${android_route}" == "?" ]]; then
    # Warm reuse: app process often still alive — soft reconnect before full ensure.
    if agent_ui_app_process_running; then
      while (( android_bridge_reconnect_count < android_bridge_retry_max )) && ! agent_ui_bridge_answers; do
        ((android_bridge_reconnect_count += 1))
        echo "verify-both: Android app up but bridge quiet — soft reconnect… (${android_bridge_reconnect_count}/${android_bridge_retry_max})" >&2
        agent_ui_soft_reconnect_dev_client || true
        if agent_ui_wait_for_bridge "${AGENT_UI_ANDROID_WARM_BRIDGE_WAIT_SECS:-15}"; then
          android_bridge_ok=1
          android_route="$(
            AGENT_UI_PLATFORM=android AGENT_UI_SKIP_APP_UP=1 AGENT_UI_SKIP_HEAL=1 WAIT_SECS=3 \
              AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
              AGENT_UI_LOCK_ACQUIRED=0 \
              AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
              AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
              AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
              ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
              ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
              "${ROOT}/scripts/agent-ui-route.sh" 2>/dev/null || true
          )"
          if [[ -n "${android_route}" && "${android_route}" != "?" ]]; then
            break
          fi
        fi
      done
    fi
  fi
  if [[ "${android_bridge_ok}" != "1" || -z "${android_route}" || "${android_route}" == "?" ]]; then
    # Cold path only: free RAM/GPU, then ensure packager with heartbeats.
    echo "verify-both: Android still quiet — freeing peer emulators then ensuring packager/app…" >&2
    android_emu_shutdown_others "${ONTRACK_ANDROID_SERIAL:-}"
    local beat_pid=""
    (
      n=0
      while sleep 5; do
        n=$((n + 5))
        echo "verify-both: still ensuring Android packager/app… (${n}s)" >&2
      done
    ) &
    beat_pid=$!
    if ! AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
      AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
      ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
      ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
      bash "${ROOT}/scripts/ensure-packager.sh" --start --android; then
      kill "${beat_pid}" 2>/dev/null || true
      wait "${beat_pid}" 2>/dev/null || true
      echo "error: verify-both: Android packager/app not ready" >&2
      return 1
    fi
    kill "${beat_pid}" 2>/dev/null || true
    wait "${beat_pid}" 2>/dev/null || true
    android_force_land=1
  else
    # Warm path succeeded — drop spoofers without blocking soft land.
    echo "verify-both: Android warm path ok route=${android_route:-?} - freeing peers after soft land..." >&2
    android_emu_shutdown_others "${ONTRACK_ANDROID_SERIAL:-}" || true
    if [[ "${android_route}" == "/" ]]; then
      echo "verify-both: Android on / (cold boot) — will force land before asserts" >&2
      android_force_land=1
    fi
  fi
  local -a command=(verify "${ARGS[@]}")
  if [[ -n "${PROOF_FLOW}" ]]; then
    command=(once --flow "${PROOF_FLOW}")
  fi
  if proof_flow_requires_account; then
    echo "verify-both: Android flow ${PROOF_FLOW} requires agent account access" >&2
    if proof_flow_has_account; then
      AGENT_UI_PLATFORM=android \
        AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
        AGENT_UI_LOCK_ACQUIRED=0 \
        AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
        AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
        ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
        ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
        "${ROOT}/scripts/agent-ui-login.sh" || return 1
    else
      echo "verify-both: skipping Android flow ${PROOF_FLOW} (agent account credentials not available)" >&2
      return 0
    fi
  fi
  android_flow_start_ms="$(now_ms)"
  AGENT_UI_PLATFORM=android \
    AGENT_UI_ANDROID_FORCE_LAND="${android_force_land}" \
    AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
    AGENT_UI_LOCK_ACQUIRED=0 \
    AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
    AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
    AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
    AGENT_UI_EXPECTED_HMR_BEACON="${AGENT_UI_EXPECTED_HMR_BEACON:-}" \
    ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
    ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
    "${ROOT}/scripts/agent-ui.sh" "${command[@]}"
  android_command_exit=$?
  local android_flow_end_ms
  android_flow_end_ms="$(now_ms)"
  android_flow_ms="$(( android_flow_end_ms - android_flow_start_ms ))"
  android_infra_ms="$(( android_flow_start_ms - android_started_ms ))"
  android_total_ms="$(( android_flow_end_ms - android_started_ms ))"
  emit_flow_metrics android "${android_total_ms}" "${android_infra_ms}" "${android_flow_ms}" "${android_flow_ms}" "${android_bridge_reconnect_count}"
  return "${android_command_exit}"
}

# Seeds/flows enter an agent Dev Mode sandbox — release it after close-out so
# mock data does not stick on the live account (user-owned Dev Mode is kept).
# Define epilogue BEFORE run_ios/run_android: bash re-reads the script file after
# long work; mid-run edits shift offsets and produce bogus `syntax error near fi`.
release_agent_devmode() {
  local platform="$1"
  local current_route=""
  echo "verify-both: releasing agent Dev Mode on ${platform}" >&2
  if [[ "${platform}" == "android" ]]; then
    current_route="$(AGENT_UI_PLATFORM=android AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" AGENT_UI_LOCK_ACQUIRED=0 "${ROOT}/scripts/agent-ui-route.sh" 2>/dev/null || true)"
    if [[ "${current_route}" == "/travel-map" ]]; then
      echo "verify-both: leaving atlas to restore Android portrait" >&2
      AGENT_UI_PLATFORM=android AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" AGENT_UI_LOCK_ACQUIRED=0 "${ROOT}/scripts/agent-ui-goto.sh" travel >/dev/null 2>&1 || true
    fi
    AGENT_UI_PLATFORM=android \
      AGENT_UI_SKIP_APP_UP=1 \
      AGENT_UI_SKIP_HEAL=1 \
      WAIT_SECS=5 \
      AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
      AGENT_UI_LOCK_ACQUIRED=0 \
      "${ROOT}/scripts/agent-ui-devmode.sh" release >/dev/null 2>&1 || true
  else
    current_route="$(env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE AGENT_UI_PLATFORM=ios AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" AGENT_UI_LOCK_ACQUIRED=0 "${ROOT}/scripts/agent-ui-route.sh" 2>/dev/null || true)"
    if [[ "${current_route}" == "/travel-map" ]]; then
      echo "verify-both: leaving atlas to restore iOS portrait" >&2
      env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE AGENT_UI_PLATFORM=ios AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" AGENT_UI_LOCK_ACQUIRED=0 "${ROOT}/scripts/agent-ui-goto.sh" travel >/dev/null 2>&1 || true
    fi
    env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE \
      AGENT_UI_PLATFORM=ios \
      AGENT_UI_SKIP_APP_UP=1 \
      AGENT_UI_SKIP_HEAL=1 \
      WAIT_SECS=5 \
      AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
      AGENT_UI_LOCK_ACQUIRED=0 \
      "${ROOT}/scripts/agent-ui-devmode.sh" release >/dev/null 2>&1 || true
  fi
}

finish_verify_both() {
  if [[ "${SKIP_IOS:-0}" != "1" ]]; then
    release_agent_devmode ios
  fi
  if [[ "${SKIP_ANDROID:-0}" != "1" ]]; then
    release_agent_devmode android
  fi

  echo "verify-both: ios_exit=${IOS_OK} android_exit=${ANDROID_OK}" >&2
  if (( IOS_OK != 0 || ANDROID_OK != 0 )); then
    exit 1
  fi

  # No headed viewer handoff — agents never land on the user's Pro / Galaxy.
  # Agent devices are parked warm (or shut down safely) by the lease release.
  exit 0
}

set +e
if [[ "${AGENT_UI_VERIFY_SERIAL:-0}" == "1" ]]; then
  run_ios
  IOS_OK=$?
  run_android
  ANDROID_OK=$?
else
  # Parallel: iOS + Android share one pool slot but separate daemon FIFOs
  # (`ios:N` / `android:N`). Serial was paying sum(wall) for no safety gain.
  run_ios &
  ios_pid=$!
  run_android &
  android_pid=$!
  wait "${ios_pid}"
  IOS_OK=$?
  wait "${android_pid}"
  ANDROID_OK=$?
fi
set -e
finish_verify_both
