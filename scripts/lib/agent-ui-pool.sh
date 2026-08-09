#!/usr/bin/env bash
# Dedicated agent device pool — AGENT_UI_POOL_HARD_MAX slots (2 per platform,
# 4 devices total). Agents never touch the user's devices.
#
# Each slot owns:
#   iOS:     "onTrack Agent N"  (simctl device, headless by default)
#   Android: onTrack_Agent_N    (AVD cloned from Galaxy_S26 profile)
#
# Claim order: preferred pin → warm orphan (iOS Booted and/or Android
# boot_completed, lock free) → cold free slot. Live lock holders are in-use;
# lock-free warm devices are reclaimable only when KEEP_* left them up.
#
# After testing: safe shutdown by default (KEEP_IOS/KEEP_ANDROID=0). Android
# saves default_boot before `emu kill` so the next agent reloads quickly.
# Escape park-warm: AGENT_UI_KEEP_IOS=1 / KEEP_ANDROID=1 / KEEP_DEVICES=1.
# Idle GC (AGENT_UI_*_IDLE_SECS) only applies when KEEP leaves a device warm.
#
# No free slot → do NOT queue and do NOT fall back to a user device: exit
# AGENT_UI_NO_SLOT_EXIT (3) so the agent stops without UI verify.
# AGENT_UI_LOCK_WAIT_SECS>0 opts back into waiting (debug only).
# Nested children inherit AGENT_UI_SLOT + LOCK_HELD.
#
# Release is always safe + orphan-free: EXIT/INT/TERM/HUP release the lease;
# agent_ui_pool_reap_orphans retires devices whose owner died or whose slot is
# above the cap (never leave agent devices orphaned).
#
# Opt out: AGENT_UI_SKIP_LEASE=1 or AGENT_UI_USE_POOL=0 (legacy single device /
# explicit ONTRACK_* pins without pool naming).

# Hard policy cap: 2 iOS sims + 2 Android AVDs. Not overridable — exported so
# the daemon's per-slot listen ports (8191+N) stay in lockstep (H17).
AGENT_UI_POOL_HARD_MAX=2
export AGENT_UI_POOL_HARD_MAX
# Distinct exit code so callers can report "skipped" instead of "UI broken".
AGENT_UI_NO_SLOT_EXIT=3
: "${AGENT_UI_POOL_MAX:=2}"
: "${AGENT_UI_LOCK_WAIT_SECS:=0}"
: "${AGENT_UI_USE_POOL:=1}"
: "${AGENT_UI_KEEP_IOS:=0}"
: "${AGENT_UI_KEEP_ANDROID:=0}"
: "${AGENT_UI_IOS_IDLE_SECS:=1800}"
: "${AGENT_UI_ANDROID_IDLE_SECS:=1800}"
: "${BUNDLE_ID:=com.imtihoss.ontracknow}"


# Resolve repo root without requiring agent-ui-host.sh (ensure-packager sources
# this file alone when cloning onto a fresh pool slot).
agent_ui_pool_repo_root() {
  if declare -F agent_ui_repo_root >/dev/null 2>&1; then
    agent_ui_repo_root
    return 0
  fi
  if [[ -n "${AGENT_UI_ROOT:-}" && -f "${AGENT_UI_ROOT}/scripts/ensure-packager.sh" ]]; then
    printf '%s\n' "${AGENT_UI_ROOT}"
    return 0
  fi
  if [[ -n "${ROOT:-}" && -f "${ROOT}/scripts/ensure-packager.sh" ]]; then
    printf '%s\n' "${ROOT}"
    return 0
  fi
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  printf '%s\n' "$here"
}

# Slot count, clamped to the hard policy cap (2 per platform / 4 devices).
agent_ui_pool_max() {
  local n="${AGENT_UI_POOL_MAX:-${AGENT_UI_POOL_HARD_MAX}}"
  if [[ "$n" =~ ^[1-9][0-9]*$ ]] && (( n <= AGENT_UI_POOL_HARD_MAX )); then
    printf '%s' "$n"
  else
    printf '%s' "${AGENT_UI_POOL_HARD_MAX}"
  fi
}

agent_ui_pool_root() {
  if [[ -n "${AGENT_UI_POOL_DIR:-}" ]]; then
    printf '%s\n' "${AGENT_UI_POOL_DIR}"
    return 0
  fi
  printf '%s\n' "$(agent_ui_pool_repo_root)/.cursor/agent-ui-slots"
}

agent_ui_pool_ios_name() {
  printf 'onTrack Agent %s' "$1"
}

agent_ui_pool_android_name() {
  printf 'onTrack_Agent_%s' "$1"
}

agent_ui_pool_want() {
  case "${AGENT_UI_USE_POOL:-1}" in
    0|false|FALSE|no|NO) return 1 ;;
    *) return 0 ;;
  esac
}

# Resolve / create the iOS sim for a slot; export ONTRACK_IOS_SIMULATOR(+_UDID).
agent_ui_pool_bind_ios() {
  local slot="$1" name udid root
  name="$(agent_ui_pool_ios_name "$slot")"
  export ONTRACK_IOS_SIMULATOR="$name"
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/ios-simulator.sh"
  ios_sim_ensure_device_exists || return 1
  if ! udid="$(ios_sim_resolve_udid)"; then
    echo "error: could not resolve agent pool iOS device '${name}'" >&2
    return 1
  fi
  export ONTRACK_IOS_SIMULATOR_UDID="$udid"
  export AGENT_UI_POOL_MODE=1
  # Pre-approve before the slot boots so openurl never shows "Open in …?".
  ios_sim_approve_url_schemes "$udid" >/dev/null || true
}

# Point Android env at the slot AVD (create lazily on ensure_preferred).
agent_ui_pool_bind_android() {
  local slot="$1" name root serial
  name="$(agent_ui_pool_android_name "$slot")"
  export ONTRACK_ANDROID_AVD="$name"
  # Drop a stale serial from a prior AVD (e.g. Galaxy_S26) so preferred_serial
  # re-resolves against onTrack_Agent_N.
  unset ONTRACK_ANDROID_SERIAL ANDROID_SERIAL
  export AGENT_UI_POOL_MODE=1
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/android-emulator.sh"
  android_emu_ensure_agent_avd || return 1
  serial="$(android_emu_preferred_serial || true)"
  if [[ -n "$serial" ]]; then
    export ONTRACK_ANDROID_SERIAL="$serial"
    export ANDROID_SERIAL="$serial"
  fi
}

# Install the app onto a pool Android serial from any emulator that already has it.
agent_ui_pool_clone_android_app() {
  local target_serial="${1:-${ONTRACK_ANDROID_SERIAL:-}}" adb_bin src_serial apk remote root
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/android-emulator.sh"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" && -n "$target_serial" ]] || return 1
  if "$adb_bin" -s "$target_serial" shell pm path "$BUNDLE_ID" 2>/dev/null | grep -q "package:"; then
    return 0
  fi
  src_serial="$(
    "$adb_bin" devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device/{print $1}' | while read -r serial; do
      [[ "$serial" == "$target_serial" ]] && continue
      if "$adb_bin" -s "$serial" shell pm path "$BUNDLE_ID" 2>/dev/null | grep -q "package:"; then
        printf '%s' "$serial"
        break
      fi
    done
  )"
  if [[ -z "${src_serial:-}" ]]; then
    echo "error: ${BUNDLE_ID} is not installed on any emulator to clone onto agent slot" >&2
    return 1
  fi
  remote="$("$adb_bin" -s "$src_serial" shell pm path "$BUNDLE_ID" 2>/dev/null | tr -d '\r' | head -1 | sed 's/^package://')"
  [[ -n "$remote" ]] || return 1
  apk="$(mktemp -t ontrack-agent-apk).apk"
  if ! "$adb_bin" -s "$src_serial" pull "$remote" "$apk" >/dev/null 2>&1; then
    rm -f "$apk"
    return 1
  fi
  echo "agent-ui: cloning ${BUNDLE_ID} → ${ONTRACK_ANDROID_AVD:-pool} from ${src_serial}" >&2
  "$adb_bin" -s "$target_serial" install -r "$apk" >/dev/null 2>&1
  local rc=$?
  rm -f "$apk"
  return "$rc"
}

# Copy the installed app onto a target iOS UDID from any sim that already has it.
agent_ui_pool_clone_ios_app() {
  local target_udid="$1" source_udid app_path root
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/ios-simulator.sh"
  if ios_simctl_timed get_app_container "$target_udid" "$BUNDLE_ID" data >/dev/null 2>&1; then
    return 0
  fi
  source_udid="$(
    xcrun simctl list devices available -j 2>/dev/null | python3 -c '
import json, sys, subprocess, os
bundle = os.environ.get("BUNDLE_ID", "com.imtihoss.ontracknow")
target = sys.argv[1]
data = json.load(sys.stdin)
for devices in data.get("devices", {}).values():
    for d in devices:
        udid = d.get("udid") or ""
        if not udid or udid == target:
            continue
        try:
            proc = subprocess.run(
                ["xcrun", "simctl", "get_app_container", udid, bundle, "app"],
                capture_output=True, text=True, timeout=10,
            )
        except Exception:
            continue
        path = (proc.stdout or "").strip()
        if proc.returncode == 0 and path:
            print(udid)
            raise SystemExit(0)
raise SystemExit(1)
' "$target_udid"
  )" || true
  if [[ -z "${source_udid:-}" ]]; then
    echo "error: ${BUNDLE_ID} is not installed on any simulator to clone onto agent slot" >&2
    return 1
  fi
  app_path="$(ios_simctl_timed get_app_container "$source_udid" "$BUNDLE_ID" app 2>/dev/null | tr -d '\r')"
  if [[ -z "$app_path" || ! -d "$app_path" ]]; then
    echo "error: could not resolve .app from source simulator ${source_udid}" >&2
    return 1
  fi
  echo "agent-ui: cloning ${BUNDLE_ID} → $(agent_ui_pool_ios_name "${AGENT_UI_SLOT:-?}") from ${source_udid}" >&2
  # Untimed install wedges forever when CoreSimulator is stuck on orphaned
  # `simctl io screenshot` — always use the shared alarm wrapper.
  if ! ios_simctl_timed 90 install "$target_udid" "$app_path" >/dev/null 2>&1; then
    echo "error: simctl install failed/timed out for ${target_udid}" >&2
    return 1
  fi
}

# Apply pool device env for the claimed slot (both platforms named; boot lazily).
# Set AGENT_UI_POOL_BIND_DEVICES=0 to claim the slot lock only (unit tests).
agent_ui_pool_apply_devices() {
  local slot="$1"
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO)
      export ONTRACK_IOS_SIMULATOR="$(agent_ui_pool_ios_name "$slot")"
      export ONTRACK_ANDROID_AVD="$(agent_ui_pool_android_name "$slot")"
      export AGENT_UI_POOL_MODE=1
      echo "agent-ui: slot ${slot} claimed (device bind skipped)" >&2
      return 0
      ;;
  esac
  agent_ui_pool_bind_ios "$slot" || return 1
  agent_ui_pool_bind_android "$slot" || return 1
  agent_ui_assert_agent_device_bound both || return 1
  # Keep agent windows off-screen if the user has Simulator.app open / reopens it.
  # shellcheck disable=SC1091
  source "$(agent_ui_pool_repo_root)/scripts/lib/ios-simulator.sh"
  ios_sim_enforce_agent_headless_gui || true
  echo "agent-ui: slot ${slot} → iOS '${ONTRACK_IOS_SIMULATOR}' (${ONTRACK_IOS_SIMULATOR_UDID}) / Android AVD '${ONTRACK_ANDROID_AVD}'" >&2
}

agent_ui_pool_slot_lockdir() {
  printf '%s/%s.lockdir' "$(agent_ui_pool_root)" "$1"
}

# Policy guard: a leased agent may only ever drive onTrack Agent N /
# onTrack_Agent_N. The user's devices (onTrack iPhone 17 Pro, Galaxy_S26) are
# off limits — for tests, for handoff, for "just looking". Any drift here means
# a stale pin or an adopt path leaked back in, so fail loudly instead of typing
# into the user's simulator.
agent_ui_assert_agent_device_bound() {
  local platform="${1:-both}" ios="${ONTRACK_IOS_SIMULATOR:-}" avd="${ONTRACK_ANDROID_AVD:-}"
  # Only meaningful while this process holds a pool lease.
  [[ "${AGENT_UI_POOL_MODE:-0}" == "1" || -n "${AGENT_UI_SLOT:-}" ]] || return 0
  agent_ui_pool_want || return 0

  if [[ "$platform" != "android" && -n "$ios" ]]; then
    if [[ ! "$ios" =~ ^onTrack\ Agent\ [1-9][0-9]*$ ]]; then
      echo "error: agent device policy — leased agent bound to non-agent iOS simulator '${ios}'." >&2
      echo "error: agents run only on 'onTrack Agent N'. Clear ONTRACK_IOS_SIMULATOR / re-lease; never verify on the user's device." >&2
      return 1
    fi
  fi
  if [[ "$platform" != "ios" && -n "$avd" ]]; then
    if [[ ! "$avd" =~ ^onTrack_Agent_[1-9][0-9]*$ ]]; then
      echo "error: agent device policy — leased agent bound to non-agent Android AVD '${avd}'." >&2
      echo "error: agents run only on 'onTrack_Agent_N'. Clear ONTRACK_ANDROID_AVD / re-lease; never verify on Galaxy_S26." >&2
      return 1
    fi
  fi
  return 0
}

# Park iOS agent sim warm across lease EXIT. Default is shutdown (KEEP_IOS=0).
# KEEP_DEVICES=1 parks both platforms.
agent_ui_pool_keep_ios() {
  case "${AGENT_UI_KEEP_DEVICES:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
  esac
  case "${AGENT_UI_KEEP_IOS:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# Park Android agent AVD warm across lease EXIT. Default is shutdown (KEEP_ANDROID=0).
# KEEP_DEVICES=1 parks both platforms.
agent_ui_pool_keep_android() {
  case "${AGENT_UI_KEEP_DEVICES:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
  esac
  case "${AGENT_UI_KEEP_ANDROID:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

agent_ui_pool_ios_idle_path() {
  printf '%s/%s.ios-idle' "$(agent_ui_pool_root)" "$1"
}

agent_ui_pool_android_idle_path() {
  printf '%s/%s.android-idle' "$(agent_ui_pool_root)" "$1"
}

agent_ui_pool_clear_ios_idle() {
  rm -f "$(agent_ui_pool_ios_idle_path "$1")" 2>/dev/null || true
}

agent_ui_pool_clear_android_idle() {
  rm -f "$(agent_ui_pool_android_idle_path "$1")" 2>/dev/null || true
}

agent_ui_pool_clear_idle_stamps() {
  agent_ui_pool_clear_ios_idle "$1"
  agent_ui_pool_clear_android_idle "$1"
}

agent_ui_pool_mark_ios_idle() {
  local slot="$1" path
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 0
  path="$(agent_ui_pool_ios_idle_path "$slot")"
  mkdir -p "$(dirname "$path")" 2>/dev/null || true
  date +%s >"$path" 2>/dev/null || true
}

agent_ui_pool_mark_android_idle() {
  local slot="$1" path
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 0
  path="$(agent_ui_pool_android_idle_path "$slot")"
  mkdir -p "$(dirname "$path")" 2>/dev/null || true
  date +%s >"$path" 2>/dev/null || true
}

# True when slot lockdir is absent or holder pid is dead.
agent_ui_pool_slot_lock_free() {
  local slot="$1" lockdir owner
  lockdir="$(agent_ui_pool_slot_lockdir "$slot")"
  if [[ ! -d "$lockdir" ]]; then
    return 0
  fi
  owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
  if [[ -n "${owner}" ]] && kill -0 "${owner}" 2>/dev/null; then
    return 1
  fi
  return 0
}

# True when this slot's iOS agent sim is Booted.
agent_ui_pool_slot_ios_warm() {
  local slot="$1" ios_name
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 1 ;;
  esac
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 1

  ios_name="$(agent_ui_pool_ios_name "$slot")"
  xcrun simctl list devices booted -j 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("name") == name and d.get("state") == "Booted":
            raise SystemExit(0)
raise SystemExit(1)
' "$ios_name" >/dev/null 2>&1
}

# True when this slot's Android AVD is on adb with sys.boot_completed=1.
agent_ui_pool_slot_android_warm() {
  local slot="$1" android_name root serial boot adb_bin
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 1 ;;
  esac
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 1

  android_name="$(agent_ui_pool_android_name "$slot")"
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/android-emulator.sh"
  serial="$(
    ONTRACK_ANDROID_AVD="$android_name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
  )"
  [[ -n "${serial:-}" ]] || return 1
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [[ "$boot" == "1" ]]
}

# True when either platform is warm (reusable orphan).
agent_ui_pool_slot_warm() {
  agent_ui_pool_slot_ios_warm "$1" || agent_ui_pool_slot_android_warm "$1"
}

# Human-readable warm reason for reclaim logs.
agent_ui_pool_slot_warm_label() {
  local slot="$1" parts=() out=""
  if agent_ui_pool_slot_ios_warm "$slot"; then
    parts+=("iOS Booted")
  fi
  if agent_ui_pool_slot_android_warm "$slot"; then
    parts+=("Android AVD up")
  fi
  if ((${#parts[@]} == 0)); then
    printf 'warm'
    return 0
  fi
  out="${parts[0]}"
  if ((${#parts[@]} > 1)); then
    out+=" + ${parts[1]}"
  fi
  printf '%s' "$out"
}

# Shut down lock-free warm iOS agent sims idle longer than AGENT_UI_IOS_IDLE_SECS.
agent_ui_pool_gc_idle_ios() {
  local max slot path age now idle_secs ios_name root
  agent_ui_pool_keep_ios || return 0
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 0 ;;
  esac
  idle_secs="${AGENT_UI_IOS_IDLE_SECS:-1800}"
  if ! [[ "$idle_secs" =~ ^[0-9]+$ ]]; then
    idle_secs=1800
  fi
  max="$(agent_ui_pool_max)"
  now="$(date +%s)"
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/ios-simulator.sh"
  for ((slot = 1; slot <= max; slot++)); do
    agent_ui_pool_slot_lock_free "$slot" || continue
    path="$(agent_ui_pool_ios_idle_path "$slot")"
    [[ -f "$path" ]] || continue
    age="$(cat "$path" 2>/dev/null || echo 0)"
    if ! [[ "$age" =~ ^[0-9]+$ ]]; then
      continue
    fi
    if (( now - age < idle_secs )); then
      continue
    fi
    agent_ui_pool_slot_ios_warm "$slot" || {
      agent_ui_pool_clear_ios_idle "$slot"
      continue
    }
    ios_name="$(agent_ui_pool_ios_name "$slot")"
    echo "agent-ui: GC idle iOS sim '${ios_name}' (slot ${slot}; idle $((now - age))s)" >&2
    ios_sim_shutdown_agent_named "$ios_name" || true
    agent_ui_pool_clear_ios_idle "$slot"
  done
  return 0
}

# Shut down lock-free warm Android AVDs idle longer than AGENT_UI_ANDROID_IDLE_SECS.
agent_ui_pool_gc_idle_android() {
  local max slot path age now idle_secs android_name root
  agent_ui_pool_keep_android || return 0
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 0 ;;
  esac
  idle_secs="${AGENT_UI_ANDROID_IDLE_SECS:-1800}"
  if ! [[ "$idle_secs" =~ ^[0-9]+$ ]]; then
    idle_secs=1800
  fi
  max="$(agent_ui_pool_max)"
  now="$(date +%s)"
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/android-emulator.sh"
  for ((slot = 1; slot <= max; slot++)); do
    agent_ui_pool_slot_lock_free "$slot" || continue
    path="$(agent_ui_pool_android_idle_path "$slot")"
    [[ -f "$path" ]] || continue
    age="$(cat "$path" 2>/dev/null || echo 0)"
    if ! [[ "$age" =~ ^[0-9]+$ ]]; then
      continue
    fi
    if (( now - age < idle_secs )); then
      continue
    fi
    agent_ui_pool_slot_android_warm "$slot" || {
      agent_ui_pool_clear_android_idle "$slot"
      continue
    }
    android_name="$(agent_ui_pool_android_name "$slot")"
    echo "agent-ui: GC idle Android AVD '${android_name}' (slot ${slot}; idle $((now - age))s)" >&2
    android_emu_shutdown_named "$android_name" || true
    agent_ui_pool_clear_android_idle "$slot"
  done
  return 0
}

agent_ui_pool_gc_idle_devices() {
  agent_ui_pool_reap_orphans || true
  agent_ui_pool_gc_idle_ios || true
  agent_ui_pool_gc_idle_android || true
}

# Agent devices must never be orphaned. Two ways they leak:
#   1. The owner was killed before its EXIT trap ran → device is up, lock free,
#      and has no idle stamp, so the idle GC never sees it. Stamp it now.
#   2. It belongs to a slot above the policy cap (legacy 5-slot pool) → nothing
#      will ever claim it again. Shut it down and drop its slot files.
# Shutdown is always graceful (simctl shutdown / adb emu kill + lock release) so
# the next agent can reload the device quickly.
agent_ui_pool_reap_orphans() {
  local max slot scan_max root ios_name android_name lockdir
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 0 ;;
  esac
  max="$(agent_ui_pool_max)"
  scan_max="${AGENT_UI_POOL_SCAN_MAX:-8}"
  if ! [[ "$scan_max" =~ ^[1-9][0-9]*$ ]] || (( scan_max > 32 )); then
    scan_max=8
  fi
  root="$(agent_ui_pool_repo_root)"

  for ((slot = 1; slot <= scan_max; slot++)); do
    agent_ui_pool_slot_lock_free "$slot" || continue
    lockdir="$(agent_ui_pool_slot_lockdir "$slot")"

    if (( slot > max )); then
      ios_name="$(agent_ui_pool_ios_name "$slot")"
      android_name="$(agent_ui_pool_android_name "$slot")"
      if agent_ui_pool_slot_ios_warm "$slot"; then
        echo "agent-ui: retiring out-of-policy agent sim '${ios_name}' (cap ${max} slots)" >&2
        # shellcheck disable=SC1091
        source "${root}/scripts/lib/ios-simulator.sh"
        ios_sim_shutdown_agent_named "$ios_name" || true
      fi
      if agent_ui_pool_slot_android_warm "$slot"; then
        echo "agent-ui: retiring out-of-policy agent AVD '${android_name}' (cap ${max} slots)" >&2
        # shellcheck disable=SC1091
        source "${root}/scripts/lib/android-emulator.sh"
        android_emu_shutdown_named "$android_name" || true
      fi
      rm -rf "$lockdir" 2>/dev/null || true
      agent_ui_pool_clear_idle_stamps "$slot"
      continue
    fi

    # Stale lockdir from a dead holder — clear it so the slot is claimable.
    if [[ -d "$lockdir" ]]; then
      echo "agent-ui: clearing orphaned slot ${slot} lock (holder gone)" >&2
      rm -rf "$lockdir" 2>/dev/null || true
    fi
    # Untracked warm device → shut down (default) or idle-stamp when KEEP parks warm.
    if agent_ui_pool_slot_ios_warm "$slot"; then
      if agent_ui_pool_keep_ios; then
        if [[ ! -f "$(agent_ui_pool_ios_idle_path "$slot")" ]]; then
          echo "agent-ui: adopting orphaned warm iOS slot ${slot} into idle GC" >&2
          agent_ui_pool_mark_ios_idle "$slot"
        fi
      else
        ios_name="$(agent_ui_pool_ios_name "$slot")"
        echo "agent-ui: shutting down orphaned iOS '${ios_name}' (slot ${slot})" >&2
        # shellcheck disable=SC1091
        source "${root}/scripts/lib/ios-simulator.sh"
        ios_sim_shutdown_agent_named "$ios_name" || true
        agent_ui_pool_clear_ios_idle "$slot"
      fi
    fi
    if agent_ui_pool_slot_android_warm "$slot"; then
      if agent_ui_pool_keep_android; then
        if [[ ! -f "$(agent_ui_pool_android_idle_path "$slot")" ]]; then
          echo "agent-ui: adopting orphaned warm Android slot ${slot} into idle GC" >&2
          agent_ui_pool_mark_android_idle "$slot"
        fi
      else
        android_name="$(agent_ui_pool_android_name "$slot")"
        echo "agent-ui: shutting down orphaned Android '${android_name}' (slot ${slot})" >&2
        # shellcheck disable=SC1091
        source "${root}/scripts/lib/android-emulator.sh"
        android_emu_shutdown_named "$android_name" || true
        agent_ui_pool_clear_android_idle "$slot"
      fi
    fi
  done
  return 0
}

# True when this slot's iOS agent sim is Booted and/or its Android AVD is on adb.
# Used by cold-slot claiming: already-up devices are skipped unless allow_busy
# (warm-orphan reclaim). Live lock holders are never claimable.
# BIND_DEVICES=0 (unit tests) → always "not up".
agent_ui_pool_slot_devices_up() {
  local slot="$1" ios_name android_name root serial
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 1 ;;
  esac
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 1

  ios_name="$(agent_ui_pool_ios_name "$slot")"
  if xcrun simctl list devices booted -j 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("name") == name and d.get("state") == "Booted":
            raise SystemExit(0)
raise SystemExit(1)
' "$ios_name" >/dev/null 2>&1; then
    return 0
  fi

  android_name="$(agent_ui_pool_android_name "$slot")"
  root="$(agent_ui_pool_repo_root)"
  # shellcheck disable=SC1091
  source "${root}/scripts/lib/android-emulator.sh"
  serial="$(
    ONTRACK_ANDROID_AVD="$android_name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
  )"
  [[ -n "${serial:-}" ]]
}

# Try to exclusive-claim slot's lockdir. When allow_busy_devices=0 (default),
# release immediately if the slot's sim/AVD is already running.
# Returns 0 and sets AGENT_UI_POOL_CLAIM_SLOT / AGENT_UI_POOL_CLAIM_LOCKDIR.
agent_ui_pool_try_claim_slot() {
  local want="$1"
  local allow_busy="${2:-0}"
  local lockdir owner
  lockdir="$(agent_ui_pool_slot_lockdir "$want")"

  if mkdir "${lockdir}" 2>/dev/null; then
    :
  elif [[ "$(cat "${lockdir}/pid" 2>/dev/null || true)" == "$$" ]]; then
    # Already ours (nested / re-entry) — devices may be Booted; keep the claim.
    AGENT_UI_POOL_CLAIM_SLOT="$want"
    AGENT_UI_POOL_CLAIM_LOCKDIR="$lockdir"
    return 0
  else
    owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
    if [[ -n "${owner}" ]] && ! kill -0 "${owner}" 2>/dev/null; then
      echo "agent-ui: clearing stale pool slot ${want} (pid ${owner} gone)" >&2
      rm -rf "${lockdir}"
      mkdir "${lockdir}" 2>/dev/null || return 1
    else
      return 1
    fi
  fi

  if [[ "$allow_busy" != "1" ]] && agent_ui_pool_slot_devices_up "$want"; then
    echo "agent-ui: slot ${want} devices already up — skipping (likely in use)" >&2
    rm -rf "${lockdir}" 2>/dev/null || true
    return 1
  fi

  AGENT_UI_POOL_CLAIM_SLOT="$want"
  AGENT_UI_POOL_CLAIM_LOCKDIR="$lockdir"
  return 0
}

# Shut down this slot's devices when the lease ends.
# Default: safe shutdown both platforms (KEEP_IOS/KEEP_ANDROID=0) so the next
# agent can reload quickly from snapshot / cold boot — never leave orphans.
# Park warm this turn: KEEP_IOS=1 / KEEP_ANDROID=1 / KEEP_DEVICES=1.
# Skipped when BIND_DEVICES=0 (unit tests).
agent_ui_pool_shutdown_slot() {
  local slot="${1:-${AGENT_UI_SLOT:-}}" ios_name android_name keep_ios=0 keep_android=0
  local keep_parts=() kill_parts=()
  case "${AGENT_UI_KEEP_DEVICES:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
  esac
  case "${AGENT_UI_POOL_BIND_DEVICES:-1}" in
    0|false|FALSE|no|NO) return 0 ;;
  esac
  [[ -n "$slot" && "$slot" =~ ^[1-9][0-9]*$ ]] || return 0

  ios_name="$(agent_ui_pool_ios_name "$slot")"
  android_name="$(agent_ui_pool_android_name "$slot")"
  if agent_ui_pool_keep_ios; then
    keep_ios=1
    keep_parts+=("iOS '${ios_name}'")
  else
    kill_parts+=("iOS '${ios_name}'")
  fi
  if agent_ui_pool_keep_android; then
    keep_android=1
    keep_parts+=("Android '${android_name}'")
  else
    kill_parts+=("Android '${android_name}'")
  fi

  if ((${#kill_parts[@]} == 0)); then
    echo "agent-ui: releasing slot ${slot} — keeping ${keep_parts[*]} warm" >&2
  elif ((${#keep_parts[@]} == 0)); then
    echo "agent-ui: releasing slot ${slot} — shutting down ${kill_parts[*]}" >&2
  else
    echo "agent-ui: releasing slot ${slot} — shutting down ${kill_parts[*]}; keeping ${keep_parts[*]} warm" >&2
  fi

  if (( keep_ios == 0 )); then
    # shellcheck disable=SC1091
    source "$(agent_ui_pool_repo_root)/scripts/lib/ios-simulator.sh"
    ios_sim_shutdown_agent_named "$ios_name" || true
    agent_ui_pool_clear_ios_idle "$slot"
  else
    agent_ui_pool_mark_ios_idle "$slot"
  fi

  if (( keep_android == 0 )); then
    # shellcheck disable=SC1091
    source "$(agent_ui_pool_repo_root)/scripts/lib/android-emulator.sh"
    # Safe shutdown: save default_boot first so the next agent gets a snapshot
    # boot instead of a multi-minute cold start (agent AVDs run
    # -no-snapshot-save so a kill can never corrupt saved state).
    local android_serial
    android_serial="$(
      ONTRACK_ANDROID_AVD="$android_name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
    )"
    if [[ -n "$android_serial" ]]; then
      android_emu_regenerate_default_snapshot "$android_serial" "$android_name" || true
    fi
    android_emu_shutdown_named "$android_name" || true
    agent_ui_pool_clear_android_idle "$slot"
  else
    agent_ui_pool_mark_android_idle "$slot"
  fi
}

agent_ui_release_lease() {
  if [[ "${AGENT_UI_LOCK_ACQUIRED:-0}" != "1" ]]; then
    return 0
  fi
  local lockdir owner slot
  lockdir="${AGENT_UI_LOCK_DIR:-}"
  slot="${AGENT_UI_SLOT:-}"
  if [[ -z "$lockdir" ]]; then
    AGENT_UI_LOCK_ACQUIRED=0
    AGENT_UI_LOCK_HELD=0
    export AGENT_UI_LOCK_ACQUIRED AGENT_UI_LOCK_HELD
    return 0
  fi
  owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
  if [[ "${owner}" == "$$" ]]; then
    # Done with the slot — always close the agent devices (not the user's headed sims).
    agent_ui_pool_shutdown_slot "$slot" || true
    rm -rf "${lockdir}" 2>/dev/null || true
  fi
  AGENT_UI_LOCK_ACQUIRED=0
  AGENT_UI_LOCK_HELD=0
  export AGENT_UI_LOCK_ACQUIRED AGENT_UI_LOCK_HELD
}

# Claim a free pool slot (or wait). Sets AGENT_UI_SLOT + device env + lease flags.
# Escape: AGENT_UI_SKIP_LEASE=1. Disable pool: AGENT_UI_USE_POOL=0 (single legacy lock).
agent_ui_ensure_lease() {
  if [[ "${AGENT_UI_SKIP_LEASE:-0}" == "1" ]]; then
    return 0
  fi

  # Nested child inherits the parent's slot + lease.
  if [[ "${AGENT_UI_LOCK_HELD:-0}" == "1" && -n "${AGENT_UI_SLOT:-}" ]]; then
    local lockdir owner
    lockdir="${AGENT_UI_LOCK_DIR:-$(agent_ui_pool_slot_lockdir "$AGENT_UI_SLOT")}"
    owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
    if [[ "${AGENT_UI_LOCK_ACQUIRED:-0}" == "1" || "${owner}" == "$$" ]]; then
      AGENT_UI_LOCK_ACQUIRED=1
      AGENT_UI_LOCK_HELD=1
      export AGENT_UI_LOCK_ACQUIRED AGENT_UI_LOCK_HELD AGENT_UI_LOCK_DIR="$lockdir"
      trap 'agent_ui_release_lease' EXIT INT TERM HUP
    fi
    # Re-export device pins for children that cleared env.
    if agent_ui_pool_want && [[ -n "${AGENT_UI_SLOT:-}" ]]; then
      agent_ui_pool_apply_devices "$AGENT_UI_SLOT" || true
    fi
    return 0
  fi

  if ! agent_ui_pool_want; then
    agent_ui_ensure_legacy_lease
    return $?
  fi

  local max wait_secs deadline last_msg slot lockdir owner claimed=0 orphan="" warm=""
  max="$(agent_ui_pool_max)"
  mkdir -p "$(agent_ui_pool_root)"
  wait_secs="${AGENT_UI_LOCK_WAIT_SECS:-300}"
  deadline=$((SECONDS + wait_secs))
  last_msg=-999
  unset AGENT_UI_POOL_CLAIM_SLOT AGENT_UI_POOL_CLAIM_LOCKDIR

  # Drop lock-free devices that sat idle past the TTL.
  agent_ui_pool_gc_idle_devices || true

  # Preferred slot pin (parent / explicit).
  # Warm pin (iOS Booted and/or Android up, lock free) → allow_busy; else cold.
  if [[ -n "${AGENT_UI_SLOT:-}" && "${AGENT_UI_SLOT}" =~ ^[1-9][0-9]*$ ]] && (( AGENT_UI_SLOT <= max )); then
    if agent_ui_pool_slot_lock_free "$AGENT_UI_SLOT" \
      && agent_ui_pool_slot_warm "$AGENT_UI_SLOT"; then
      if agent_ui_pool_try_claim_slot "$AGENT_UI_SLOT" 1; then
        claimed=1
        slot="$AGENT_UI_POOL_CLAIM_SLOT"
        lockdir="$AGENT_UI_POOL_CLAIM_LOCKDIR"
        echo "agent-ui: reclaiming warm slot ${slot} ($(agent_ui_pool_slot_warm_label "$slot"))" >&2
      fi
    elif agent_ui_pool_try_claim_slot "$AGENT_UI_SLOT" 0; then
      claimed=1
      slot="$AGENT_UI_POOL_CLAIM_SLOT"
      lockdir="$AGENT_UI_POOL_CLAIM_LOCKDIR"
    fi
  fi

  # One sweep = warm orphan → cold free slot → lock-free orphan. Runs at least
  # once even with wait_secs=0 (default: stop instead of queueing).
  while :; do
    orphan=""
    warm=""
    # Prefer warm orphans (lock free + iOS Booted and/or Android up) over cold.
    for ((slot = 1; slot <= max; slot++)); do
      agent_ui_pool_slot_lock_free "$slot" || continue
      if agent_ui_pool_slot_warm "$slot"; then
        warm="$slot"
        if agent_ui_pool_try_claim_slot "$warm" 1; then
          echo "agent-ui: reclaiming warm slot ${warm} ($(agent_ui_pool_slot_warm_label "$warm"))" >&2
          claimed=1
          slot="$AGENT_UI_POOL_CLAIM_SLOT"
          lockdir="$AGENT_UI_POOL_CLAIM_LOCKDIR"
          break
        fi
        warm=""
      fi
    done
    # Cold free slots (lock free + devices not running).
    if (( claimed == 0 )); then
      for ((slot = 1; slot <= max; slot++)); do
        if agent_ui_pool_try_claim_slot "$slot" 0; then
          claimed=1
          slot="$AGENT_UI_POOL_CLAIM_SLOT"
          lockdir="$AGENT_UI_POOL_CLAIM_LOCKDIR"
          break
        fi
        # Remember first lock-free orphan (devices up, no live holder) for fallback.
        if [[ -z "$orphan" ]] && agent_ui_pool_slot_lock_free "$slot"; then
          if agent_ui_pool_slot_devices_up "$slot"; then
            orphan="$slot"
          fi
        fi
      done
    fi
    # No cold slot: reclaim an orphaned already-up device rather than stall.
    if (( claimed == 0 )) && [[ -n "$orphan" ]]; then
      if agent_ui_pool_try_claim_slot "$orphan" 1; then
        echo "agent-ui: reclaiming slot ${orphan} (devices already up; no cold free slot)" >&2
        claimed=1
        slot="$AGENT_UI_POOL_CLAIM_SLOT"
        lockdir="$AGENT_UI_POOL_CLAIM_LOCKDIR"
      fi
    fi
    if (( claimed == 1 )); then
      break
    fi
    if (( SECONDS >= deadline )); then
      break
    fi
    if (( SECONDS - last_msg >= 5 )); then
      echo "agent-ui: waiting for agent device slot (0/${max} free; waited $((SECONDS - (deadline - wait_secs)))s)" >&2
      last_msg=$SECONDS
    fi
    sleep 0.4
  done

  if (( claimed == 0 )); then
    echo "agent-ui: no free agent device slot (0/${max} free) — stopping without UI verify." >&2
    echo "agent-ui: another agent owns each slot; never fall back to a non-agent device (onTrack iPhone 17 Pro / Galaxy_S26). Report the skip and finish the turn." >&2
    echo "agent-ui: pool $(agent_ui_pool_root) (waited ${wait_secs}s)" >&2
    return "${AGENT_UI_NO_SLOT_EXIT}"
  fi

  printf '%s\n' "$$" >"${lockdir}/pid"
  {
    printf 'pid=%s\n' "$$"
    printf 'ppid=%s\n' "${PPID}"
    printf 'slot=%s\n' "$slot"
    printf 'platform=%s\n' "$(agent_ui_platform)"
    printf 'started=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'cmd=%s\n' "${0:-agent-ui}"
  } >"${lockdir}/meta" 2>/dev/null || true

  AGENT_UI_SLOT="$slot"
  AGENT_UI_LOCK_DIR="$lockdir"
  AGENT_UI_LOCK_HELD=1
  AGENT_UI_LOCK_ACQUIRED=1
  export AGENT_UI_SLOT AGENT_UI_LOCK_DIR AGENT_UI_LOCK_HELD AGENT_UI_LOCK_ACQUIRED
  trap 'agent_ui_release_lease' EXIT INT TERM HUP

  agent_ui_pool_clear_idle_stamps "$slot"

  if ! agent_ui_pool_apply_devices "$slot"; then
    agent_ui_release_lease
    return 1
  fi


  echo "agent-ui: acquired device slot ${slot}/${max}" >&2
  return 0
}

# Legacy single exclusive lock (AGENT_UI_USE_POOL=0).
agent_ui_ensure_legacy_lease() {
  local lockdir owner wait_secs deadline last_msg meta_platform meta_started
  lockdir="${AGENT_UI_LOCK_DIR:-$(agent_ui_pool_repo_root)/.cursor/agent-ui.lockdir}"

  if [[ "${AGENT_UI_LOCK_HELD:-0}" == "1" ]]; then
    owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
    if [[ "${AGENT_UI_LOCK_ACQUIRED:-0}" == "1" || "${owner}" == "$$" ]]; then
      AGENT_UI_LOCK_ACQUIRED=1
      AGENT_UI_LOCK_HELD=1
      export AGENT_UI_LOCK_ACQUIRED AGENT_UI_LOCK_HELD AGENT_UI_LOCK_DIR="$lockdir"
      trap 'agent_ui_release_lease' EXIT INT TERM HUP
    fi
    return 0
  fi

  mkdir -p "$(dirname "${lockdir}")"
  wait_secs="${AGENT_UI_LOCK_WAIT_SECS:-300}"
  deadline=$((SECONDS + wait_secs))
  last_msg=-999

  while (( SECONDS < deadline )); do
    if mkdir "${lockdir}" 2>/dev/null; then
      printf '%s\n' "$$" >"${lockdir}/pid"
      {
        printf 'pid=%s\n' "$$"
        printf 'ppid=%s\n' "${PPID}"
        printf 'platform=%s\n' "$(agent_ui_platform)"
        printf 'started=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'cmd=%s\n' "${0:-agent-ui}"
      } >"${lockdir}/meta" 2>/dev/null || true
      AGENT_UI_LOCK_DIR="$lockdir"
      AGENT_UI_LOCK_HELD=1
      AGENT_UI_LOCK_ACQUIRED=1
      export AGENT_UI_LOCK_DIR AGENT_UI_LOCK_HELD AGENT_UI_LOCK_ACQUIRED
      trap 'agent_ui_release_lease' EXIT INT TERM HUP
      echo "agent-ui: acquired simulator lease (legacy single lock)" >&2
      return 0
    fi

    owner="$(cat "${lockdir}/pid" 2>/dev/null || true)"
    if [[ -n "${owner}" ]] && ! kill -0 "${owner}" 2>/dev/null; then
      echo "agent-ui: clearing stale simulator lease (pid ${owner} gone)" >&2
      rm -rf "${lockdir}"
      continue
    fi
    if [[ "${owner}" == "$$" ]]; then
      AGENT_UI_LOCK_DIR="$lockdir"
      AGENT_UI_LOCK_HELD=1
      AGENT_UI_LOCK_ACQUIRED=1
      export AGENT_UI_LOCK_DIR AGENT_UI_LOCK_HELD AGENT_UI_LOCK_ACQUIRED
      trap 'agent_ui_release_lease' EXIT INT TERM HUP
      return 0
    fi
    if (( SECONDS - last_msg >= 5 )); then
      meta_platform="$(grep '^platform=' "${lockdir}/meta" 2>/dev/null | cut -d= -f2- || true)"
      meta_started="$(grep '^started=' "${lockdir}/meta" 2>/dev/null | cut -d= -f2- || true)"
      echo "agent-ui: waiting for simulator lease (held by pid ${owner:-?} platform=${meta_platform:-?} since ${meta_started:-?})" >&2
      last_msg=$SECONDS
    fi
    sleep 0.4
  done

  echo "error: another agent holds the simulator lease (lock: ${lockdir}; waited ${wait_secs}s). Stop without UI verify — do not fall back to a non-agent device." >&2
  return "${AGENT_UI_NO_SLOT_EXIT}"
}
