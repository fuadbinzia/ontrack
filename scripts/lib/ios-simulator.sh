#!/usr/bin/env bash
# Shared iOS Simulator helpers for onTrack agents / packager scripts.
#
# Default device: "onTrack iPhone 17 Pro" (iPhone 17 Pro hardware, latest iOS runtime).
# Override with ONTRACK_IOS_SIMULATOR="<name>" (any simctl device name),
# or ONTRACK_IOS_SIMULATOR_UDID=<udid> for an exact device.
#
# Headless by default: `simctl boot` without opening Simulator.app.
# Agent-ui dump/tap/assert/screenshot (`simctl io`) all work without a window.
# Set ONTRACK_IOS_SIMULATOR_WINDOW=1 to also open Simulator.app for a visual view.
#
# Coexistence: the user's headed Simulator.app may stay open. Apple attaches a
# window to every Booted device, so agent pool sims (`onTrack Agent N`) get
# windows too — we minimize those by default (never quit Simulator.app; never
# close a window = shutdown). If you explicitly open / restore an agent window
# (Dock, Window menu, or ios_sim_open_agent_headed), it is pinned headed and
# the reaper will not minimize it again.
#
# If opening the GUI: never bare `open -a Simulator` before the preferred device
# is the only Booted sim — that restores a multi-device layout (e.g. iPhone 17
# beside iPhone 17 Pro).

: "${ONTRACK_IOS_SIMULATOR:=onTrack iPhone 17 Pro}"
: "${ONTRACK_IOS_SIMULATOR_DEVICE_TYPE:=com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro}"
: "${ONTRACK_IOS_SIMULATOR_WINDOW:=0}"
# Hard cap for simctl RPCs. A wedged CoreSimulator otherwise hangs forever and
# freezes Simulator.app (common when overlapping agents call get_app_container /
# terminate / launch concurrently).
: "${ONTRACK_SIMCTL_TIMEOUT_SECS:=10}"

# Launch-budget helper (agent policy: >30s to launch is a defect to diagnose).
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/device-launch-budget.sh"


# Run `xcrun simctl …` with a hard alarm so agents fail fast instead of wedging.
# Usage: ios_simctl_timed [secs] <simctl-args…>
# Exit 142 (SIGALRM) on timeout. Default secs: ONTRACK_SIMCTL_TIMEOUT_SECS.
ios_simctl_timed() {
  local secs="${ONTRACK_SIMCTL_TIMEOUT_SECS}"
  if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
    secs="$1"
    shift
  fi
  perl -e 'alarm shift @ARGV; exec @ARGV' "$secs" xcrun simctl "$@"
}

ios_sim_preferred_name() {
  printf '%s' "${ONTRACK_IOS_SIMULATOR}"
}

# User-facing headed Simulator name. Pool leases set ONTRACK_IOS_SIMULATOR to
# `onTrack Agent N` — never hand off / focus that; always the preferred Pro
# (or ONTRACK_IOS_VIEWER_SIMULATOR override).
ios_sim_viewer_name() {
  local name="${ONTRACK_IOS_VIEWER_SIMULATOR:-}"
  if [[ -n "$name" ]]; then
    printf '%s' "$name"
    return 0
  fi
  name="${ONTRACK_IOS_SIMULATOR:-onTrack iPhone 17 Pro}"
  case "$name" in
    onTrack\ Agent*|onTrack_Agent*)
      printf '%s' "onTrack iPhone 17 Pro"
      ;;
    *)
      printf '%s' "$name"
      ;;
  esac
}

ios_sim_want_window() {
  case "${ONTRACK_IOS_SIMULATOR_WINDOW:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# True when agent device pool owns this process (multiple booted sims OK).
ios_sim_pool_mode() {
  case "${AGENT_UI_POOL_MODE:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# simctl device target: explicit UDID when pinned, else "booted".
ios_sim_target() {
  if [[ -n "${ONTRACK_IOS_SIMULATOR_UDID:-}" ]]; then
    printf '%s' "${ONTRACK_IOS_SIMULATOR_UDID}"
  else
    printf 'booted'
  fi
}

# Print identifier of the newest available iOS Simulator runtime (e.g. iOS-26-5).
ios_sim_latest_ios_runtime() {
  xcrun simctl list runtimes available -j 2>/dev/null | python3 -c '
import json, re, sys

data = json.load(sys.stdin)
best = None  # (major, minor, patch, identifier)

for runtime in data.get("runtimes", []):
    if runtime.get("isAvailable") is False:
        continue
    ident = runtime.get("identifier") or ""
    if "SimRuntime.iOS-" not in ident:
        continue
    version = str(runtime.get("version") or "")
    nums = [int(x) for x in re.findall(r"\d+", version)]
    while len(nums) < 3:
        nums.append(0)
    key = (nums[0], nums[1], nums[2], ident)
    if best is None or key[:3] > best[:3] or (key[:3] == best[:3] and ident > best[3]):
        best = key

if not best:
    raise SystemExit(1)
print(best[3])
'
}

# Create the preferred device on the latest iOS runtime when missing.
# No-op when ONTRACK_IOS_SIMULATOR_UDID is set (exact device) or the name already exists.
ios_sim_ensure_device_exists() {
  local name want_udid runtime udid device_type
  name="$(ios_sim_preferred_name)"
  want_udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  if [[ -n "$want_udid" ]]; then
    return 0
  fi

  if xcrun simctl list devices available -j 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
data = json.load(sys.stdin)
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("name") == name and d.get("isAvailable") is not False:
            raise SystemExit(0)
raise SystemExit(1)
' "$name"; then
    return 0
  fi

  if ! runtime="$(ios_sim_latest_ios_runtime)"; then
    echo "error: no available iOS Simulator runtime to create '${name}'" >&2
    return 1
  fi

  device_type="${ONTRACK_IOS_SIMULATOR_DEVICE_TYPE}"
  echo "Creating preferred simulator: ${name} (${device_type} @ ${runtime})"
  if ! udid="$(xcrun simctl create "$name" "$device_type" "$runtime")"; then
    echo "error: failed to create simulator '${name}'" >&2
    return 1
  fi
  echo "Created simulator ${name} (${udid})"
}

# Print UDID of the preferred device if it is already Booted; else empty.
ios_sim_preferred_booted_udid() {
  local name want_udid
  name="$(ios_sim_preferred_name)"
  want_udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  xcrun simctl list devices booted -j 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
want = sys.argv[2]
data = json.load(sys.stdin)
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("state") != "Booted":
            continue
        if want and d.get("udid") == want:
            print(d["udid"])
            raise SystemExit(0)
        if not want and d.get("name") == name:
            print(d["udid"])
            raise SystemExit(0)
' "$name" "$want_udid" 2>/dev/null || true
}

# Resolve an available UDID for the preferred simulator name.
# Prefers: explicit UDID → already-booted match → newest available runtime.
ios_sim_resolve_udid() {
  local name want_udid
  name="$(ios_sim_preferred_name)"
  want_udid="${ONTRACK_IOS_SIMULATOR_UDID:-}"
  if [[ -n "$want_udid" ]]; then
    printf '%s' "$want_udid"
    return 0
  fi
  ios_sim_ensure_device_exists || return 1
  xcrun simctl list devices available -j 2>/dev/null | python3 -c '
import json, re, sys

name = sys.argv[1]
data = json.load(sys.stdin)
booted = []
available = []

def runtime_key(runtime: str):
    # com.apple.CoreSimulator.SimRuntime.iOS-26-5 → (26, 5, 0)
    m = re.search(r"iOS-(\d+)(?:-(\d+))?(?:-(\d+))?", runtime)
    if not m:
        return (0, 0, 0, runtime)
    nums = [int(x) if x else 0 for x in m.groups()]
    while len(nums) < 3:
        nums.append(0)
    return (nums[0], nums[1], nums[2], runtime)

items = list(data.get("devices", {}).items())
for runtime, devices in items:
    for d in devices:
        if d.get("name") != name:
            continue
        if d.get("isAvailable") is False:
            continue
        entry = (runtime_key(runtime), d["udid"], d.get("state"))
        available.append(entry)
        if d.get("state") == "Booted":
            booted.append(entry)

if booted:
    booted.sort()
    print(booted[-1][1])
    raise SystemExit(0)
if not available:
    raise SystemExit(1)
available.sort()
print(available[-1][1])
' "$name"
}

# User Pro + agent pool — never shut these down to uniquify `simctl booted`.
ios_sim_is_protected_sim_name() {
  case "$1" in
    onTrack\ Agent*|onTrack\ iPhone\ 17\ Pro) return 0 ;;
    *) return 1 ;;
  esac
}

# Shut down every Booted device except keep_udid (so `simctl … booted` is unique).
# No-op in agent pool mode — other slots / the user's headed sim must stay up.
# Also never kill Pro or Agent N when a non-pool ensure-packager targets Pro (H22).
ios_sim_shutdown_others() {
  local keep_udid="$1" name other
  if ios_sim_pool_mode; then
    return 0
  fi
  while IFS=$'\t' read -r name other; do
    [[ -z "$other" || "$other" == "$keep_udid" ]] && continue
    if ios_sim_is_protected_sim_name "$name"; then
      continue
    fi
    echo "Shutting down other simulator: ${other}"
    xcrun simctl shutdown "$other" >/dev/null 2>&1 || true
  done < <(xcrun simctl list devices booted -j 2>/dev/null | python3 -c '
import json, sys
data = json.load(sys.stdin)
for devices in data.get("devices", {}).values():
    for d in devices:
        if d.get("state") == "Booted":
            print(f"{d.get(\"name\") or \"\"}\t{d.get(\"udid\") or \"\"}")
' 2>/dev/null || true)
}

# Opt-in: open Simulator.app focused on one UDID (not used for headless verify).
ios_sim_open_focused() {
  local udid="$1"
  defaults write com.apple.iphonesimulator CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
  # Already running: do not re-open — that restores peer device windows.
  if pgrep -x Simulator >/dev/null 2>&1; then
    return 0
  fi
  open -a Simulator --args -CurrentDeviceUDID "$udid" >/dev/null 2>&1 \
    || open -a Simulator >/dev/null 2>&1 \
    || true
}

# True when Simulator.app is running (user may be watching a headed window).
ios_sim_app_running() {
  pgrep -x Simulator >/dev/null 2>&1
}

# Raise + unminimize the Simulator window whose title contains the device name.
# Used by headed handoff so the preferred Pro is what the user sees — not a
# minimized/stale agent pool window.
ios_sim_focus_window_named() {
  local want="$1" safe
  [[ -n "$want" ]] || return 1
  safe="$(printf '%s' "$want" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  osascript >/dev/null 2>&1 <<EOF || true
tell application "Simulator" to activate
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    set frontmost to true
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "${safe}" then
          try
            set value of attribute "AXMinimized" of w to false
          end try
          perform action "AXRaise" of w
          set index of w to 1
          return
        end if
      end try
    end repeat
  end tell
end tell
EOF
  ios_sim_place_window_named "$want" right 2>/dev/null || true
}

ios_sim_agent_pool_dir() {
  local root="${AGENT_UI_POOL_DIR:-}"
  if [[ -z "$root" ]]; then
    if [[ -n "${AGENT_UI_ROOT:-}" ]]; then
      root="${AGENT_UI_ROOT}/.cursor/agent-ui-slots"
    elif [[ -n "${ROOT:-}" ]]; then
      root="${ROOT}/.cursor/agent-ui-slots"
    else
      root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.cursor/agent-ui-slots"
    fi
  fi
  mkdir -p "$root" 2>/dev/null || true
  printf '%s' "$root"
}

ios_sim_agent_gui_reaper_pidfile() {
  printf '%s/gui-reaper.pid' "$(ios_sim_agent_pool_dir)"
}

ios_sim_headed_agents_file() {
  printf '%s/headed-agents' "$(ios_sim_agent_pool_dir)"
}

ios_sim_minimized_agents_file() {
  printf '%s/minimized-agents' "$(ios_sim_agent_pool_dir)"
}

# Fresh while agent_ui_color.py is unparking for simctl screenshot / alert OCR.
ios_sim_ios_capture_lock_file() {
  printf '%s/ios-capture.lock' "$(ios_sim_agent_pool_dir)"
}

# True when a capture heal holds the reaper (stale locks >90s are ignored).
ios_sim_ios_capture_in_progress() {
  local lock age
  lock="$(ios_sim_ios_capture_lock_file)"
  [[ -f "$lock" ]] || return 1
  age="$(perl -e 'print int(time - (stat($ARGV[0]))[9])' "$lock" 2>/dev/null || echo 999)"
  [[ "${age:-999}" -lt 90 ]]
}

# "onTrack Agent 1 – iOS 26.5" → "onTrack Agent 1"
ios_sim_agent_base_name() {
  local raw="${1:-}"
  raw="${raw%% – *}"
  raw="${raw%% - *}"
  printf '%s' "$raw"
}

ios_sim_mark_agent_headed() {
  local name file
  name="$(ios_sim_agent_base_name "${1:-}")"
  [[ "$name" == onTrack\ Agent* ]] || return 1
  file="$(ios_sim_headed_agents_file)"
  if grep -qxF "$name" "$file" 2>/dev/null; then
    return 0
  fi
  echo "$name" >>"$file"
  echo "agent-ui: pinning ${name} headed (will not auto-minimize)" >&2
}

ios_sim_clear_agent_gui_pins() {
  local name file tmp
  name="$(ios_sim_agent_base_name "${1:-}")"
  [[ -n "$name" ]] || return 0
  for file in "$(ios_sim_headed_agents_file)" "$(ios_sim_minimized_agents_file)"; do
    [[ -f "$file" ]] || continue
    tmp="${file}.tmp"
    grep -vxF "$name" "$file" >"$tmp" 2>/dev/null || true
    mv "$tmp" "$file" 2>/dev/null || true
  done
}

# Shut down a pool agent simulator (closes its window if Simulator.app is open).
ios_sim_shutdown_agent_named() {
  local name udid
  name="$(ios_sim_agent_base_name "${1:-}")"
  [[ "$name" == onTrack\ Agent* ]] || return 0
  ios_sim_clear_agent_gui_pins "$name"
  (
    export ONTRACK_IOS_SIMULATOR="$name"
    unset ONTRACK_IOS_SIMULATOR_UDID
    udid="$(ios_sim_resolve_udid 2>/dev/null || true)"
    if [[ -n "$udid" ]]; then
      echo "Shutting down agent simulator: ${name} (${udid})" >&2
      xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
    fi
  )
}

ios_sim_agent_is_headed() {
  local name
  name="$(ios_sim_agent_base_name "${1:-}")"
  grep -qxF "$name" "$(ios_sim_headed_agents_file)" 2>/dev/null
}

ios_sim_mark_minimized_agent() {
  local name file
  name="$(ios_sim_agent_base_name "${1:-}")"
  file="$(ios_sim_minimized_agents_file)"
  grep -qxF "$name" "$file" 2>/dev/null || echo "$name" >>"$file"
}

ios_sim_was_minimized_agent() {
  local name
  name="$(ios_sim_agent_base_name "${1:-}")"
  grep -qxF "$name" "$(ios_sim_minimized_agents_file)" 2>/dev/null
}

# Honor ONTRACK_IOS_AGENT_HEADED="1,2" / "onTrack Agent 1" pins from the env.
ios_sim_import_headed_env() {
  local raw item
  raw="${ONTRACK_IOS_AGENT_HEADED:-}"
  [[ -n "$raw" ]] || return 0
  IFS=',' read -r -a items <<<"$raw"
  for item in "${items[@]}"; do
    item="$(echo "$item" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [[ -n "$item" ]] || continue
    if [[ "$item" =~ ^[0-9]+$ ]]; then
      ios_sim_mark_agent_headed "onTrack Agent ${item}"
    else
      ios_sim_mark_agent_headed "$item"
    fi
  done
}

# Print "onTrack Agent N|minimized" / "|visible" lines for current Simulator windows.
ios_sim_list_agent_window_states() {
  osascript 2>/dev/null <<'EOF' || true
tell application "System Events"
  if not (exists process "Simulator") then return ""
  tell process "Simulator"
    set out to {}
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "onTrack Agent" then
          set m to false
          try
            set m to value of attribute "AXMinimized" of w
          end try
          if m then
            set end of out to wn & "|minimized"
          else
            set end of out to wn & "|visible"
          end if
        end if
      end try
    end repeat
    set AppleScript's text item delimiters to linefeed
    return out as text
  end tell
end tell
EOF
}

ios_sim_minimize_agent_window_named() {
  local want safe
  want="$(ios_sim_agent_base_name "${1:-}")"
  [[ -n "$want" ]] || return 1
  safe="$(printf '%s' "$want" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  osascript >/dev/null 2>&1 <<EOF || true
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "${safe}" then
          try
            if (value of attribute "AXMinimized" of w) is true then return
          end try
          try
            click (first button of w whose subrole is "AXMinimizeButton")
          end try
          try
            set value of attribute "AXMinimized" of w to true
          end try
          return
        end if
      end try
    end repeat
  end tell
end tell
EOF
}

# Place a Simulator window on the right side of the main display
# (Android headed GUI owns the left). Uses dTopY — deskTop is reserved.
# Side override: ios_sim_place_window_named <name> [right|left|center]
ios_sim_place_window_named() {
  local want safe side margin
  want="$(ios_sim_agent_base_name "${1:-}")"
  [[ -n "$want" ]] || want="${1:-}"
  [[ -n "$want" ]] || return 1
  side="${2:-right}"
  margin="${ONTRACK_DEVICE_WINDOW_MARGIN:-24}"
  safe="$(printf '%s' "$want" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  osascript >/dev/null 2>&1 <<EOF || true
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "${safe}" then
          set winSize to size of w
          set deskBounds to {0, 0, 1800, 1169}
          try
            tell application "Finder" to set deskBounds to bounds of window of desktop
          end try
          set dLeft to item 1 of deskBounds
          set dTopY to item 2 of deskBounds
          set dW to (item 3 of deskBounds) - dLeft
          set dH to (item 4 of deskBounds) - dTopY
          set winW to item 1 of winSize
          set winH to item 2 of winSize
          set margin to ${margin}
          if "${side}" is "left" then
            set newX to dLeft + margin
          else if "${side}" is "center" then
            set newX to dLeft + ((dW - winW) div 2)
          else
            set newX to dLeft + dW - winW - margin
          end if
          set newY to dTopY + ((dH - winH) div 2)
          if newY < 40 then set newY to 40
          if newX < dLeft then set newX to dLeft
          set maxX to dLeft + dW - winW
          if newX > maxX then set newX to maxX
          set position of w to {newX, newY}
          return
        end if
      end try
    end repeat
  end tell
end tell
EOF
}

# Compat alias — preferred/user windows go right (not center) beside Android.
ios_sim_center_agent_window_named() {
  ios_sim_place_window_named "${1:-}" right
}

# Unminimize an agent window and place it on the right of the main display.
# AXMinimized=false is unreliable for Simulator — restore via Dock click when needed.
# Place geometry first so Dock restore does not reopen off-screen.
ios_sim_unminimize_agent_window_named() {
  local want safe
  want="$(ios_sim_agent_base_name "${1:-}")"
  [[ -n "$want" ]] || return 1
  safe="$(printf '%s' "$want" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  # 1) Move restore-frame to the right while still minimized (if present).
  ios_sim_place_window_named "$want" right
  # 2) Restore from Dock when miniaturized (AXMinimized=false often no-ops;
  #    AXPress on the minimized Dock item is what actually restores).
  local attempt
  for attempt in 1 2 3; do
    osascript >/dev/null 2>&1 <<EOF || true
tell application "System Events"
  tell process "Dock"
    if exists UI element "${safe}" of list 1 then
      perform action "AXPress" of UI element "${safe}" of list 1
    end if
  end tell
end tell
EOF
    sleep 0.35
    # Stop once the window reports visible.
    if osascript 2>/dev/null <<EOF | grep -q '|visible$'
tell application "System Events"
  if not (exists process "Simulator") then return ""
  tell process "Simulator"
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "${safe}" then
          set m to false
          try
            set m to value of attribute "AXMinimized" of w
          end try
          if m then
            return wn & "|minimized"
          else
            return wn & "|visible"
          end if
        end if
      end try
    end repeat
  end tell
end tell
return ""
EOF
    then
      break
    fi
  done
  sleep 0.15
  # 3) Raise + place right again after restore.
  osascript >/dev/null 2>&1 <<EOF || true
tell application "Simulator" to activate
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    set frontmost to true
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "${safe}" then
          try
            set value of attribute "AXMinimized" of w to false
          end try
          try
            perform action "AXRaise" of w
          end try
        end if
      end try
    end repeat
  end tell
end tell
EOF
  ios_sim_place_window_named "$want" right
}

# Minimize auto-attached agent windows, but keep user-pinned / restored ones open.
ios_sim_park_agent_windows() {
  local line name state base
  if ios_sim_want_window; then
    return 0
  fi
  if ! pgrep -x Simulator >/dev/null 2>&1; then
    return 0
  fi
  # Do not re-minimize while screenshot/alert OCR is unparking IOSurface —
  # that race left verify stuck on "unparking agent window…" forever.
  if ios_sim_ios_capture_in_progress; then
    return 0
  fi
  ios_sim_import_headed_env
  # osascript `log` goes to stderr; collect states from there.
  while IFS= read -r line; do
    [[ "$line" == onTrack\ Agent*\|* ]] || continue
    name="${line%%|*}"
    state="${line##*|}"
    base="$(ios_sim_agent_base_name "$name")"
    if ios_sim_agent_is_headed "$base"; then
      continue
    fi
    if [[ "$state" == "minimized" ]]; then
      ios_sim_mark_minimized_agent "$base"
      continue
    fi
    # Visible: if we previously minimized it, the user restored it — pin headed
    # and place right (restore often keeps an off-screen park position).
    if ios_sim_was_minimized_agent "$base"; then
      ios_sim_mark_agent_headed "$base"
      ios_sim_unminimize_agent_window_named "$base"
      continue
    fi
    ios_sim_minimize_agent_window_named "$base"
    ios_sim_mark_minimized_agent "$base"
  done < <(ios_sim_list_agent_window_states)
}

# Explicitly open an agent simulator window and pin it headed (survives the reaper).
# Usage: ios_sim_open_agent_headed [slot|name]
ios_sim_open_agent_headed() {
  local arg="${1:-}" name udid
  if [[ -z "$arg" ]]; then
    arg="${AGENT_UI_SLOT:-}"
  fi
  if [[ "$arg" =~ ^[0-9]+$ ]]; then
    name="onTrack Agent ${arg}"
  elif [[ "$arg" == onTrack\ Agent* ]]; then
    name="$(ios_sim_agent_base_name "$arg")"
  elif [[ -n "${ONTRACK_IOS_SIMULATOR:-}" && "${ONTRACK_IOS_SIMULATOR}" == onTrack\ Agent* ]]; then
    name="$(ios_sim_agent_base_name "$ONTRACK_IOS_SIMULATOR")"
  else
    echo "usage: ios_sim_open_agent_headed <slot|onTrack Agent N>" >&2
    return 1
  fi
  ios_sim_mark_agent_headed "$name"
  # Drop auto-minimize memory so an explicit open is never treated as "fresh attach".
  local minfile
  minfile="$(ios_sim_minimized_agents_file)"
  if [[ -f "$minfile" ]]; then
    grep -vxF "$name" "$minfile" >"${minfile}.tmp" 2>/dev/null || true
    mv "${minfile}.tmp" "$minfile" 2>/dev/null || true
  fi
  ONTRACK_IOS_SIMULATOR="$name"
  unset ONTRACK_IOS_SIMULATOR_UDID
  if ! udid="$(ios_sim_resolve_udid)"; then
    echo "error: no simulator named '${name}'" >&2
    return 1
  fi
  if ! xcrun simctl list devices booted 2>/dev/null | grep -q "$udid"; then
    echo "Booting ${name} (${udid})"
    xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  fi
  defaults write com.apple.iphonesimulator CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
  if ! pgrep -x Simulator >/dev/null 2>&1; then
    open -a Simulator --args -CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
  fi
  local deadline=$((SECONDS + 20))
  while (( SECONDS < deadline )); do
    if xcrun simctl list devices booted 2>/dev/null | grep -q "$udid"; then
      break
    fi
    sleep 0.25
  done
  sleep 0.6
  ios_sim_unminimize_agent_window_named "$name"
  echo "Opened ${name} headed (pinned, right)"
}

# True while any agent sim is Booted or any pool slot lock exists.
ios_sim_agent_gui_reaper_needed() {
  if xcrun simctl list devices booted 2>/dev/null | grep -q 'onTrack Agent'; then
    return 0
  fi
  local root
  root="$(ios_sim_agent_pool_dir)"
  compgen -G "${root}"'/*.lockdir' >/dev/null 2>&1
}

# Reaper: minimize fresh agent windows; leave user-pinned / restored agents alone.
ios_sim_start_agent_gui_reaper() {
  local pidfile pid helper
  if ios_sim_want_window; then
    return 0
  fi
  pidfile="$(ios_sim_agent_gui_reaper_pidfile)"
  if [[ -f "$pidfile" ]]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  helper="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-simulator.sh"
  (
    echo $$ >"$pidfile"
    # shellcheck disable=SC1090
    source "$helper"
    local i
    for i in $(seq 1 40); do
      ios_sim_park_agent_windows
      ios_sim_agent_gui_reaper_needed || break
      sleep 0.25
    done
    while ios_sim_agent_gui_reaper_needed; do
      ios_sim_park_agent_windows
      sleep 0.75
    done
    rm -f "$pidfile" 2>/dev/null || true
  ) >/dev/null 2>&1 &
  disown $! 2>/dev/null || true
}

# Headless agent GUI policy: minimize auto-attached agent windows; never quit Simulator.
ios_sim_enforce_agent_headless_gui() {
  if ios_sim_want_window; then
    # Opt-in headed preferred device — if it's an agent slot, pin it.
    local name
    name="$(ios_sim_preferred_name)"
    if [[ "$name" == onTrack\ Agent* ]]; then
      ios_sim_mark_agent_headed "$name"
    fi
    return 0
  fi
  ios_sim_park_agent_windows
  ios_sim_start_agent_gui_reaper
}

# After Simulator.app opens it may briefly re-boot peers from saved windows.
ios_sim_prune_peers_briefly() {
  local keep_udid="$1"
  local settle=$((SECONDS + 3))
  while (( SECONDS < settle )); do
    ios_sim_shutdown_others "$keep_udid"
    sleep 0.35
  done
  ios_sim_shutdown_others "$keep_udid"
}

# Pre-approve custom URL schemes so `simctl openurl` skips the iOS
# "Open in \"onTrack\"?" confirmation (same LaunchServices store Expo CLI uses).
# On iOS 26+, LaunchServices reads this plist at boot — call before `simctl boot`
# whenever possible.
#
# Prints `unchanged` or `wrote` on stdout. Exit 0 on success, 1 on error.
#
# Usage: ios_sim_approve_url_schemes [udid]
# Env: BUNDLE_ID (default com.imtihoss.ontracknow)
#      ONTRACK_IOS_URL_SCHEMES="ontrack exp+ontrack" (space-separated)
ios_sim_approve_url_schemes() {
  local udid="${1:-}"
  local bundle="${BUNDLE_ID:-com.imtihoss.ontracknow}"
  local schemes="${ONTRACK_IOS_URL_SCHEMES:-ontrack exp+ontrack}"
  if [[ -z "$udid" ]]; then
    udid="$(ios_sim_resolve_udid 2>/dev/null || true)"
  fi
  if [[ -z "$udid" ]]; then
    echo "error: ios_sim_approve_url_schemes: no simulator UDID" >&2
    return 1
  fi

  BUNDLE_ID="$bundle" ONTRACK_IOS_URL_SCHEMES="$schemes" python3 - "$udid" <<'PY'
import os
import plistlib
import sys
from pathlib import Path

udid = sys.argv[1]
bundle = os.environ.get("BUNDLE_ID") or "com.imtihoss.ontracknow"
schemes = [
    s.strip()
    for s in (os.environ.get("ONTRACK_IOS_URL_SCHEMES") or "ontrack exp+ontrack").split()
    if s.strip()
]
plist_path = (
    Path.home()
    / "Library/Developer/CoreSimulator/Devices"
    / udid
    / "data/Library/Preferences/com.apple.launchservices.schemeapproval.plist"
)
plist_path.parent.mkdir(parents=True, exist_ok=True)
data: dict = {}
if plist_path.is_file():
    try:
        with plist_path.open("rb") as fh:
            loaded = plistlib.load(fh)
        if isinstance(loaded, dict):
            data = loaded
    except Exception:
        data = {}

changed = False
for scheme in schemes:
    key = f"com.apple.CoreSimulator.CoreSimulatorBridge-->{scheme}"
    if data.get(key) != bundle:
        data[key] = bundle
        changed = True

if not changed:
    print("unchanged")
    raise SystemExit(0)

with plist_path.open("wb") as fh:
    plistlib.dump(data, fh, fmt=plistlib.FMT_BINARY)
print(
    "scheme-approval: wrote "
    + ", ".join(schemes)
    + f" → {bundle} ({udid[:8]}…)",
    file=sys.stderr,
)
print("wrote")
PY
}

# Boot the preferred simulator (default: onTrack iPhone 17 Pro) via simctl — headless.
# Does not open Simulator.app unless ONTRACK_IOS_SIMULATOR_WINDOW=1.
# Shutdown other booted devices so `simctl … booted` is unambiguous.
ensure_preferred_ios_simulator() {
  local name udid already opened=0 approval_status=""
  name="$(ios_sim_preferred_name)"

  if ! udid="$(ios_sim_resolve_udid)"; then
    echo "error: no available simulator named '${name}' (set ONTRACK_IOS_SIMULATOR or ONTRACK_IOS_SIMULATOR_UDID)" >&2
    return 1
  fi

  ios_sim_shutdown_others "$udid"

  # Approve schemes before first boot so LaunchServices trusts openurl immediately.
  already="$(ios_sim_preferred_booted_udid || true)"
  approval_status="$(ios_sim_approve_url_schemes "$udid" || true)"

  # If the sim was already up and we just wrote approvals, reboot once so iOS 26
  # reloads LaunchServices. Skip when unchanged (common warm path).
  if [[ -n "$already" && "$approval_status" == "wrote" ]]; then
    echo "Rebooting simulator so URL scheme approval takes effect…"
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
    already=""
  fi

  if [[ -z "$already" ]]; then
    echo "Booting preferred simulator (headless): ${name} (${udid})"
    xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  fi

  # Headless agent boots: start parking immediately so attach windows don't linger.
  if ! ios_sim_want_window && [[ "$name" == onTrack\ Agent* ]]; then
    ios_sim_enforce_agent_headless_gui
  fi

  if ios_sim_want_window; then
    if ! pgrep -x Simulator >/dev/null 2>&1; then
      opened=1
    fi
    echo "Opening Simulator.app window (ONTRACK_IOS_SIMULATOR_WINDOW=1)"
    ios_sim_open_focused "$udid"
  fi

  local launch_started
  launch_started="$(device_launch_timer_start)"
  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    if ! ios_sim_want_window && [[ "$name" == onTrack\ Agent* ]]; then
      ios_sim_park_agent_windows
    fi
    if xcrun simctl list devices booted 2>/dev/null | grep -q "$udid"; then
      device_launch_timer_report "$launch_started" "iOS boot ${name}" \
        "wedged CoreSimulator / orphan simctl io / cold clone"
      ios_sim_shutdown_others "$udid"
      if [[ "$opened" == "1" ]]; then
        ios_sim_prune_peers_briefly "$udid"
      else
        ios_sim_shutdown_others "$udid"
      fi
      if ! ios_sim_want_window && [[ "$name" == onTrack\ Agent* ]]; then
        ios_sim_enforce_agent_headless_gui
      fi
      if ios_sim_want_window; then
        ios_sim_place_window_named "$name" right 2>/dev/null || true
      fi
      echo "Simulator ready: ${name}$(ios_sim_want_window && echo '' || echo ' (headless)')"
      return 0
    fi
    sleep 0.5
  done
  device_launch_timer_report "$launch_started" "iOS boot ${name} (TIMED OUT)" \
    "wedged CoreSimulator / orphan simctl io"
  echo "error: timed out booting ${name} (${udid})" >&2
  return 1
}
