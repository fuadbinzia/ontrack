#!/usr/bin/env bash
# Verify the same surface on iOS and Android (required dual-platform close-out).
#
# Usage (same flags as agent-ui-verify / once asserts):
#   ./scripts/agent-ui-verify-both.sh --route /travel/trip-agent-ui-demo --flow travel-demo \
#     --exists travel.planDetail.transportSection
#
# Default: run iOS + Android **in parallel** (daemon queues are platform:slot —
# no cross-talk). Wall-clock ≈ max(ios, android) instead of sum.
# Ensures Android packager/emulator if needed. Exits non-zero if either side fails.
#
# Env:
#   SKIP_IOS=1 / SKIP_ANDROID=1 — escape hatches (do not use for normal close-out)
#   AGENT_UI_VERIFY_SERIAL=1 — iOS then Android (debug only; slower)
#   ONTRACK_ANDROID_AVD / AGENT_UI_DEVICE — android device pin
#   AGENT_UI_SKIP_LEASE=1 — bypass device pool / lease (escape hatch only)
#   AGENT_UI_LOCK_WAIT_SECS — how long to wait for a free pool slot (default 300)
#   AGENT_UI_POOL_MAX — max concurrent agent device slots (default 5)
#   AGENT_UI_KEEP_IOS=1 (default) — leave pool sim warm across lease EXIT
#   AGENT_UI_KEEP_ANDROID=1 (default) — leave pool AVD warm across lease EXIT
#   AGENT_UI_KEEP_IOS=0 / KEEP_ANDROID=0 — kill that platform on release
#   AGENT_UI_KEEP_DEVICES=1 — keep both platforms (debug)
#
# Agents: do NOT pipe this script through `tail`/`head` — progress is on stderr/stdout
# and pipes buffer until exit (looks hung for minutes). Prefer bare invoke or `tee`.
# Piping through head/tail is a hard error (see agent_ui_refuse_piped_head_tail).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat >&2 <<'EOF'
usage: agent-ui-verify-both.sh --route <path> [--flow <name>] [--exists <id>|…]…

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

# Hold the simulator lease for the whole dual run so another thread cannot
# interleave between iOS and Android (children inherit AGENT_UI_LOCK_HELD).
# Pipe refuse runs at the end of host.sh (before auto-lease).
echo "verify-both: sourcing host (lease + pipe guard)…" >&2
# shellcheck source=lib/agent-ui-host.sh
source "${ROOT}/scripts/lib/agent-ui-host.sh"
if [[ "${AGENT_UI_VERIFY_SERIAL:-0}" == "1" ]]; then
  echo "verify-both: host ready slot=${AGENT_UI_SLOT:-?} — serial iOS then Android" >&2
else
  echo "verify-both: host ready slot=${AGENT_UI_SLOT:-?} — parallel iOS + Android" >&2
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

  # Warm reuse: app process often still alive — soft reconnect before verify.
  (
    export AGENT_UI_PLATFORM=ios
    unset ONTRACK_PACKAGER_TARGET AGENT_UI_DEVICE || true
    export AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}"
    export AGENT_UI_LOCK_ACQUIRED=0
    if ! agent_ui_bridge_answers && agent_ui_app_process_running; then
      echo "verify-both: iOS app up but bridge quiet — soft reconnect…" >&2
      agent_ui_soft_reconnect_dev_client || true
      agent_ui_wait_for_bridge "${AGENT_UI_IOS_WARM_BRIDGE_WAIT_SECS:-10}" || true
    fi
  )

  # Clear sticky android pin so default host stamp is ios.
  # Keep lease env so the child does not wait on our lockdir.
  # Skip per-platform handoff — iOS verify must not adopt Galaxy mid dual-run
  # (that re-ran travel-demo on the 8GB GUI and looked hung for minutes).
  # One handoff runs at the end of verify-both after both asserts pass.
  env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE \
    AGENT_UI_PLATFORM=ios \
    AGENT_UI_SKIP_HEADED_HANDOFF=1 \
    AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
    AGENT_UI_LOCK_ACQUIRED=0 \
    AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
    AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
    AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
    ONTRACK_IOS_SIMULATOR="${ONTRACK_IOS_SIMULATOR:-}" \
    ONTRACK_IOS_SIMULATOR_UDID="${ONTRACK_IOS_SIMULATOR_UDID:-}" \
    ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
    "${ROOT}/scripts/agent-ui.sh" verify "${ARGS[@]}"
}

run_android() {
  if [[ "${SKIP_ANDROID:-0}" == "1" ]]; then
    echo "verify-both: skipping Android (SKIP_ANDROID=1)" >&2
    return 0
  fi
  echo "verify-both: Android (AGENT_UI_PLATFORM=android)" >&2

  # Boot + wait for sys.boot_completed before any route/verify work.
  # Mid-boot adb "device" previously raced into verify and failed with route=?.
  # shellcheck source=lib/android-emulator.sh
  source "${ROOT}/scripts/lib/android-emulator.sh"
  # Pool dual-verify: sticky android-headed.keep alone must not force Galaxy
  # adopt when the GUI is closed (kills warm Agent_* → multi-minute cold path).
  # A *live* headed Galaxy always wins — never emu-kill the user window
  # ("Saving state…"). Explicit ONTRACK_ANDROID_KEEP_HEADED=1 also forces Galaxy.
  if [[ -n "${AGENT_UI_SLOT:-}" || "${AGENT_UI_POOL_MODE:-0}" == "1" ]]; then
    if [[ "${ONTRACK_ANDROID_KEEP_HEADED:-}" != "1" ]]; then
      live_headed="$(android_emu_live_headed_galaxy_name 2>/dev/null || true)"
      if [[ -n "$live_headed" ]]; then
        export ONTRACK_ANDROID_KEEP_HEADED=1
        echo "verify-both: live headed ${live_headed} — adopting (not killing user window)" >&2
      else
        export ONTRACK_ANDROID_KEEP_HEADED=0
        echo "verify-both: pool Android stays on Agent AVD (sticky headed keep ignored; ONTRACK_ANDROID_KEEP_HEADED=1 forces Galaxy)" >&2
      fi
    fi
  fi
  # Headed Galaxy keep / live GUI: remount to Galaxy + kill agents BEFORE ensure.
  # 16GB hosts thrash for minutes if Agent_* runs beside the 8GB GUI.
  android_emu_adopt_android_for_headed_host || true
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
      echo "verify-both: Android app up but bridge quiet — soft reconnect…" >&2
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
      fi
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
  AGENT_UI_PLATFORM=android \
    AGENT_UI_ANDROID_FORCE_LAND="${android_force_land}" \
    AGENT_UI_SKIP_HEADED_HANDOFF=1 \
    AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
    AGENT_UI_LOCK_ACQUIRED=0 \
    AGENT_UI_SLOT="${AGENT_UI_SLOT:-}" \
    AGENT_UI_LOCK_DIR="${AGENT_UI_LOCK_DIR:-}" \
    AGENT_UI_POOL_MODE="${AGENT_UI_POOL_MODE:-}" \
    ONTRACK_ANDROID_AVD="${ONTRACK_ANDROID_AVD:-}" \
    ONTRACK_ANDROID_SERIAL="${ONTRACK_ANDROID_SERIAL:-}" \
    "${ROOT}/scripts/agent-ui.sh" verify "${ARGS[@]}"
}

# Seeds/flows enter an agent Dev Mode sandbox — release it after close-out so
# mock data does not stick on the live account (user-owned Dev Mode is kept).
# Define epilogue BEFORE run_ios/run_android: bash re-reads the script file after
# long work; mid-run edits shift offsets and produce bogus `syntax error near fi`.
release_agent_devmode() {
  local platform="$1"
  echo "verify-both: releasing agent Dev Mode on ${platform}" >&2
  if [[ "${platform}" == "android" ]]; then
    AGENT_UI_PLATFORM=android \
      AGENT_UI_LOCK_HELD="${AGENT_UI_LOCK_HELD:-1}" \
      AGENT_UI_LOCK_ACQUIRED=0 \
      "${ROOT}/scripts/agent-ui-devmode.sh" release >/dev/null 2>&1 || true
  else
    env -u AGENT_UI_PLATFORM -u ONTRACK_PACKAGER_TARGET -u AGENT_UI_DEVICE \
      AGENT_UI_PLATFORM=ios \
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

  # If Simulator.app / headed Galaxy is open, leave that viewer on the verified
  # surface with a fresh Metro bundle (pool Agent N is not what the user watches).
  agent_ui_headed_viewer_handoff "${ARGS[@]}"
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
