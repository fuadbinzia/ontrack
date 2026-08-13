#!/usr/bin/env python3
"""Detect and dismiss blocking Android Expo Dev Menu sheets via uiautomator.

Expo-dev-menu defaults to showsAtLaunch=true + unfinished onboarding on Android,
so cold starts often cover the app with the intro ("Continue") or tools sheet.
iOS already clears these via Vision OCR; this is the Android counterpart.

Exit codes:
  0 — clear (or skipped)
  1 — still blocking after dismiss attempts
  2 — tool / dump failure
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path

CACHE_CLEAR_SECS = 90
BUNDLE_ID = os.environ.get("BUNDLE_ID") or "com.imtihoss.ontracknow"
DEV_MENU_PREFS = "expo.modules.devmenu.sharedpreferences"

DEV_MENU_INTRO_PHRASES = (
    "this is the developer menu",
    "useful tools in development",
    "development builds",
)

DEV_MENU_TOOLS_PHRASES = (
    "toggle performance monitor",
    "toggle element inspector",
    "open devtools",
    "fast refresh",
    "open react native dev menu",
)

PERMISSION_CONTROLLER_PACKAGES = (
    "com.google.android.permissioncontroller",
    "com.android.permissioncontroller",
)

PERMISSION_ALLOW_LABELS = (
    "While using the app",
    "Allow while using the app",
    "Allow",
)

DEV_LAUNCHER_PHRASES = (
    "development build",
    "development servers",
    "new development server",
)


def repo_root() -> Path:
    env = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2]


def cache_path() -> Path:
    root = repo_root() / ".cursor"
    root.mkdir(parents=True, exist_ok=True)
    return root / "android-system-alert-clear.stamp"


def adb_bin() -> str:
    return os.environ.get("ADB") or "adb"


def adb_serial() -> str | None:
    return (
        os.environ.get("ONTRACK_ANDROID_SERIAL")
        or os.environ.get("ANDROID_SERIAL")
        or None
    )


def adb(*args: str, check: bool = False, timeout: float = 20) -> subprocess.CompletedProcess[str]:
    cmd = [adb_bin()]
    serial = adb_serial()
    if serial:
        cmd.extend(["-s", serial])
    cmd.extend(args)
    return subprocess.run(
        cmd,
        check=check,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _cache_fresh() -> bool:
    path = cache_path()
    if not path.exists():
        return False
    try:
        age = time.time() - path.stat().st_mtime
    except OSError:
        return False
    return age < CACHE_CLEAR_SECS


def _touch_cache() -> None:
    path = cache_path()
    path.write_text(str(int(time.time())), encoding="utf-8")


def suppress_dev_menu_prefs() -> bool:
    """Persist showsAtLaunch=false + onboarding finished so cold starts stay clear."""
    xml = (
        "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n"
        "<map>\n"
        '    <boolean name="isOnboardingFinished" value="true" />\n'
        '    <boolean name="showsAtLaunch" value="false" />\n'
        '    <boolean name="showFab" value="false" />\n'
        "</map>\n"
    )
    try:
        probe = adb("shell", "run-as", BUNDLE_ID, "true", timeout=10)
        if probe.returncode != 0:
            return False
        # `adb shell … sh -c "…"` mangles quoting; pipe XML through run-as tee instead.
        cmd = [adb_bin()]
        serial = adb_serial()
        if serial:
            cmd.extend(["-s", serial])
        cmd.extend(
            [
                "shell",
                "run-as",
                BUNDLE_ID,
                "tee",
                f"shared_prefs/{DEV_MENU_PREFS}.xml",
            ]
        )
        result = subprocess.run(
            cmd,
            input=xml,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            print(
                f"agent-ui: Android Dev Menu prefs suppress failed: "
                f"{(result.stderr or result.stdout or '').strip()}",
                file=sys.stderr,
            )
            return False
        body = result.stdout or ""
        ok = (
            'name="showFab" value="false"' in body
            and 'name="showsAtLaunch" value="false"' in body
        )
        if not ok:
            print("agent-ui: Android Dev Menu prefs verify failed", file=sys.stderr)
        return ok
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"agent-ui: Android Dev Menu prefs suppress failed: {exc}", file=sys.stderr)
        return False


def dump_ui_xml() -> str | None:
    remote = "/sdcard/uidump-agent-ui.xml"
    try:
        dump = adb("shell", "uiautomator", "dump", remote, timeout=20)
        if dump.returncode != 0:
            return None
        with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
            local = tmp.name
        pull = adb("pull", remote, local, timeout=15)
        if pull.returncode != 0:
            return None
        try:
            return Path(local).read_text(encoding="utf-8", errors="replace")
        finally:
            Path(local).unlink(missing_ok=True)
            adb("shell", "rm", "-f", remote, timeout=5)
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"agent-ui: Android uiautomator dump failed: {exc}", file=sys.stderr)
        return None


def _node_texts(root: ET.Element) -> list[str]:
    texts: list[str] = []
    for node in root.iter("node"):
        for key in ("text", "content-desc"):
            value = (node.attrib.get(key) or "").strip()
            if value:
                texts.append(value)
    return texts


def _haystack(texts: list[str]) -> str:
    return " ".join(texts).lower()


def _phrases_match(hay: str, phrases: tuple[str, ...]) -> bool:
    return any(p in hay for p in phrases)


def _parse_bounds(raw: str) -> tuple[int, int, int, int] | None:
    m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", raw or "")
    if not m:
        return None
    return tuple(int(g) for g in m.groups())  # type: ignore[return-value]


def _find_tap_center(root: ET.Element, label: str) -> tuple[int, int] | None:
    needle = label.lower()
    for node in root.iter("node"):
        text = (node.attrib.get("text") or "").strip().lower()
        desc = (node.attrib.get("content-desc") or "").strip().lower()
        if text != needle and desc != needle:
            continue
        bounds = _parse_bounds(node.attrib.get("bounds") or "")
        if not bounds:
            continue
        l, t, r, b = bounds
        return (l + r) // 2, (t + b) // 2
    return None


def _tap(x: int, y: int) -> bool:
    try:
        result = adb("shell", "input", "tap", str(x), str(y), timeout=10)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def _press_back() -> bool:
    try:
        result = adb("shell", "input", "keyevent", "4", timeout=10)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def blocking_activity_active() -> bool:
    """Cheaply bypass the clear-cache for Android-owned blockers."""
    try:
        result = adb("shell", "dumpsys", "activity", "activities", timeout=8)
    except (subprocess.TimeoutExpired, OSError):
        return False
    if result.returncode != 0:
        return False
    top = next(
        (
            line
            for line in result.stdout.splitlines()
            if "topResumedActivity=" in line or "mResumedActivity:" in line
        ),
        "",
    ).lower()
    return (
        any(package in top for package in PERMISSION_CONTROLLER_PACKAGES)
        or "devlauncheractivity" in top
    )


def _is_permission_prompt(root: ET.Element, hay: str) -> bool:
    packages = {
        (node.attrib.get("package") or "").strip().lower()
        for node in root.iter("node")
    }
    if not packages.intersection(PERMISSION_CONTROLLER_PACKAGES):
        return False
    return "allow ontrack" in hay and any(label.lower() in hay for label in PERMISSION_ALLOW_LABELS)


def classify(xml: str) -> str | None:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None
    hay = _haystack(_node_texts(root))
    if _is_permission_prompt(root, hay):
        return "permission"
    if all(phrase in hay for phrase in DEV_LAUNCHER_PHRASES) and "http://" in hay:
        return "launcher"
    if _phrases_match(hay, DEV_MENU_INTRO_PHRASES) and "continue" in hay:
        return "intro"
    if _phrases_match(hay, DEV_MENU_TOOLS_PHRASES):
        return "tools"
    # Intro chrome without the long body (partial paint) still has Continue + Runtime.
    if "runtime version" in hay and "continue" in hay and "developer menu" in hay:
        return "intro"
    if "runtime version" in hay and ("reload" in hay or "go home" in hay):
        return "tools"
    return None


def dismiss_once(xml: str) -> bool:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return False
    kind = classify(xml)
    if kind == "permission":
        for label in PERMISSION_ALLOW_LABELS:
            center = _find_tap_center(root, label)
            if center:
                print(f"agent-ui: granting Android runtime permission ({label})", file=sys.stderr)
                return _tap(*center)
        return False
    if kind == "launcher":
        for node in root.iter("node"):
            label = (node.attrib.get("text") or node.attrib.get("content-desc") or "").strip()
            if not re.match(r"^https?://.+:\d+/?$", label, re.IGNORECASE):
                continue
            bounds = _parse_bounds(node.attrib.get("bounds") or "")
            if bounds:
                left, top, right, bottom = bounds
                print(f"agent-ui: opening Android development server ({label})", file=sys.stderr)
                return _tap((left + right) // 2, (top + bottom) // 2)
        return False
    if kind == "intro":
        center = _find_tap_center(root, "Continue")
        if center:
            print("agent-ui: dismissing Expo developer-menu intro (Continue)", file=sys.stderr)
            return _tap(*center)
        print("agent-ui: Expo intro Continue not found — BACK as fallback", file=sys.stderr)
        return _press_back()
    if kind == "tools":
        print("agent-ui: dismissing Expo Dev Menu (BACK)", file=sys.stderr)
        return _press_back()
    return False


def ensure(force: bool = False) -> int:
    if os.environ.get("AGENT_UI_SKIP_ANDROID_ALERTS", "0") == "1":
        return 0

    # Always keep prefs suppressed so the next cold start stays clear.
    suppress_dev_menu_prefs()

    # A fresh Dev Menu cache must never hide a newly installed app's runtime
    # permission dialog. Top-activity inspection is much cheaper than UI XML.
    if not force and _cache_fresh() and not blocking_activity_active():
        return 0

    xml = dump_ui_xml()
    if xml is None:
        return 2

    # The VIEW intent can arrive before DevLauncher paints its server list.
    # A one-shot dump then caches a false "clear" result and leaves the cold
    # client parked at the picker. In explicit dismiss mode, briefly wait for
    # that accessibility tree to materialize.
    if force and classify(xml) is None and blocking_activity_active():
        for _ in range(8):
            time.sleep(0.5)
            xml = dump_ui_xml()
            if xml is None:
                return 2
            if classify(xml) is not None:
                break

    if classify(xml) is None:
        _touch_cache()
        return 0

    attempts = 10 if force else 4
    for attempt in range(attempts):
        xml = dump_ui_xml()
        if xml is None:
            return 2
        kind = classify(xml)
        if kind is None:
            # A cold launch commonly transitions picker -> blank bundle paint ->
            # runtime permission. Keep observing that bounded sequence instead
            # of caching the transient blank frame as clear.
            if force and attempt < attempts - 1 and blocking_activity_active():
                time.sleep(0.5)
                continue
            _touch_cache()
            return 0
        if not dismiss_once(xml):
            return 1
        time.sleep(0.45)

    xml = dump_ui_xml()
    if xml is None:
        return 2
    if classify(xml) is None:
        _touch_cache()
        return 0
    print("error: Android Expo Dev Menu still blocking after dismiss attempts", file=sys.stderr)
    return 1


def probe() -> int:
    xml = dump_ui_xml()
    if xml is None:
        print(json_dumps({"ok": False, "error": "dump_failed"}))
        return 2
    kind = classify(xml)
    print(json_dumps({"ok": True, "blocking": kind is not None, "kind": kind}))
    return 1 if kind else 0


def json_dumps(payload: dict) -> str:
    import json

    return json.dumps(payload, separators=(",", ":"))


def main(argv: list[str]) -> int:
    cmd = (argv[1] if len(argv) > 1 else "ensure").lower()
    if cmd in {"ensure", "clear"}:
        return ensure(force=False)
    if cmd == "dismiss":
        return ensure(force=True)
    if cmd == "probe":
        return probe()
    if cmd == "suppress-prefs":
        return 0 if suppress_dev_menu_prefs() else 1
    print(
        "usage: android_system_alert.py ensure|dismiss|probe|suppress-prefs",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
