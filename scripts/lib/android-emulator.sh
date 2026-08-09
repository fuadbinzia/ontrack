#!/usr/bin/env bash
# Shared Android Emulator helpers for onTrack agents / packager scripts.
#
# Default AVD: Galaxy_S26 (API 36 Google APIs, flagship phone profile).
# There is no official Samsung skin in the Android SDK — this AVD is a
# Galaxy S26–class device (1440×3120 @ 600dpi, hw.keyboard=yes) based on
# Pixel 9 Pro XL + custom display metrics.
#
# Override with ONTRACK_ANDROID_AVD=IdeaHome_API_35 (or any `emulator -list-avds` name),
# or ONTRACK_ANDROID_SERIAL=emulator-5554 for an exact adb device.
#
# Headless by default: boots with `-no-window` (adb / installs still work).
# Set ONTRACK_ANDROID_EMULATOR_WINDOW=1 to show the emulator GUI (like
# ONTRACK_IOS_SIMULATOR_WINDOW=1 for Simulator.app).

: "${ONTRACK_ANDROID_AVD:=Galaxy_S26}"
: "${ONTRACK_ANDROID_EMULATOR_WINDOW:=0}"
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

# Repo root when sourced from scripts/; fall back to cwd.
_ONTRACK_ANDROID_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
: "${ROOT:=$(cd "${_ONTRACK_ANDROID_LIB_DIR}/../.." && pwd)}"

# Launch-budget helper (agent policy: >30s to launch is a defect to diagnose).
# shellcheck disable=SC1091
source "${_ONTRACK_ANDROID_LIB_DIR}/device-launch-budget.sh"

android_emu_sdk_bin() {
  local name="$1"
  if [[ -x "${ANDROID_HOME}/emulator/${name}" ]]; then
    printf '%s' "${ANDROID_HOME}/emulator/${name}"
    return 0
  fi
  if [[ -x "${ANDROID_HOME}/platform-tools/${name}" ]]; then
    printf '%s' "${ANDROID_HOME}/platform-tools/${name}"
    return 0
  fi
  command -v "$name" 2>/dev/null || true
}

android_emu_preferred_name() {
  printf '%s' "${ONTRACK_ANDROID_AVD}"
}

android_emu_want_window() {
  case "${ONTRACK_ANDROID_EMULATOR_WINDOW:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# Place the headed Android Emulator GUI on the left of the main display
# (iOS Simulator owns the right). Matches window title containing the AVD name
# (e.g. "Android Emulator - Galaxy_S26:5554"). Skips tiny tool chrome.
# Side override: android_emu_place_window [left|right|center] [avd_name]
android_emu_place_window() {
  local side="${1:-left}" name safe margin
  name="${2:-$(android_emu_preferred_name)}"
  [[ -n "$name" ]] || return 1
  # Headless qemu has no placeable GUI.
  android_emu_is_headless "$name" 2>/dev/null && return 0
  pgrep -x qemu-system-aarch64 >/dev/null 2>&1 \
    || pgrep -x qemu-system-x86_64 >/dev/null 2>&1 \
    || return 0
  margin="${ONTRACK_DEVICE_WINDOW_MARGIN:-24}"
  safe="$(printf '%s' "$name" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  osascript >/dev/null 2>&1 <<EOF || true
tell application "System Events"
  set procs to {"qemu-system-aarch64", "qemu-system-x86_64", "emulator"}
  repeat with procName in procs
    if not (exists process procName) then
      -- skip
    else
      tell process procName
        repeat with w in (get every window)
          try
            set wn to name of w as text
            if wn contains "${safe}" or wn contains "Android Emulator" then
              set winSize to size of w
              set winW to item 1 of winSize
              set winH to item 2 of winSize
              -- Skip thin tool/extended-controls chrome.
              if winW < 200 or winH < 200 then
                -- skip
              else
                set deskBounds to {0, 0, 1800, 1169}
                try
                  tell application "Finder" to set deskBounds to bounds of window of desktop
                end try
                set dLeft to item 1 of deskBounds
                set dTopY to item 2 of deskBounds
                set dW to (item 3 of deskBounds) - dLeft
                set dH to (item 4 of deskBounds) - dTopY
                set margin to ${margin}
                if "${side}" is "right" then
                  set newX to dLeft + dW - winW - margin
                else if "${side}" is "center" then
                  set newX to dLeft + ((dW - winW) div 2)
                else
                  set newX to dLeft + margin
                end if
                set newY to dTopY + ((dH - winH) div 2)
                if newY < 40 then set newY to 40
                if newX < dLeft then set newX to dLeft
                set maxX to dLeft + dW - winW
                if newX > maxX then set newX to maxX
                set position of w to {newX, newY}
                return
              end if
            end if
          end try
        end repeat
      end tell
    end if
  end repeat
end tell
EOF
}

android_emu_pool_mode() {
  case "${AGENT_UI_POOL_MODE:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

android_emu_is_agent_avd_name() {
  [[ "${1:-}" =~ ^onTrack_Agent_[0-9]+$ ]]
}

# Keys copied from Galaxy_S26 (or ONTRACK_ANDROID_AVD_TEMPLATE) onto agent AVDs.
# Includes GPU — avdmanager's pixel_9_pro_xl defaults hw.gpu.enabled=no.
# hw.ramSize is synced then clamped (AGENT_RAM_CAP) so a headed 8GB Galaxy
# template cannot OOM a 16GB host when warm agents stay up beside it.
android_emu_agent_template_keys() {
  printf '%s\n' \
    hw.lcd.width hw.lcd.height hw.lcd.density \
    hw.keyboard hw.keyboard.charmap hw.keyboard.lid \
    hw.ramSize \
    hw.gpu.enabled hw.gpu.mode
}

# Sync display/keyboard/RAM/GPU from template → target config.ini.
# Agent RAM capped at 4096 MB (override: ONTRACK_ANDROID_AGENT_RAM_MB).
android_emu_sync_avd_config_from_template() {
  local conf="$1" tmpl="$2"
  [[ -f "$conf" && -f "$tmpl" ]] || return 0
  ONTRACK_ANDROID_AGENT_RAM_MB="${ONTRACK_ANDROID_AGENT_RAM_MB:-4096}" \
  python3 - "$conf" "$tmpl" <<'PY'
import os, re, sys
from pathlib import Path
conf, tmpl = Path(sys.argv[1]), Path(sys.argv[2])
text = conf.read_text(encoding="utf-8")
src = tmpl.read_text(encoding="utf-8")
keys = (
    "hw.lcd.width", "hw.lcd.height", "hw.lcd.density",
    "hw.keyboard", "hw.keyboard.charmap", "hw.keyboard.lid",
    "hw.ramSize",
    "hw.gpu.enabled", "hw.gpu.mode",
)
changed = False
for key in keys:
    m = re.search(rf"(?m)^{re.escape(key)}\s*=\s*(.*)$", src)
    if not m:
        continue
    val = m.group(1).strip()
    if re.search(rf"(?m)^{re.escape(key)}\s*=", text):
        new, n = re.subn(
            rf"(?m)^{re.escape(key)}\s*=\s*.*$", f"{key}={val}", text, count=1
        )
        if n and new != text:
            text = new
            changed = True
    else:
        text = text.rstrip() + f"\n{key}={val}\n"
        changed = True
# Force GPU on even when the template is missing those keys.
if not re.search(r"(?m)^hw\.gpu\.enabled\s*=", text):
    text = text.rstrip() + "\nhw.gpu.enabled=yes\n"
    changed = True
elif re.search(r"(?m)^hw\.gpu\.enabled\s*=\s*no\s*$", text):
    text = re.sub(
        r"(?m)^hw\.gpu\.enabled\s*=\s*.*$", "hw.gpu.enabled=yes", text, count=1
    )
    changed = True
# Prefer host GPU for agent/headless speed (auto often falls back to software).
if not re.search(r"(?m)^hw\.gpu\.mode\s*=", text):
    text = text.rstrip() + "\nhw.gpu.mode=host\n"
    changed = True
elif re.search(r"(?m)^hw\.gpu\.mode\s*=\s*auto\s*$", text):
    text = re.sub(
        r"(?m)^hw\.gpu\.mode\s*=\s*.*$", "hw.gpu.mode=host", text, count=1
    )
    changed = True
# Cap agent RAM — Galaxy may be 8GB for headed SVG; agents must stay lean.
try:
    cap = int(os.environ.get("ONTRACK_ANDROID_AGENT_RAM_MB", "4096"))
except ValueError:
    cap = 4096
if cap < 1536:
    cap = 1536

def _ram_mb(raw: str):
    s = raw.strip().upper().replace(" ", "")
    try:
        if s.endswith("G"):
            return int(float(s[:-1]) * 1024)
        if s.endswith("M"):
            return int(float(s[:-1]))
        return int(float(s))
    except ValueError:
        return None

m = re.search(r"(?m)^hw\.ramSize\s*=\s*(.*)$", text)
if m:
    mb = _ram_mb(m.group(1))
    if mb is None or mb > cap:
        text = re.sub(
            r"(?m)^hw\.ramSize\s*=\s*.*$", f"hw.ramSize={cap}", text, count=1
        )
        changed = True
elif not re.search(r"(?m)^hw\.ramSize\s*=", text):
    text = text.rstrip() + f"\nhw.ramSize={cap}\n"
    changed = True
if changed:
    conf.write_text(text, encoding="utf-8")
    print(f"Synced AVD hardware from template → {conf}", file=sys.stderr)
PY
}

# Create onTrack_Agent_N AVDs (Galaxy_S26-class) when missing.
android_emu_ensure_agent_avd() {
  local name template="${ONTRACK_ANDROID_AVD_TEMPLATE:-Galaxy_S26}"
  name="$(android_emu_preferred_name)"
  if android_emu_avd_exists; then
    android_emu_ensure_avd_runtime_config
    return 0
  fi
  if ! android_emu_is_agent_avd_name "$name"; then
    echo "error: no AVD named '${name}' (create it or set ONTRACK_ANDROID_AVD)" >&2
    return 1
  fi

  local sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  local avdmanager=""
  if [[ -x "${sdk_root}/cmdline-tools/latest/bin/avdmanager" ]]; then
    avdmanager="${sdk_root}/cmdline-tools/latest/bin/avdmanager"
  else
    avdmanager="$(command -v avdmanager 2>/dev/null || true)"
  fi
  if [[ -z "$avdmanager" ]]; then
    # Fallback: clone template AVD config (fresh userdata).
    local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
    local src_ini="${home}/${template}.ini"
    local src_avd="${home}/${template}.avd"
    if [[ ! -f "$src_ini" || ! -d "$src_avd" ]]; then
      echo "error: cannot create '${name}' — missing template AVD '${template}' and avdmanager" >&2
      return 1
    fi
    echo "Creating agent AVD ${name} (clone config from ${template})…"
    mkdir -p "${home}/${name}.avd"
    # Copy config only — not userdata (large / stale).
    if [[ -f "${src_avd}/config.ini" ]]; then
      cp "${src_avd}/config.ini" "${home}/${name}.avd/config.ini"
    else
      echo "error: template ${template} has no config.ini" >&2
      return 1
    fi
    # Optional hardware skin bits.
    [[ -f "${src_avd}/hardware-qemu.ini" ]] && cp "${src_avd}/hardware-qemu.ini" "${home}/${name}.avd/" || true
    python3 - "$home" "$name" "$template" <<'PY'
import pathlib, sys
home, name, template = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
ini = home / f"{name}.ini"
ini.write_text(
    f"avd.ini.encoding=UTF-8\n"
    f"path={home / (name + '.avd')}\n"
    f"path.rel=avd/{name}.avd\n"
    f"target=android-36\n",
    encoding="utf-8",
)
conf = home / f"{name}.avd" / "config.ini"
text = conf.read_text(encoding="utf-8")
for old, new in (
    (f"AvdId={template}", f"AvdId={name}"),
    (f"avd.name={template}", f"avd.name={name}"),
    ("avd.id=<build>", f"avd.id={name}"),
    ("avd.name=<build>", f"avd.name={name}"),
):
    text = text.replace(old, new)
conf.write_text(text, encoding="utf-8")
print(f"Cloned AVD config {template} → {name}", file=sys.stderr)
PY
    android_emu_ensure_avd_runtime_config
    return 0
  fi

  local pkg="system-images;android-36;google_apis;arm64-v8a"
  echo "Creating agent AVD ${name} (pixel_9_pro_xl / ${pkg})…"
  # non-interactive: no custom hardware profile prompt
  printf 'no\n' | "$avdmanager" create avd -n "$name" -k "$pkg" -d pixel_9_pro_xl --force >/dev/null 2>&1 || {
    echo "error: avdmanager failed to create '${name}'" >&2
    return 1
  }
  # Match Galaxy_S26 display + GPU when template config is available.
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local conf="${home}/${name}.avd/config.ini"
  local tmpl="${home}/${template}.avd/config.ini"
  android_emu_sync_avd_config_from_template "$conf" "$tmpl"
  android_emu_ensure_avd_runtime_config
  return 0
}

# True when the named AVD (default: preferred) is running headed (GUI window).
# Headed Galaxy must not be pool-killed — that shows "Saving state…" and looks
# like the emulator "turns off on its own" while another chat runs verify-both.
android_emu_avd_is_headed() {
  local name="${1:-$(android_emu_preferred_name)}"
  [[ -n "$name" ]] || return 1
  # Headless binary ⇒ not headed.
  if pgrep -lf "qemu-system-.*-headless.*-avd[[:space:]]+${name}|${name}.*-no-window|-no-window.*${name}" >/dev/null 2>&1; then
    return 1
  fi
  # Windowed qemu (non-headless binary, no -no-window).
  if pgrep -lf "qemu-system-aarch64[[:space:]].*-avd[[:space:]]+${name}" >/dev/null 2>&1; then
    return 0
  fi
  if pgrep -lf "emulator.*-avd[[:space:]]+${name}" 2>/dev/null | grep -vq -- '-no-window'; then
    return 0
  fi
  return 1
}

# True when the preferred AVD is running with `-no-window` / headless qemu.
android_emu_is_headless() {
  local name
  name="$(android_emu_preferred_name)"
  android_emu_avd_is_headed "$name" && return 1
  # Match either the headless qemu binary or an emulator cmdline with -no-window.
  if pgrep -lf "qemu-system-.*-headless.*${name}|${name}.*-no-window|-no-window.*${name}" >/dev/null 2>&1; then
    return 0
  fi
  # Fallback: any qemu for this AVD whose argv includes -no-window.
  if pgrep -lf "qemu-system.*-avd[[:space:]]+${name}" 2>/dev/null | grep -q -- '-no-window'; then
    return 0
  fi
  # No process → treat as not-headless for restart logic (cold boot path).
  return 1
}

# Sticky protect for user-headed Galaxy (written by ensure:window).
android_emu_headed_keep_file() {
  printf '%s/.cursor/android-headed.keep' "${ROOT:-.}"
}

android_emu_mark_headed_keep() {
  local f
  f="$(android_emu_headed_keep_file)"
  mkdir -p "$(dirname "$f")" 2>/dev/null || true
  printf '%s\n' "$(android_emu_preferred_name)" >"$f"
}

android_emu_clear_headed_keep() {
  rm -f "$(android_emu_headed_keep_file)" 2>/dev/null || true
}

# Print the name of a live headed (GUI) Galaxy / preferred AVD, else fail.
# Used so pool verify-both never issues emu kill → "Saving state…" on the
# user's window while Agent_* work is happening in another chat.
android_emu_live_headed_galaxy_name() {
  local keep preferred candidate
  keep="$(android_emu_headed_keep_name 2>/dev/null || true)"
  preferred="$(android_emu_preferred_name 2>/dev/null || true)"
  for candidate in "$keep" "$preferred" "Galaxy_S26"; do
    [[ -n "$candidate" ]] || continue
    if android_emu_avd_is_headed "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

android_emu_want_keep_headed() {
  case "${ONTRACK_ANDROID_KEEP_HEADED:-}" in
    1|true|TRUE|yes|YES) return 0 ;;
  esac
  # Agent device policy: a leased agent stays on its own onTrack_Agent_N AVD.
  # A live headed Galaxy no longer wins the agent's device (and is never killed
  # either — see android_emu_shutdown_others). Explicit KEEP_HEADED=1 above is
  # the only way an agent shell targets the user's window.
  if android_emu_pool_mode || [[ -n "${AGENT_UI_SLOT:-}" ]]; then
    return 1
  fi
  case "${ONTRACK_ANDROID_KEEP_HEADED:-}" in
    0|false|FALSE|no|NO)
      # Pool verify-both sets KEEP=0 to ignore *stale* sticky keep files — but a
      # live headed GUI must still win (never "Saving state…" the user window).
      if android_emu_live_headed_galaxy_name >/dev/null 2>&1; then
        return 0
      fi
      return 1
      ;;
  esac
  # Sticky file from android:ensure:window — only while the GUI AVD is actually
  # headed. Stale keeps (Galaxy closed / pool killed it) used to force every
  # handoff to "adopt" then skip with 16GB / not-cold-booting noise.
  local keep
  keep="$(android_emu_headed_keep_name 2>/dev/null || true)"
  [[ -n "$keep" ]] || return 1
  if android_emu_avd_is_headed "$keep"; then
    return 0
  fi
  echo "android-emu: clearing stale headed keep (${keep} not running headed)" >&2
  android_emu_clear_headed_keep
  return 1
}

# AVD name from sticky headed keep (usually Galaxy_S26). Empty if none.
android_emu_headed_keep_name() {
  local f name
  f="$(android_emu_headed_keep_file)"
  [[ -f "$f" ]] || return 1
  name="$(head -1 "$f" 2>/dev/null | tr -d '\r\n' || true)"
  [[ -n "$name" ]] || return 1
  printf '%s' "$name"
}

# True when named AVD is on adb with sys.boot_completed=1.
android_emu_avd_is_ready_named() {
  local name="${1:-}" serial boot adb_bin
  [[ -n "$name" ]] || return 1
  serial="$(
    ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
  )"
  [[ -n "$serial" ]] || return 1
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  "$adb_bin" -s "$serial" get-state >/dev/null 2>&1 || return 1
  boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [[ "$boot" == "1" ]]
}

# First boot_completed onTrack_Agent_* on adb (optional exclude name).
android_emu_first_warm_agent_name() {
  local exclude="${1:-}" adb_bin serial avd boot
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  while IFS= read -r serial; do
    [[ -z "$serial" ]] && continue
    avd="$("$adb_bin" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | head -1 || true)"
    avd="$(printf '%s\n' "$avd" | awk 'NF && $0!="OK"{print; exit}')"
    android_emu_is_agent_avd_name "$avd" || continue
    [[ -n "$exclude" && "$avd" == "$exclude" ]] && continue
    boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    [[ "$boot" == "1" ]] || continue
    printf '%s' "$avd"
    return 0
  done < <("$adb_bin" devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device/{print $1}')
  return 1
}

# Headed Galaxy (≈8GB) + any agent (≈4GB) thrash a 16GB host (minutes of
# swap, bridge timeouts, "AVD going down"). When sticky keep / --window is
# active, Android work MUST use the headed AVD — never an agent beside it.
# No-op when keep is stale (Galaxy not headed) — want_keep_headed GCs the file.
android_emu_adopt_android_for_headed_host() {
  local name keep
  # Agent device policy: pool/leased agents never adopt the user's GUI AVD.
  # Adoption is for user-invoked headed runs only (ensure-android-emulator.sh
  # --window / android:ensure:window).
  if android_emu_pool_mode || [[ -n "${AGENT_UI_SLOT:-}" ]]; then
    return 0
  fi
  android_emu_want_keep_headed || android_emu_want_window || return 0
  keep="$(android_emu_headed_keep_name 2>/dev/null || true)"
  [[ -n "$keep" ]] || keep="Galaxy_S26"
  name="$(android_emu_preferred_name)"
  [[ "$name" == "$keep" ]] && return 0
  # --window will cold-boot; sticky keep only adopts a live headed GUI.
  if ! android_emu_want_window && ! android_emu_avd_is_headed "$keep"; then
    return 0
  fi
  echo "android-emu: adopting headed ${keep} (was ${name} — 16GB host cannot run agent beside GUI)" >&2
  export ONTRACK_ANDROID_AVD="$keep"
  unset ONTRACK_ANDROID_SERIAL ANDROID_SERIAL
  return 0
}

# Soft keyboard visible even with hw.keyboard=yes (needed for keyboard layout hunts).
android_emu_ensure_soft_ime() {
  local serial="${1:-${ONTRACK_ANDROID_SERIAL:-}}"
  local adb_bin
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" && -n "$serial" ]] || return 0
  "$adb_bin" -s "$serial" shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null 2>&1 || true
}

android_emu_adb() {
  local adb_bin
  adb_bin="$(android_emu_sdk_bin adb)"
  if [[ -z "$adb_bin" ]]; then
    echo "error: adb not found (install Android SDK platform-tools)" >&2
    return 1
  fi
  if [[ -n "${ONTRACK_ANDROID_SERIAL:-}" ]]; then
    "$adb_bin" -s "${ONTRACK_ANDROID_SERIAL}" "$@"
  else
    "$adb_bin" "$@"
  fi
}

# Print adb serial of a running emulator for the preferred AVD, else empty.
android_emu_preferred_serial() {
  local name want avd adb_bin serial
  name="$(android_emu_preferred_name)"
  want="${ONTRACK_ANDROID_SERIAL:-}"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 0

  if [[ -n "$want" ]]; then
    if "$adb_bin" -s "$want" get-state >/dev/null 2>&1; then
      printf '%s' "$want"
    fi
    return 0
  fi

  while IFS= read -r serial; do
    [[ -z "$serial" || "$serial" == "List"* ]] && continue
    avd="$("$adb_bin" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | head -1 || true)"
    # Some images print "OK" on a second line — take first non-OK token.
    avd="$(printf '%s\n' "$avd" | awk 'NF && $0!="OK"{print; exit}')"
    if [[ "$avd" == "$name" ]]; then
      printf '%s' "$serial"
      return 0
    fi
  done < <("$adb_bin" devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device/{print $1}')
}

# Shut down a specific AVD by name (pool agent cleanup). Leaves other AVDs alone.
# Fast kill (no 20s snapshot save) — mid-save kills corrupt default_boot and wedge
# the next agent verify for minutes.
android_emu_shutdown_named() {
  local name="${1:-}" serial adb_bin
  [[ -n "$name" ]] || return 0
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 0
  serial="$(
    ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
  )"
  if [[ -z "$serial" ]]; then
    android_emu_clear_stale_locks "$name"
    return 0
  fi
  echo "Shutting down agent emulator: ${name} (${serial})" >&2
  ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0 \
    "$adb_bin" -s "$serial" emu kill >/dev/null 2>&1 || true
  # Brief wait so qemu releases multiinstance.lock before the next boot.
  local deadline=$((SECONDS + 15))
  while (( SECONDS < deadline )); do
    serial="$(
      ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
    )"
    [[ -z "$serial" ]] && break
    sleep 1
  done
  android_emu_clear_stale_locks "$name"
}

android_emu_avd_exists() {
  local name emu_bin
  name="$(android_emu_preferred_name)"
  emu_bin="$(android_emu_sdk_bin emulator)"
  [[ -n "$emu_bin" ]] || return 1
  "$emu_bin" -list-avds 2>/dev/null | grep -qx "$name"
}

# True when config.ini points at an installed system image.
# Fresh avdmanager AVDs are config-only until first boot — that is OK.
android_emu_avd_is_complete() {
  local name="${1:-$(android_emu_preferred_name)}"
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  local conf="${home}/${name}.avd/config.ini"
  local sysdir
  [[ -f "$conf" ]] || return 1
  sysdir="$(
    awk -F= '/^image\.sysdir\.1[[:space:]]*=/{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2; exit}' "$conf"
  )"
  [[ -n "$sysdir" ]] || return 1
  [[ -d "${sdk_root}/${sysdir}" || -d "${sdk_root}/${sysdir%/}" ]]
}

# Path to the preferred AVD config.ini (empty if missing).
android_emu_avd_config_ini() {
  local name="$1"
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local conf="${home}/${name}.avd/config.ini"
  if [[ -f "$conf" ]]; then
    printf '%s' "$conf"
    return 0
  fi
  return 1
}

# Ensure hw.keyboard=yes so host typing / adb input reaches EditTexts.
# Safe to call before every boot; no-op when already set.
android_emu_ensure_hw_keyboard() {
  local name conf
  name="$(android_emu_preferred_name)"
  conf="$(android_emu_avd_config_ini "$name" || true)"
  if [[ -z "$conf" || ! -f "$conf" ]]; then
    echo "note: AVD config.ini not found for ${name} — skip hw.keyboard patch" >&2
    return 0
  fi
  if grep -qE '^hw\.keyboard[[:space:]]*=[[:space:]]*yes' "$conf"; then
    return 0
  fi
  if grep -qE '^hw\.keyboard[[:space:]]*=' "$conf"; then
    # macOS sed -i requires backup suffix; write via temp for portability.
    python3 - "$conf" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
new, n = re.subn(r"(?m)^hw\.keyboard\s*=\s*.*$", "hw.keyboard = yes", text, count=1)
if n:
    path.write_text(new, encoding="utf-8")
    print(f"Patched hw.keyboard=yes in {path}", file=sys.stderr)
else:
    path.write_text(text.rstrip() + "\nhw.keyboard = yes\n", encoding="utf-8")
    print(f"Appended hw.keyboard=yes to {path}", file=sys.stderr)
PY
  else
    printf '\nhw.keyboard = yes\n' >>"$conf"
    echo "Appended hw.keyboard=yes to ${conf}" >&2
  fi
}

# Heal keyboard + GPU (and agent template parity) before every boot.
# Existing onTrack_Agent_* AVDs were created with hw.gpu.enabled=no.
android_emu_ensure_avd_runtime_config() {
  local name template="${ONTRACK_ANDROID_AVD_TEMPLATE:-Galaxy_S26}"
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local conf tmpl
  name="$(android_emu_preferred_name)"
  conf="$(android_emu_avd_config_ini "$name" || true)"
  [[ -n "$conf" && -f "$conf" ]] || return 0
  android_emu_ensure_hw_keyboard
  if android_emu_is_agent_avd_name "$name"; then
    tmpl="${home}/${template}.avd/config.ini"
    android_emu_sync_avd_config_from_template "$conf" "$tmpl"
  else
    # Non-agent: still force GPU on when explicitly disabled.
    if grep -qE '^hw\.gpu\.enabled[[:space:]]*=[[:space:]]*no' "$conf"; then
      python3 - "$conf" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = re.sub(r"(?m)^hw\.gpu\.enabled\s*=\s*.*$", "hw.gpu.enabled=yes", text, count=1)
path.write_text(text, encoding="utf-8")
print(f"Patched hw.gpu.enabled=yes in {path}", file=sys.stderr)
PY
    fi
  fi
}

# Drop leftover qemu locks when the AVD is not running (blocks next boot).
android_emu_clear_stale_locks() {
  local name="${1:-$(android_emu_preferred_name)}"
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local avd_dir="${home}/${name}.avd"
  [[ -d "$avd_dir" ]] || return 0
  # Still on adb → locks are live.
  if [[ -n "$(
    ONTRACK_ANDROID_AVD="$name" ONTRACK_ANDROID_SERIAL= android_emu_preferred_serial || true
  )" ]]; then
    return 0
  fi
  # qemu process still holding the AVD → leave locks alone.
  if pgrep -lf "qemu-system.*-avd[[:space:]]+${name}|emulator.*-avd[[:space:]]+${name}" >/dev/null 2>&1; then
    return 0
  fi
  local lock removed=0
  for lock in \
    "${avd_dir}/hardware-qemu.ini.lock" \
    "${avd_dir}/multiinstance.lock" \
    "${avd_dir}/snapshot.lock.lock"; do
    if [[ -e "$lock" ]]; then
      rm -f "$lock" 2>/dev/null || true
      removed=1
    fi
  done
  (( removed )) && echo "Cleared stale emulator locks for ${name}" >&2
  return 0
}

# Remove default_boot after a wedged snapshot load so the next attempt is cold.
android_emu_discard_default_snapshot() {
  local name="${1:-$(android_emu_preferred_name)}"
  local home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local snap="${home}/${name}.avd/snapshots/default_boot"
  [[ -d "$snap" ]] || return 0
  echo "Discarding wedged snapshot default_boot for ${name}" >&2
  rm -rf "$snap" 2>/dev/null || true
}

# After a successful cold agent boot, explicitly save default_boot so the next
# launch can use the fast snapshot path. Normal agent launches still pass
# -no-snapshot-save so lease/kill never corrupts a mid-write snapshot.
# Escape: ONTRACK_ANDROID_SNAPSHOT_REGEN=0.
android_emu_regenerate_default_snapshot() {
  local serial="${1:-}" name="${2:-$(android_emu_preferred_name)}" adb_bin
  case "${ONTRACK_ANDROID_SNAPSHOT_REGEN:-1}" in
    0|false|FALSE|no|NO) return 0 ;;
  esac
  android_emu_is_agent_avd_name "$name" || return 0
  [[ -n "$serial" ]] || serial="$(android_emu_preferred_serial || true)"
  [[ -n "$serial" ]] || return 1
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  # Still on adb + boot_completed — never save while shutting down.
  local boot
  boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [[ "$boot" == "1" ]] || return 1
  echo "Saving default_boot snapshot for ${name} (post-cold heal)…" >&2
  # Console snapshot save (not qemu exit-save). Fail soft — boot already succeeded.
  if ! "$adb_bin" -s "$serial" emu avd snapshot save default_boot >/dev/null 2>&1; then
    echo "warn: snapshot save failed for ${name} (next boot may stay cold)" >&2
    return 1
  fi
  return 0
}

# Set clipboard text on the preferred emulator (Custom Tabs / WebViews may still
# need a long-press Paste — Chrome often ignores automated paste).
android_emu_set_clipboard() {
  local text="${1:-}"
  if [[ -z "$text" ]]; then
    echo "usage: android_emu_set_clipboard <text>" >&2
    return 2
  fi
  # cmd clipboard is API 29+; fall back to service call is flaky — prefer cmd.
  android_emu_adb shell cmd clipboard set --text "$text" >/dev/null 2>&1 \
    || android_emu_adb shell "am broadcast -a clipper.set -e text $(printf '%q' "$text")" >/dev/null 2>&1 \
    || {
      echo "error: could not set clipboard (try long-press Paste in the WebView)" >&2
      return 1
    }
}

# Shut down peer emulators so adb + the android agent-ui bridge stay unambiguous.
# - Pool mode (no live headed GUI): kill non-agent AVDs (headless Galaxy/IdeaHome)
#   so their JS bridge cannot spoof route probes; leave other onTrack_Agent_* up.
# - Live headed Galaxy / sticky keep / --window: NEVER run agents beside the 8GB
#   GUI on 16GB hosts — kill every onTrack_Agent_* and adopt Galaxy for Android
#   work (see android_emu_adopt_android_for_headed_host). Never kill a live
#   headed GUI (looks like "Saving state…" / random off) — not even when pool
#   sets ONTRACK_ANDROID_KEEP_HEADED=0.
android_emu_shutdown_others() {
  local keep_serial="${1:-}" adb_bin serial avd
  local kill_agents=0 preferred keep_headed=0 headed_name=""
  local -a killed_agent_serials=()
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 0
  preferred="$(android_emu_preferred_name)"
  if android_emu_want_keep_headed; then
    keep_headed=1
  fi
  headed_name="$(android_emu_headed_keep_name 2>/dev/null || true)"
  [[ -n "$headed_name" ]] || headed_name="Galaxy_S26"
  # 16GB host: headed Galaxy GUI cannot share RAM/GPU with any agent AVD.
  if android_emu_want_window || (( keep_headed )); then
    kill_agents=1
  fi
  while IFS= read -r serial; do
    [[ -z "$serial" || "$serial" == "$keep_serial" ]] && continue
    avd="$("$adb_bin" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | head -1 || true)"
    avd="$(printf '%s\n' "$avd" | awk 'NF && $0!="OK"{print; exit}')"
    if android_emu_is_agent_avd_name "$avd"; then
      if (( kill_agents )); then
        echo "Shutting down agent emulator (headed ${headed_name} keep needs RAM/GPU): ${serial} (${avd})" >&2
        ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0 \
          "$adb_bin" -s "$serial" emu kill >/dev/null 2>&1 || true
        killed_agent_serials+=("$serial")
      else
        # Other pool slots must stay up for parallel agents.
        echo "Leaving agent emulator up: ${serial} (${avd})" >&2
      fi
      continue
    fi
    if [[ -z "$avd" ]]; then
      # `emu avd name` flaps during boot — never guess-kill in pool mode
      # (was murdering onTrack_Agent_2 as "unknown" mid verify-both).
      if android_emu_pool_mode; then
        echo "Leaving unidentified emulator up (pool): ${serial}" >&2
        continue
      fi
    fi
    # Never kill a live headed GUI — that shows "Saving state…" and looks like
    # the emulator "turns off on its own" while another chat runs verify-both.
    # Pool KEEP_HEADED=0 may free *headless* Galaxy leftovers for Agent_*, but
    # a visible window always wins (adopt Galaxy + kill agents instead).
    if android_emu_avd_is_headed "$avd"; then
      echo "Leaving headed emulator up (live GUI): ${serial} (${avd})" >&2
      continue
    fi
    if (( keep_headed )) && [[ "$avd" == "Galaxy_S26" || "$avd" == "$headed_name" ]]; then
      echo "Leaving headed emulator up (user window): ${serial} (${avd})" >&2
      continue
    fi
    if android_emu_pool_mode; then
      echo "Shutting down non-agent emulator (pool): ${serial} (${avd})" >&2
    else
      echo "Shutting down other emulator: ${serial}"
    fi
    ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0 \
      "$adb_bin" -s "$serial" emu kill >/dev/null 2>&1 || true
  done < <("$adb_bin" devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device/{print $1}')

  # Wait for killed agents to drop off adb before any sibling boot reuses the
  # console port (5554/5556 race → "went offline before boot_completed").
  if ((${#killed_agent_serials[@]} > 0)); then
    local deadline=$((SECONDS + 15)) still s
    while (( SECONDS < deadline )); do
      still=0
      for s in "${killed_agent_serials[@]}"; do
        if "$adb_bin" -s "$s" get-state >/dev/null 2>&1; then
          still=1
          break
        fi
      done
      (( still == 0 )) && break
      sleep 1
    done
  fi
}

# Wait for sys.boot_completed. SECONDS_BUDGET overrides the default (120).
# Fail-fast when the serial disappears / goes offline (killed mid-wait).
android_emu_wait_boot() {
  local serial="$1"
  local budget="${2:-120}"
  local deadline=$((SECONDS + budget)) adb_bin boot state offline_hits=0
  local launch_started
  launch_started="$(device_launch_timer_start)"
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" && -n "$serial" ]] || return 1
  "$adb_bin" -s "$serial" wait-for-device >/dev/null 2>&1 || true
  while (( SECONDS < deadline )); do
    state="$("$adb_bin" -s "$serial" get-state 2>/dev/null | tr -d '\r')"
    if [[ "$state" != "device" ]]; then
      offline_hits=$((offline_hits + 1))
      # Brief grace for adb flaps right after attach.
      if (( offline_hits >= 3 )); then
        echo "warn: emulator ${serial} went offline before boot_completed" >&2
        return 1
      fi
      sleep 1
      continue
    fi
    offline_hits=0
    boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$boot" == "1" ]]; then
      device_launch_timer_report "$launch_started" "Android boot_completed ${serial}" \
        "cold boot after peer emu kill / stale snapshot"
      # Soft keyboard still available when a hardware keyboard is attached.
      "$adb_bin" -s "$serial" shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null 2>&1 || true
      return 0
    fi
    sleep 1
  done
  device_launch_timer_report "$launch_started" "Android boot_completed ${serial} (TIMED OUT)" \
    "cold boot after peer emu kill / stale snapshot"
  return 1
}

# True when the preferred AVD is on adb AND finished booting (sys.boot_completed=1).
# `adb get-state=device` alone is not enough — mid-boot guests look "device" while
# pm/shell/app launch still fail and agent-ui returns route=?.
android_emu_is_ready() {
  local serial boot adb_bin
  serial="$(android_emu_preferred_serial || true)"
  [[ -n "$serial" ]] || return 1
  adb_bin="$(android_emu_sdk_bin adb)"
  [[ -n "$adb_bin" ]] || return 1
  "$adb_bin" -s "$serial" get-state >/dev/null 2>&1 || return 1
  boot="$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [[ "$boot" == "1" ]]
}

# Pin serial + adb reverse when already ready; otherwise boot the preferred AVD
# and wait for sys.boot_completed (via ensure_preferred_android_emulator).
android_emu_ensure_ready() {
  local serial
  # Headed Galaxy keep: adopt warm agent / Galaxy before cold-booting a sibling.
  android_emu_adopt_android_for_headed_host || true
  if android_emu_is_ready; then
    serial="$(android_emu_preferred_serial || true)"
    export ANDROID_SERIAL="$serial"
    export ONTRACK_ANDROID_SERIAL="$serial"
    android_emu_ensure_adb_reverse >/dev/null 2>&1 || true
    return 0
  fi
  ensure_preferred_android_emulator || return 1
  android_emu_is_ready
}

# Forward emulator loopback → host so advertise-127 Metro / agent-ui work.
# Emulator 127.0.0.1 is the guest, not the Mac — without reverse, DevLauncher
# fails with a host URL error and the agent-ui bridge times out.
# Idempotent. Sets ANDROID_EMU_REVERSE_ADDED=1 when a new mapping was created.
android_emu_ensure_adb_reverse() {
  local metro_port="${METRO_PORT:-8081}"
  local daemon_port="${AGENT_UI_HTTP_PORT:-8191}"
  local list port host_port added=0

  ANDROID_EMU_REVERSE_ADDED=0

  if ! android_emu_adb get-state >/dev/null 2>&1; then
    echo "note: adb device not ready — skip reverse" >&2
    return 1
  fi

  # Guest 8191 → host 8191+slot (H17).
  local daemon_host_port="$daemon_port"
  if [[ -n "${AGENT_UI_SLOT:-}" && "${AGENT_UI_SLOT}" =~ ^[1-9][0-9]*$ ]]; then
    daemon_host_port=$((daemon_port + AGENT_UI_SLOT))
  fi

  list="$(android_emu_adb reverse --list 2>/dev/null || true)"
  for port in "$metro_port" "$daemon_port"; do
    host_port="$port"
    [[ "$port" == "$daemon_port" ]] && host_port="$daemon_host_port"
    if printf '%s\n' "$list" | grep -qE "tcp:${port}[[:space:]]+tcp:${host_port}\$"; then
      continue
    fi
    if printf '%s\n' "$list" | grep -qE "tcp:${port}[[:space:]]+tcp:"; then
      android_emu_adb reverse --remove "tcp:${port}" >/dev/null 2>&1 || true
    fi
    if android_emu_adb reverse "tcp:${port}" "tcp:${host_port}" >/dev/null 2>&1; then
      echo "adb reverse tcp:${port} → host:${host_port}"
      added=1
    else
      echo "error: adb reverse tcp:${port} → host:${host_port} failed" >&2
      return 1
    fi
  done

  if [[ "$added" == "1" ]]; then
    ANDROID_EMU_REVERSE_ADDED=1
  else
    echo "adb reverse ok (Metro ${metro_port}, agent-ui ${daemon_host_port})"
  fi
  return 0
}

android_emu_app_package() {
  printf '%s' "${BUNDLE_ID:-com.imtihoss.ontracknow}"
}

# True when the app on *this* serial holds a socket to the agent-ui daemon.
# A live PID is not enough (dead JS runtime). Unknown `ss` → treat as connected.
android_emu_app_bridge_connected() {
  local daemon_port="${AGENT_UI_HTTP_PORT:-8191}" out
  out="$(android_emu_adb shell "ss -tn 2>/dev/null | grep -c ':${daemon_port}'" 2>/dev/null | tr -d '\r' | head -1)"
  if [[ -z "$out" || ! "$out" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  (( out > 0 ))
}

# Process up + no daemon socket → force-stop so the next VIEW is a launch intent.
# Returns 0 when a stop ran, 1 when healthy / not running.
android_emu_force_stop_if_wedged() {
  local pkg
  pkg="$(android_emu_app_package)"
  android_emu_adb shell pidof "$pkg" >/dev/null 2>&1 || return 1
  android_emu_app_bridge_connected && return 1
  echo "Wedged Android app (not polling agent-ui) — force-stopping before relaunch"
  android_emu_adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
  sleep 1
  return 0
}

# Reverse + wedge heal before a Metro VIEW. Caller opens the URL (and optional monkey).
# Pass "loud" to keep reverse diagnostics (ensure-packager); default is quiet.
android_emu_prepare_metro_dev_client() {
  if [[ "${1:-}" == "loud" ]]; then
    android_emu_ensure_adb_reverse || return 1
  else
    android_emu_ensure_adb_reverse >/dev/null 2>&1 || return 1
  fi
  android_emu_force_stop_if_wedged || true
  return 0
}

# Headed handoff only (or ONTRACK_ANDROID_ENSURE_APP_SURFACE=1).
# Escape: ONTRACK_ANDROID_SKIP_APP_SURFACE=1.
android_emu_want_app_surface() {
  case "${ONTRACK_ANDROID_SKIP_APP_SURFACE:-0}" in
    1|true|TRUE|yes|YES) return 1 ;;
  esac
  case "${ONTRACK_ANDROID_ENSURE_APP_SURFACE:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
  esac
  android_emu_want_window
}

android_emu_app_installed() {
  local pkg
  pkg="$(android_emu_app_package)"
  android_emu_adb shell pm path "$pkg" 2>/dev/null | grep -q "package:"
}

android_emu_relaunch_app() {
  local pkg
  pkg="$(android_emu_app_package)"
  android_emu_adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
  sleep 1
  android_emu_adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
    >/dev/null 2>&1 \
    || android_emu_adb shell am start -a android.intent.action.MAIN \
      -c android.intent.category.LAUNCHER -n "${pkg}/.MainActivity" \
      >/dev/null 2>&1 \
    || true
}

# Print near-white pixel % from a live screencap (requires Pillow).
android_emu_screen_near_white_pct() {
  local helper="${_ONTRACK_ANDROID_LIB_DIR}/android_emu_surface.py"
  [[ -f "$helper" ]] || return 1
  android_emu_adb exec-out screencap -p 2>/dev/null \
    | python3 "$helper" pct 2>/dev/null
}

# Headed handoff: ensure onTrack is launched and the SurfaceView is painted.
# Arg 1: force_relaunch=1 after headless→window / cold window restart.
# Blank white while Metro/JS look fine is a known post-restart failure mode.
android_emu_ensure_app_surface() {
  local force_relaunch="${1:-0}"
  local pkg threshold wait_budget pct healed=0 deadline

  android_emu_want_app_surface || return 0
  if ! android_emu_app_installed; then
    return 0
  fi

  pkg="$(android_emu_app_package)"
  threshold="${ONTRACK_ANDROID_BLANK_WHITE_PCT:-85}"
  wait_budget="${ONTRACK_ANDROID_SURFACE_WAIT_SECS:-25}"

  if [[ "$force_relaunch" == "1" ]]; then
    echo "Relaunching ${pkg} after emulator window restart (blank SurfaceView heal)…"
    android_emu_relaunch_app
  elif ! android_emu_adb shell pidof -s "$pkg" >/dev/null 2>&1; then
    echo "Launching ${pkg} for headed handoff…"
    android_emu_adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
      >/dev/null 2>&1 || true
  fi

  deadline=$((SECONDS + wait_budget))
  pct=""
  while (( SECONDS < deadline )); do
    pct="$(android_emu_screen_near_white_pct || true)"
    if [[ -z "$pct" ]]; then
      sleep 2
      continue
    fi
    if awk -v p="$pct" -v t="$threshold" 'BEGIN { exit !(p + 0 < t + 0) }'; then
      echo "App surface painted (${pct}% near-white < ${threshold}%)"
      return 0
    fi
    if (( healed == 0 )); then
      echo "warn: blank/white SurfaceView (${pct}% near-white) — relaunching ${pkg}…" >&2
      android_emu_relaunch_app
      healed=1
      sleep 4
      continue
    fi
    sleep 2
  done

  echo "error: ${pkg} surface still blank/white after heal (${pct:-?}% near-white ≥ ${threshold}%)" >&2
  return 1
}

# Pin serial, reverse ports, soft IME, headed app-surface heal, then announce ready.
# $1=serial $2=avd_name $3=want_window(0|1) $4=window_restarted(0|1) $5=did_cold(0|1)
android_emu_mark_ready() {
  local serial="$1" name="$2" want_window="${3:-0}" window_restarted="${4:-0}" did_cold="${5:-0}"
  [[ -n "$serial" ]] || return 1
  export ANDROID_SERIAL="$serial"
  export ONTRACK_ANDROID_SERIAL="$serial"
  android_emu_ensure_adb_reverse || true
  if (( want_window )); then
    android_emu_ensure_soft_ime "$serial"
    # Headless→window (and blank SurfaceView) must not hand off a white screen.
    if ! android_emu_ensure_app_surface "$window_restarted"; then
      return 1
    fi
  fi
  if (( did_cold )); then
    android_emu_regenerate_default_snapshot "$serial" "$name" || true
  fi
  if (( want_window )); then
    android_emu_mark_headed_keep
    # GUI may take a beat after SurfaceView heal — place left beside iOS.
    android_emu_place_window left "$name" 2>/dev/null || true
    (
      sleep 0.8
      android_emu_place_window left "$name" 2>/dev/null || true
    ) &
  fi
  echo "Emulator ready: ${name} (${serial})$((( want_window )) && echo '' || echo ' (headless)')"
  return 0
}

# Boot the preferred AVD (default: Galaxy_S26). Headless unless WINDOW=1.
# Shutdown other emulators so `adb` / installs target one device.
ensure_preferred_android_emulator() {
  local name serial emu_bin adb_bin log args=()
  local window_restarted=0
  name="$(android_emu_preferred_name)"
  emu_bin="$(android_emu_sdk_bin emulator)"
  adb_bin="$(android_emu_sdk_bin adb)"

  if [[ -z "$emu_bin" || -z "$adb_bin" ]]; then
    echo "error: Android SDK emulator/adb not found under ANDROID_HOME=${ANDROID_HOME}" >&2
    return 1
  fi
  if ! android_emu_avd_exists; then
    if android_emu_pool_mode || android_emu_is_agent_avd_name "$name"; then
      android_emu_ensure_agent_avd || return 1
    else
      echo "error: no AVD named '${name}' (create it or set ONTRACK_ANDROID_AVD)" >&2
      echo "hint: emulator -list-avds" >&2
      return 1
    fi
  fi
  if ! android_emu_avd_is_complete "$name"; then
    echo "error: AVD '${name}' is missing its system image (image.sysdir.1)" >&2
    echo "hint: sdkmanager \"system-images;android-36;google_apis;arm64-v8a\"" >&2
    return 1
  fi

  # Before shutdown/boot: if headed Galaxy is sticky and this agent isn't up,
  # remount to a warm agent (or Galaxy) instead of cold-booting beside the GUI.
  android_emu_adopt_android_for_headed_host || true
  name="$(android_emu_preferred_name)"

  android_emu_ensure_avd_runtime_config
  android_emu_clear_stale_locks "$name"

  serial="$(android_emu_preferred_serial || true)"
  android_emu_shutdown_others "${serial:-}"

  local want_window=0
  if android_emu_want_window; then
    want_window=1
  fi
  # Agent pool boots: never write a snapshot on exit (lease kill used to corrupt
  # default_boot mid-save). Still load an existing healthy snapshot when present.
  local agent_no_snapshot_save=0
  if android_emu_is_agent_avd_name "$name"; then
    agent_no_snapshot_save=1
  fi

  # `--window` must restart a headless instance — reusing it leaves no GUI.
  # App often comes back on a blank SurfaceView after this path — heal below.
  if [[ -n "$serial" ]] && (( want_window )) && android_emu_is_headless; then
    echo "Restarting ${name} with window (was headless)…"
    window_restarted=1
    ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0 \
      "$adb_bin" -s "$serial" emu kill >/dev/null 2>&1 || true
    local kill_deadline=$((SECONDS + 30))
    while (( SECONDS < kill_deadline )); do
      serial="$(android_emu_preferred_serial || true)"
      [[ -z "$serial" ]] && break
      sleep 1
    done
    serial=""
    android_emu_clear_stale_locks "$name"
  fi

  if [[ -n "$serial" ]]; then
    if android_emu_wait_boot "$serial" 120; then
      android_emu_mark_ready "$serial" "$name" "$want_window" "$window_restarted" || return 1
      return 0
    fi
  fi

  log="${ROOT:-.}/.cursor/android-emulator.log"
  mkdir -p "$(dirname "$log")" 2>/dev/null || true

  # Launch helper — optional -no-snapshot-load after a wedged snapshot boot.
  android_emu_detach_launch() {
    local no_snap="${1:-0}" mode="headless"
    (( want_window )) && mode="window"
    if (( no_snap )); then
      echo "Booting preferred emulator (${mode}, no snapshot): ${name}"
    else
      echo "Booting preferred emulator (${mode}): ${name}"
    fi
    # Detach into a new session so Cursor aborting an agent shell does not
    # SIGTERM the emulator. Plain `nohup … &` stays in the agent process group
    # and dies with the terminal (same failure mode as Metro before start_new_session).
    local emu_agent=0
    android_emu_is_agent_avd_name "$name" && emu_agent=1
    EMU_BIN="$emu_bin" EMU_LOG="$log" EMU_AVD="$name" EMU_WINDOW="$want_window" \
      EMU_AGENT="$emu_agent" \
      EMU_NO_SNAPSHOT="$no_snap" EMU_NO_SNAPSHOT_SAVE="$agent_no_snapshot_save" \
      HOME="$HOME" USER="${USER:-}" TMPDIR="${TMPDIR:-/tmp}" ANDROID_HOME="${ANDROID_HOME}" \
      PATH="$PATH" \
      python3 - <<'PY'
import os, subprocess, sys

emu = os.environ["EMU_BIN"]
log_path = os.environ["EMU_LOG"]
avd = os.environ["EMU_AVD"]
window = os.environ.get("EMU_WINDOW", "0") == "1"
agent = os.environ.get("EMU_AGENT", "0") == "1"
no_snap = os.environ.get("EMU_NO_SNAPSHOT", "0") == "1"
no_save = os.environ.get("EMU_NO_SNAPSHOT_SAVE", "0") == "1"
args = [emu, "-avd", avd, "-netdelay", "none", "-netspeed", "full"]
if no_snap:
    args += ["-no-snapshot-load"]
if no_save:
    args += ["-no-snapshot-save"]
if not window:
    args += ["-no-window", "-no-audio", "-no-boot-anim"]
elif agent:
    # Agent devices stay silent even if something asks for a window.
    args += ["-no-audio", "-no-boot-anim"]
env = {
    "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
    "HOME": os.environ.get("HOME", ""),
    "USER": os.environ.get("USER", ""),
    "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
    "ANDROID_HOME": os.environ.get("ANDROID_HOME", ""),
    "ANDROID_SDK_ROOT": os.environ.get("ANDROID_HOME", ""),
    "LANG": os.environ.get("LANG", "en_US.UTF-8"),
    # Fast kill if something still issues emu kill during boot.
    "ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL": "0",
}
with open(log_path, "ab", buffering=0) as logf:
    subprocess.Popen(
        args,
        stdin=subprocess.DEVNULL,
        stdout=logf,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env=env,
    )
print("Emulator detached (new session); logs →", log_path, file=sys.stderr)
PY
  }

  android_emu_wait_for_serial() {
    # Agent clones often need longer than the first qemu attach.
    local deadline=$((SECONDS + 90)) attach_started
    attach_started="$(device_launch_timer_start)"
    serial=""
    while (( SECONDS < deadline )); do
      serial="$(android_emu_preferred_serial || true)"
      if [[ -n "$serial" ]]; then
        device_launch_timer_report "$attach_started" "Android adb attach ${name}" \
          "qemu slow start / console port race after emu kill"
        return 0
      fi
      sleep 1
    done
    device_launch_timer_report "$attach_started" "Android adb attach ${name} (TIMED OUT)" \
      "qemu failed to start / orphaned lock in the AVD directory"
    return 1
  }

  local attempt no_snap=0 boot_budget=40
  for attempt in 1 2; do
    (( attempt == 2 )) && no_snap=1
    # Snapshot boots either come up fast or hang — fail over quickly.
    # Cold boots (attempt 2) need a longer boot_completed wait.
    if (( no_snap )); then
      boot_budget=180
      # Cold boot after wedged snapshot often leaves a blank React surface when headed.
      (( want_window )) && window_restarted=1
    else
      boot_budget=40
    fi
    android_emu_clear_stale_locks "$name"
    android_emu_detach_launch "$no_snap"
    if ! android_emu_wait_for_serial; then
      echo "error: timed out waiting for AVD ${name} on adb (log: ${log})" >&2
      (( attempt == 1 )) || return 1
      android_emu_discard_default_snapshot "$name"
      android_emu_clear_stale_locks "$name"
      continue
    fi

    android_emu_shutdown_others "$serial"
    if android_emu_wait_boot "$serial" "$boot_budget"; then
      # Attempt 2 is always cold (-no-snapshot-load); heal default_boot after.
      android_emu_mark_ready "$serial" "$name" "$want_window" "$window_restarted" "$no_snap" \
        || return 1
      return 0
    fi

    echo "warn: ${name} (${serial}) stuck before boot_completed — retrying without snapshot" >&2
    ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0 \
      "$adb_bin" -s "$serial" emu kill >/dev/null 2>&1 || true
    local kill_deadline=$((SECONDS + 20))
    while (( SECONDS < kill_deadline )); do
      serial="$(android_emu_preferred_serial || true)"
      [[ -z "$serial" ]] && break
      sleep 1
    done
    serial=""
    android_emu_discard_default_snapshot "$name"
    android_emu_clear_stale_locks "$name"
    (( attempt == 1 )) || break
  done

  echo "error: timed out booting ${name} (log: ${log})" >&2
  return 1
}
