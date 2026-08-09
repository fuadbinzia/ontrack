#!/usr/bin/env python3
"""Detect and dismiss blocking iOS Simulator system sheets (Apple Account, etc.).

Uses Vision OCR on a simctl screenshot, then clicks the dismiss control
(preferring "Not Now") by mapping the label's bounding-box center into the
Simulator.app window.

Exit codes:
  0 — clear (or skipped)
  1 — still blocking after dismiss attempts
  2 — tool / screenshot / OCR failure
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

CACHE_CLEAR_SECS = 90

# Set when ensure_simulator_app() launches Simulator.app for click mapping.
# Cleared by restore_headless_gui() — only quits if *we* opened it; never kills
# a Simulator.app the user already had open.
_opened_simulator_for_dismiss = False

# Prefer soft dismiss over Settings / Done (account sheets).
# Location permission is handled separately (must Allow, not Don't Allow).
DISMISS_PRIORITY = (
    "not now",
    "cancel",
    "close",
    "later",
    "don't allow",
    "dont allow",
)

# Real Apple Account *system* sheets (not Profile "Sign in … Apple Account" copy).
APPLE_ACCOUNT_PHRASES = (
    "apple account verification",
    "enter the password",
    "verification failed",
    "update apple id",
    "sign in to apple",
)

# "Open in \"onTrack\"?" — Cancel would abort the launch; prefer Open.
ACCEPT_PRIORITY = (
    "open",
)

# Location permission — agents need While Using (weather / travel departure).
LOCATION_ACCEPT_PRIORITY = (
    "allow while using app",
    "allow while using the app",
    "always allow",
    "allow once",
    "allow",
)

# Expo development-client intro sheet ("This is the developer menu…").
DEV_MENU_ACCEPT_PRIORITY = (
    "continue",
)

OPEN_IN_PHRASES = (
    "open in",
)

LOCATION_PHRASES = (
    "use your location",
    "your location?",
    "location services",
)

# First-run Expo intro — has a Continue button. Header also shows "Runtime version".
DEV_MENU_INTRO_PHRASES = (
    "this is the developer menu",
    "useful tools in development",
    "development builds",
    "dev tools",
)

# Full Expo Dev Menu tools sheet — Escape closes it (no Continue).
# Do NOT include "runtime version" here: intro chrome shows that too.
DEV_MENU_TOOLS_PHRASES = (
    "toggle performance monitor",
    "toggle element inspector",
    "fast refresh",
    "open devtools",
    "source code explorer",
)

DEV_MENU_PHRASES = (
    "developer menu",
    "runtime version",
    *DEV_MENU_INTRO_PHRASES,
    *DEV_MENU_TOOLS_PHRASES,
)


def repo_root() -> Path:
    env = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2]


def cache_path() -> Path:
    root = repo_root() / ".cursor"
    root.mkdir(parents=True, exist_ok=True)
    return root / "ios-system-alert-clear.stamp"


def ocr_bin() -> Path:
    return repo_root() / ".cursor" / "ios_ocr_alert"


def ensure_ocr_bin() -> Path:
    src = Path(__file__).resolve().parent / "ios_ocr_alert.swift"
    out = ocr_bin()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.is_file() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    print("agent-ui: compiling iOS system-alert OCR helper…", file=sys.stderr)
    proc = subprocess.run(
        ["xcrun", "--sdk", "macosx", "swiftc", "-O", str(src), "-o", str(out)],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0 or not out.is_file():
        detail = (proc.stderr or proc.stdout or "").strip()
        raise SystemExit(f"error: failed to compile ios_ocr_alert: {detail or proc.returncode}")
    return out


def recently_clear() -> bool:
    path = cache_path()
    if not path.is_file():
        return False
    age = time.time() - path.stat().st_mtime
    return 0 <= age < CACHE_CLEAR_SECS


def mark_clear() -> None:
    cache_path().write_text(str(int(time.time())), encoding="utf-8")


def _ios_sim_target() -> str:
    return (os.environ.get("ONTRACK_IOS_SIMULATOR_UDID") or "").strip() or "booted"


def take_screenshot(path: Path) -> None:
    # Shared retry/unpark path — parked agent windows lose IOSurface otherwise.
    # Fail before spawn when the lease device is Shutdown (simctl hangs forever).
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import agent_ui_color as color  # type: ignore

    target = _ios_sim_target()
    if not color._ios_device_is_booted(target):  # noqa: SLF001 — shared preflight
        raise SystemExit(
            f"error: iOS screenshot failed: device not Booted "
            f"({target[:8] if target != 'booted' else target})"
        )
    try:
        color.capture_screenshot(path)
    except SystemExit as exc:
        detail = str(exc)
        raise SystemExit(
            detail.replace("error: screenshot failed:", "error: iOS screenshot failed:", 1)
        ) from exc


def _redact_emails(text: str) -> str:
    # Keep probe logs free of personal inboxes (OCR often captures Apple Account copy).
    import re

    return re.sub(r"[\w.+-]+@[\w.-]+\.\w+", "[redacted-email]", text)


def ocr_screenshot(path: Path) -> dict:
    binary = ensure_ocr_bin()
    proc = subprocess.run(
        [str(binary), str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise SystemExit(f"error: iOS OCR failed: {detail or proc.returncode}")
    try:
        result = json.loads(proc.stdout.strip() or "{}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"error: iOS OCR returned invalid JSON: {exc}") from exc
    if isinstance(result.get("text"), str):
        result["text"] = _redact_emails(result["text"])
    return result


def simulator_running() -> bool:
    return (
        subprocess.run(
            ["pgrep", "-x", "Simulator"],
            check=False,
            capture_output=True,
        ).returncode
        == 0
    )


def _want_simulator_window() -> bool:
    return (os.environ.get("ONTRACK_IOS_SIMULATOR_WINDOW") or "0").strip() in (
        "1",
        "true",
        "TRUE",
        "yes",
        "YES",
    )


def _preferred_sim_name() -> str:
    return (os.environ.get("ONTRACK_IOS_SIMULATOR") or "").strip()


def _preferred_boot_udid() -> str:
    pinned = (os.environ.get("ONTRACK_IOS_SIMULATOR_UDID") or "").strip()
    if pinned:
        return pinned
    try:
        raw = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "booted", "-j"],
            check=False,
            capture_output=True,
            text=True,
        ).stdout
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return ""
    prefer = _preferred_sim_name().lower()
    fallback = ""
    for devices in data.get("devices", {}).values():
        for device in devices:
            if device.get("state") != "Booted":
                continue
            udid = str(device.get("udid") or "")
            name = str(device.get("name") or "")
            if not udid:
                continue
            if prefer and name.lower() == prefer:
                return udid
            if not fallback:
                fallback = udid
    return fallback


def ensure_simulator_app() -> None:
    global _opened_simulator_for_dismiss
    if simulator_running():
        _raise_target_simulator_window()
        return
    print("agent-ui: opening Simulator.app to dismiss system sheet…", file=sys.stderr)
    boot_udid = _preferred_boot_udid()
    _opened_simulator_for_dismiss = True
    if boot_udid:
        subprocess.run(
            ["open", "-a", "Simulator", "--args", f"-CurrentDeviceUDID={boot_udid}"],
            check=False,
            capture_output=True,
        )
    else:
        subprocess.run(["open", "-a", "Simulator"], check=False, capture_output=True)
    deadline = time.time() + 10
    while time.time() < deadline:
        if simulator_running():
            time.sleep(0.8)
            _raise_target_simulator_window()
            return
        time.sleep(0.25)


def _raise_target_simulator_window() -> None:
    """Raise the preferred device window for click mapping (headed dismiss only)."""
    name = _preferred_sim_name()
    if not name:
        return
    # AppleScript string literal — device names are ASCII pool labels.
    safe = name.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    set frontmost to true
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "{safe}" then
          try
            perform action "AXRaise" of w
          end try
          return
        end if
      end try
    end repeat
  end tell
end tell
'''
    try:
        subprocess.run(
            ["osascript", "-e", script],
            check=False,
            capture_output=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        pass


def restore_headless_gui() -> None:
    """Restore coexistence: keep user's Simulator; park agent windows off-screen.

    Only quits Simulator.app when this process opened it solely for sheet dismiss.
    """
    global _opened_simulator_for_dismiss
    opened_by_us = _opened_simulator_for_dismiss
    _opened_simulator_for_dismiss = False
    if _want_simulator_window():
        return
    if opened_by_us:
        print(
            "agent-ui: quitting Simulator.app (opened only for sheet dismiss)",
            file=sys.stderr,
        )
        try:
            subprocess.run(
                ["osascript", "-e", 'tell application "Simulator" to quit'],
                check=False,
                capture_output=True,
                timeout=8,
            )
        except subprocess.TimeoutExpired:
            pass
        return
    # User's Simulator stays up — park agent pool windows so they stay "background".
    sim_sh = repo_root() / "scripts" / "lib" / "ios-simulator.sh"
    if not sim_sh.is_file():
        return
    try:
        subprocess.run(
            [
                "bash",
                "-c",
                f'source "{sim_sh}" && ios_sim_enforce_agent_headless_gui',
            ],
            check=False,
            capture_output=True,
            timeout=15,
            env={**os.environ, "ONTRACK_IOS_SIMULATOR_WINDOW": "0"},
        )
    except subprocess.TimeoutExpired:
        pass


def _phrases_or_text_match(result: dict, needles: tuple[str, ...]) -> bool:
    phrases = [str(p).lower() for p in (result.get("phrases") or [])]
    text = str(result.get("text") or "").lower()
    if any(any(needle in p for needle in needles) for p in phrases):
        return True
    return any(needle in text for needle in needles)


def _is_open_in_prompt(result: dict) -> bool:
    return _phrases_or_text_match(result, OPEN_IN_PHRASES)


def _is_location_prompt(result: dict) -> bool:
    return _phrases_or_text_match(result, LOCATION_PHRASES)


def _is_apple_account_prompt(result: dict) -> bool:
    return _phrases_or_text_match(result, APPLE_ACCOUNT_PHRASES)


def _is_dev_menu_prompt(result: dict) -> bool:
    return _phrases_or_text_match(result, DEV_MENU_PHRASES)


def _is_dev_menu_intro(result: dict) -> bool:
    return _phrases_or_text_match(result, DEV_MENU_INTRO_PHRASES)


def _is_dev_menu_tools(result: dict) -> bool:
    # Intro chrome also says "Runtime version" / "developer menu" — never Escape that.
    if _is_dev_menu_intro(result):
        return False
    return _phrases_or_text_match(result, DEV_MENU_TOOLS_PHRASES)


def _pick_soft_dismiss_target(targets: list) -> dict | None:
    ranked: list[tuple[int, dict]] = []
    for target in targets:
        if not isinstance(target, dict):
            continue
        label = str(target.get("label") or "").strip().lower()
        action = str(target.get("action") or "").strip().lower()
        if action == "accept":
            continue
        try:
            rank = next(i for i, needle in enumerate(DISMISS_PRIORITY) if needle in label)
        except StopIteration:
            continue
        ranked.append((rank, target))
    if not ranked:
        return None
    ranked.sort(key=lambda item: item[0])
    return ranked[0][1]


def _priority_matches_label(label: str, needle: str) -> bool:
    # Short affirmatives must be exact — avoid "Continue with Apple", title "Allow …".
    if needle in ("open", "allow", "continue"):
        return label == needle
    return needle == label or needle in label


def _pick_accept_target(targets: list, priority: tuple[str, ...]) -> dict | None:
    ranked: list[tuple[int, dict]] = []
    for target in targets:
        if not isinstance(target, dict):
            continue
        label = str(target.get("label") or "").strip().lower()
        action = str(target.get("action") or "").strip().lower()
        matched = any(_priority_matches_label(label, needle) for needle in priority)
        if action != "accept" and not matched:
            continue
        if not matched and action == "accept":
            # Accept-tagged but not in this sheet's priority — skip (e.g. stray Allow).
            continue
        try:
            rank = next(
                i
                for i, needle in enumerate(priority)
                if _priority_matches_label(label, needle)
            )
        except StopIteration:
            continue
        ranked.append((rank, target))
    if not ranked:
        return None
    ranked.sort(key=lambda item: item[0])
    return ranked[0][1]


def pick_dismiss_target(result: dict) -> dict | None:
    targets = result.get("targets") or []
    if not isinstance(targets, list):
        return None

    # Deep-link confirmation: click Open (never Cancel / Escape).
    if _is_open_in_prompt(result):
        accepted = _pick_accept_target(targets, ACCEPT_PRIORITY)
        if accepted is not None:
            return accepted

    # Location permission: Allow While Using App (never Don't Allow / Escape-deny).
    if _is_location_prompt(result):
        accepted = _pick_accept_target(targets, LOCATION_ACCEPT_PRIORITY)
        if accepted is not None:
            return accepted

    # Apple Account system sheet often stacks over Expo intro — Not Now first.
    if _is_apple_account_prompt(result):
        soft = _pick_soft_dismiss_target(targets)
        if soft is not None:
            return soft

    # Expo developer-menu intro: Continue (Escape also ok as fallback).
    if _is_dev_menu_prompt(result):
        accepted = _pick_accept_target(targets, DEV_MENU_ACCEPT_PRIORITY)
        if accepted is not None:
            return accepted

    soft = _pick_soft_dismiss_target(targets)
    if soft is not None and _is_location_prompt(result):
        label = str(soft.get("label") or "").strip().lower()
        if "don't allow" in label or "dont allow" in label:
            return None
    return soft


def simulator_window_frame() -> tuple[float, float, float, float] | None:
    """Return (x, y, width, height) of the preferred Simulator window in screen points."""
    name = _preferred_sim_name()
    safe = name.replace("\\", "\\\\").replace('"', '\\"') if name else ""
    if safe:
        script = f'''
tell application "System Events"
  if not (exists process "Simulator") then return ""
  tell process "Simulator"
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "{safe}" then
          set p to position of w
          set s to size of w
          return ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)
        end if
      end try
    end repeat
    try
      set w to front window
      set p to position of w
      set s to size of w
      return ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)
    on error
      return ""
    end try
  end tell
end tell
'''
    else:
        script = """
tell application "System Events"
  if not (exists process "Simulator") then return ""
  tell process "Simulator"
    try
      set w to front window
      set p to position of w
      set s to size of w
      return ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)
    on error
      return ""
    end try
  end tell
end tell
"""
    try:
        proc = subprocess.run(
            ["osascript", "-e", script],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        return None
    raw = (proc.stdout or "").strip()
    if not raw or proc.returncode != 0:
        return None
    parts = raw.split(",")
    if len(parts) != 4:
        return None
    try:
        return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
    except ValueError:
        return None


def click_screen_point(x: float, y: float) -> bool:
    """Click a global screen point via System Events (points, not pixels)."""
    script = f"""
tell application "Simulator" to activate
delay 0.15
tell application "System Events"
  click at {{{int(round(x))}, {int(round(y))}}}
end tell
return "ok"
"""
    try:
        proc = subprocess.run(
            ["osascript", "-e", script],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        return False
    return proc.returncode == 0 and "ok" in (proc.stdout or "")


def click_dismiss_target(target: dict) -> bool:
    """Map normalized screenshot coords (top-left origin) into Simulator window and click."""
    try:
        nx = float(target["x"])
        ny = float(target["y"])
    except (KeyError, TypeError, ValueError):
        return False
    frame = simulator_window_frame()
    if frame is None:
        return False
    win_x, win_y, win_w, win_h = frame
    # Approximate chrome: title/toolbar ~28pt top, thin side/home bezels.
    # Keep math simple — Apple Account sheets sit near vertical center.
    inset_top = 28.0
    inset_side = 12.0
    inset_bottom = 18.0
    content_w = max(1.0, win_w - 2 * inset_side)
    content_h = max(1.0, win_h - inset_top - inset_bottom)
    click_x = win_x + inset_side + nx * content_w
    click_y = win_y + inset_top + ny * content_h
    label = str(target.get("label") or "dismiss")
    print(
        f"agent-ui: clicking '{label}' at screen ({int(click_x)}, {int(click_y)})",
        file=sys.stderr,
    )
    return click_screen_point(click_x, click_y)


def send_escape() -> None:
    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                'tell application "Simulator" to activate\n'
                "delay 0.1\n"
                'tell application "System Events" to key code 53',
            ],
            check=False,
            capture_output=True,
            timeout=4,
        )
    except subprocess.TimeoutExpired:
        pass


def dismiss_blocking(result: dict) -> bool:
    """Click the right control for the sheet; Escape only for soft-dismiss sheets."""
    ensure_simulator_app()
    targets = result.get("targets") or []
    not_now = _pick_soft_dismiss_target(
        [t for t in targets if isinstance(t, dict)]
        if isinstance(targets, list)
        else []
    )
    # Apple Account / password sheets: the button is "Not Now" — never Escape.
    if _is_apple_account_prompt(result) or (
        not_now is not None
        and "not now" in str(not_now.get("label") or "").strip().lower()
    ):
        target = pick_dismiss_target(result) or not_now
        if target is not None:
            label = str(target.get("label") or "Not Now")
            clicked = click_dismiss_target(target)
            print(
                f"agent-ui: tapping '{label}' on system sheet"
                + (" — ok" if clicked else " — click missed, retry"),
                file=sys.stderr,
            )
            time.sleep(0.45)
            # Never Escape while Not Now is on screen (missed click → re-OCR).
            return clicked
        print(
            'agent-ui: Apple Account sheet present but "Not Now" not found — retry OCR',
            file=sys.stderr,
        )
        return False
    # Expo intro (Continue) before tools Escape — intro header also says Runtime version.
    if _is_dev_menu_intro(result) or (
        _is_dev_menu_prompt(result)
        and _pick_accept_target(targets if isinstance(targets, list) else [], DEV_MENU_ACCEPT_PRIORITY)
        is not None
    ):
        target = pick_dismiss_target(result)
        if target is not None and click_dismiss_target(target):
            label = str(target.get("label") or "Continue")
            print(
                f"agent-ui: dismissed Expo developer-menu intro ({label})",
                file=sys.stderr,
            )
            time.sleep(0.45)
            return True
        # Fall through — Escape / close as last resort for intro.
    # Expo Dev Menu tools sheet (Reload / Fast refresh): Escape — don't poke toggles.
    if _is_dev_menu_tools(result):
        print("agent-ui: dismissing Expo Dev Menu (Escape)", file=sys.stderr)
        send_escape()
        time.sleep(0.35)
        return True
    target = pick_dismiss_target(result)
    clicked = False
    if target is not None:
        clicked = click_dismiss_target(target)
        time.sleep(0.45)
    if not clicked and _is_open_in_prompt(result):
        # Escape cancels the deep link — never use it for "Open in …?".
        print(
            "agent-ui: Open-in sheet present but Open control not found — retry OCR",
            file=sys.stderr,
        )
        return False
    if not clicked and _is_location_prompt(result):
        # Escape can deny / leave the sheet — never use it for location.
        print(
            "agent-ui: location sheet present but Allow control not found — retry OCR",
            file=sys.stderr,
        )
        return False
    if not clicked and _is_dev_menu_intro(result):
        print(
            "agent-ui: Expo intro Continue not found — Escape as fallback",
            file=sys.stderr,
        )
        send_escape()
        time.sleep(0.35)
        return True
    if not clicked:
        print("agent-ui: sending Escape to dismiss system sheet", file=sys.stderr)
        send_escape()
        time.sleep(0.35)
    return True


def probe(*, force: bool = False) -> dict:
    if not force and recently_clear():
        return {"blocking": False, "cached": True, "phrases": [], "buttons": [], "targets": []}
    with tempfile.TemporaryDirectory(prefix="ios-sys-alert-") as tmp:
        shot = Path(tmp) / "screen.png"
        take_screenshot(shot)
        result = ocr_screenshot(shot)
    result["cached"] = False
    return result


def ensure_clear(*, force: bool = False) -> int:
    if os.environ.get("AGENT_UI_SKIP_IOS_ALERTS", "0") == "1":
        return 0
    platform = (os.environ.get("AGENT_UI_PLATFORM") or "ios").strip().lower()
    if platform == "android":
        return 0

    try:
        try:
            first = probe(force=force)
        except SystemExit as exc:
            detail = str(exc)
            surfaces = (
                "screen surfaces" in detail.lower()
                or "screenshot failed" in detail.lower()
                or "screenshot timed out" in detail.lower()
                or "heal budget" in detail.lower()
            )
            if not surfaces:
                raise
            # Soft-continue when we are not proving a headed viewer:
            # - true headless (no Simulator.app), or
            # - headless agent-pool lease (Agent N minimized while user's Pro
            #   keeps Simulator.app open). Hard-fail only for headed verify.
            want_window = _want_simulator_window()
            lease = _preferred_sim_name()
            agent_headless = (not want_window) and ("Agent" in lease)
            if not simulator_running() or agent_headless:
                why = (
                    "headless agent pool"
                    if agent_headless and simulator_running()
                    else "headless, screenshot surfaces unavailable"
                )
                print(
                    f"agent-ui: iOS alert OCR skipped ({why}) — continuing",
                    file=sys.stderr,
                )
                mark_clear()
                return 0
            print(
                "error: iOS alert OCR failed (screenshot surfaces unavailable after unpark). "
                "Cannot prove system sheets are clear — retry verify.",
                file=sys.stderr,
            )
            return 2
        if not first.get("blocking"):
            if not first.get("cached"):
                mark_clear()
            return 0

        phrases = ", ".join(first.get("phrases") or ["system alert"])
        buttons = ", ".join(first.get("buttons") or [])
        print(
            f"agent-ui: iOS system sheet detected ({phrases}"
            + (f"; buttons: {buttons}" if buttons else "")
            + ") — dismissing…",
            file=sys.stderr,
        )
        dismiss_blocking(first)

        second = probe(force=True)
        if second.get("blocking"):
            # One retry with a fresh OCR target (sheet may have shifted).
            dismiss_blocking(second)
            third = probe(force=True)
            if third.get("blocking"):
                phrases2 = ", ".join(third.get("phrases") or phrases.split(", "))
                buttons2 = [str(b) for b in (third.get("buttons") or [])]
                has_not_now = any("not now" in b.lower() for b in buttons2)
                if _is_location_prompt(third):
                    hint = 'Tap "Allow While Using App" on the location sheet'
                elif has_not_now or _is_apple_account_prompt(third):
                    hint = 'Tap "Not Now" on the Apple Account / system sheet'
                elif _is_dev_menu_tools(third):
                    hint = "Press Escape to close the Expo Dev Menu tools sheet"
                elif _is_dev_menu_intro(third) or _is_dev_menu_prompt(third):
                    hint = 'Tap "Continue" on the Expo developer-menu intro'
                else:
                    hint = (
                        'Tap "Not Now" on the simulator (or sign out of iCloud on the sim)'
                    )
                print(
                    f"error: iOS system sheet still blocking UI ({phrases2}). "
                    f"{hint}, then retry. Set AGENT_UI_SKIP_IOS_ALERTS=1 to bypass.",
                    file=sys.stderr,
                )
                return 1

        mark_clear()
        print("agent-ui: iOS system sheet cleared", file=sys.stderr)
        return 0
    finally:
        # Never leave agent pool windows visible after a headless dismiss path.
        restore_headless_gui()


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "ensure"
    force = "--force" in argv[2:]
    if cmd in ("ensure", "dismiss"):
        return ensure_clear(force=force or cmd == "dismiss")
    if cmd == "probe":
        result = probe(force=True)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 1 if result.get("blocking") else 0
    print("usage: ios_system_alert.py ensure|dismiss|probe [--force]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
