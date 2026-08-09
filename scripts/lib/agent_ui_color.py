#!/usr/bin/env python3
"""Sample accent-ish pixels inside an agent-ui element frame from a screenshot."""

from __future__ import annotations

import colorsys
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def parse_hex_color(raw: str) -> tuple[int, int, int]:
    value = raw.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        raise ValueError(f"expected #RRGGBB, got {raw!r}")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _is_ink(rgb: tuple[int, int, int]) -> bool:
    """True for saturated / mid-luma pixels (skip white cards & near-black)."""
    r, g, b = (c / 255.0 for c in rgb)
    h, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    _ = h
    return saturation >= 0.12 and 0.12 <= lightness <= 0.78


def sample_frame_accent(
    image_path: Path,
    frame: dict[str, Any],
    *,
    scale: float,
) -> tuple[int, int, int] | None:
    """Average non-background pixels in the element frame. Returns RGB or None."""
    try:
        from PIL import Image
    except ImportError as exc:
        raise SystemExit(
            "error: Pillow required for --assert-color "
            "(python3 -m pip install pillow)"
        ) from exc

    img = Image.open(image_path).convert("RGB")
    x = float(frame.get("x") or 0) * scale
    y = float(frame.get("y") or 0) * scale
    w = float(frame.get("width") or 0) * scale
    h = float(frame.get("height") or 0) * scale
    if w < 2 or h < 2:
        return None

    # Inset slightly; bias toward left/center where icon + title live.
    left = max(0, int(x + w * 0.04))
    top = max(0, int(y + h * 0.15))
    right = min(img.width, int(x + w * 0.72))
    bottom = min(img.height, int(y + h * 0.85))
    if right <= left or bottom <= top:
        return None

    crop = img.crop((left, top, right, bottom))
    pixels = list(crop.getdata())
    ink = [p for p in pixels if _is_ink(p)]
    if len(ink) < 8:
        # Fall back to center cross-sample if card chrome dominates.
        cx, cy = int((left + right) / 2), int((top + bottom) / 2)
        samples = []
        for dx, dy in ((0, 0), (-8, 0), (8, 0), (-20, 0), (20, 0), (0, -4), (0, 4)):
            px, py = cx + dx, cy + dy
            if 0 <= px < img.width and 0 <= py < img.height:
                samples.append(img.getpixel((px, py)))
        ink = [p for p in samples if _is_ink(p)] or samples
    if not ink:
        return None
    n = len(ink)
    return (
        round(sum(p[0] for p in ink) / n),
        round(sum(p[1] for p in ink) / n),
        round(sum(p[2] for p in ink) / n),
    )


def _agent_ui_platform() -> str:
    import os

    raw = (os.environ.get("AGENT_UI_PLATFORM") or "ios").strip().lower()
    return "android" if raw == "android" else "ios"


def _android_serial() -> str | None:
    import os

    serial = (os.environ.get("ONTRACK_ANDROID_SERIAL") or os.environ.get("ANDROID_SERIAL") or "").strip()
    if serial:
        return serial
    # Prefer serial written by ensure-android-emulator / ensure-packager --android.
    try:
        from pathlib import Path as _Path

        root = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
        if not root:
            root = str(_Path(__file__).resolve().parents[2])
        cached = _Path(root) / ".cursor" / "android-emulator.serial"
        if cached.is_file():
            text = cached.read_text(encoding="utf-8").strip()
            if text:
                return text
    except OSError:
        pass
    return None


def _ios_screen_capture_healable(detail: str) -> bool:
    """True when screenshot failed for a reason we can heal (park / no display)."""
    low = detail.lower()
    return (
        "screen surfaces" in low
        or "timeout waiting for screen" in low
        or "display port" in low
        or "timed out" in low
        or "screenshot timed out" in low
    )


def _ios_simctl_timeout_secs() -> float:
    """Hard cap per `simctl io screenshot` — never hang verify forever."""
    import os

    raw = (os.environ.get("AGENT_UI_IOS_SCREENSHOT_SECS") or "").strip()
    if raw:
        try:
            return max(3.0, float(raw))
        except ValueError:
            pass
    # Align with bash ios_simctl_timed default when unset.
    raw = (os.environ.get("ONTRACK_SIMCTL_TIMEOUT_SECS") or "10").strip()
    try:
        return max(3.0, float(raw))
    except ValueError:
        return 10.0


def _ios_screenshot_heal_secs() -> float:
    """Wall-clock budget for unpark/reattach retries before fail-fast."""
    import os

    raw = (os.environ.get("AGENT_UI_IOS_SCREENSHOT_HEAL_SECS") or "35").strip()
    try:
        return max(8.0, float(raw))
    except ValueError:
        return 35.0


def _ios_capture_lock_path() -> Path:
    import os

    root = Path(os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT") or "")
    if not root.is_dir():
        root = Path(__file__).resolve().parents[2]
    pool = Path(os.environ.get("AGENT_UI_POOL_DIR") or (root / ".cursor" / "agent-ui-slots"))
    pool.mkdir(parents=True, exist_ok=True)
    return pool / "ios-capture.lock"


def _ios_acquire_capture_lock() -> None:
    """Pause the agent GUI reaper while we unpark for screenshot."""
    import os
    import time

    path = _ios_capture_lock_path()
    try:
        path.write_text(f"{os.getpid()}:{time.time():.3f}\n", encoding="utf-8")
    except OSError:
        pass


def _ios_release_capture_lock() -> None:
    path = _ios_capture_lock_path()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def _ios_unpark_agent_window() -> None:
    """Restore a minimized agent Simulator window so IOSurface wakes.

    Headless pool policy minimizes `onTrack Agent *` windows while the user's
    Simulator.app stays open. Minimized windows lose screen surfaces — position
    nudges alone do not restore them. Prefer the shared unminimize helper
    (Dock restore + place); fall back to a raise nudge.
    """
    import os
    from pathlib import Path

    name = (os.environ.get("ONTRACK_IOS_SIMULATOR") or "").strip()
    if not name or "Agent" not in name:
        return
    if subprocess.run(
        ["pgrep", "-x", "Simulator"], check=False, capture_output=True
    ).returncode != 0:
        return

    root = Path(os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT") or "")
    if not root.is_dir():
        root = Path(__file__).resolve().parents[2]
    sim_sh = root / "scripts" / "lib" / "ios-simulator.sh"
    if sim_sh.is_file():
        safe_name = name.replace("'", "'\\''")
        try:
            subprocess.run(
                [
                    "bash",
                    "-c",
                    f'source "{sim_sh}" && ios_sim_unminimize_agent_window_named \'{safe_name}\'',
                ],
                check=False,
                capture_output=True,
                timeout=12,
                env={**os.environ, "ONTRACK_IOS_SIMULATOR_WINDOW": "0"},
            )
            return
        except subprocess.TimeoutExpired:
            pass

    # Fallback: raise + on-screen nudge (does not unminimize Dock-miniaturized).
    safe = name.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''
tell application "System Events"
  if not (exists process "Simulator") then return
  tell process "Simulator"
    repeat with w in (get every window)
      try
        set wn to name of w as text
        if wn contains "{safe}" then
          try
            set value of attribute "AXMinimized" of w to false
          end try
          set position of w to {{40, 40}}
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


def _ios_reattach_agent_display(udid: str) -> None:
    """Soft-reboot one agent sim so Simulator.app reattaches a framebuffer.

    Headless `simctl boot` while Simulator.app is open can leave the device with
    Power-Off ports and `Device does not have a 'default' display port`. A quick
    shutdown+boot (same UDID) attaches LCD; caller re-parks afterward.
    """
    import os
    import time

    if not udid or udid == "booted":
        return
    print(
        f"agent-ui: iOS display port missing — reattaching framebuffer on {udid[:8]}…",
        file=sys.stderr,
    )
    subprocess.run(
        ["xcrun", "simctl", "shutdown", udid],
        check=False,
        capture_output=True,
        timeout=30,
    )
    time.sleep(0.4)
    subprocess.run(
        ["xcrun", "simctl", "boot", udid],
        check=False,
        capture_output=True,
        timeout=60,
    )
    # Wait until Booted (cap ~20s).
    deadline = time.time() + 20
    while time.time() < deadline:
        proc = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "booted", "-j"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode == 0 and udid in (proc.stdout or ""):
            break
        time.sleep(0.5)
    # Point Simulator at this device + unpark so the display stays powered.
    try:
        subprocess.run(
            [
                "defaults",
                "write",
                "com.apple.iphonesimulator",
                "CurrentDeviceUDID",
                udid,
            ],
            check=False,
            capture_output=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        pass
    if subprocess.run(
        ["pgrep", "-x", "Simulator"], check=False, capture_output=True
    ).returncode == 0:
        subprocess.run(
            ["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", udid],
            check=False,
            capture_output=True,
            timeout=10,
        )
        time.sleep(1.2)
        _ios_unpark_agent_window()
    # Restore viewer preference so handoff still lands on the Pro.
    viewer = (os.environ.get("ONTRACK_IOS_VIEWER_SIMULATOR") or "").strip()
    if not viewer:
        lease = (os.environ.get("ONTRACK_IOS_SIMULATOR") or "").strip()
        viewer = (
            "onTrack iPhone 17 Pro"
            if (not lease or "Agent" in lease)
            else lease
        )
    # Best-effort: leave CurrentDeviceUDID alone until handoff; unpark is enough.


def _ios_reparks_agent_windows() -> None:
    import os
    from pathlib import Path

    root = Path(os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT") or "")
    if not root.is_dir():
        root = Path(__file__).resolve().parents[2]
    sim_sh = root / "scripts" / "lib" / "ios-simulator.sh"
    if not sim_sh.is_file():
        return
    try:
        subprocess.run(
            [
                "bash",
                "-c",
                f'source "{sim_sh}" && ios_sim_park_agent_windows',
            ],
            check=False,
            capture_output=True,
            timeout=10,
            env={**os.environ, "ONTRACK_IOS_SIMULATOR_WINDOW": "0"},
        )
    except subprocess.TimeoutExpired:
        pass


def _ios_device_is_booted(udid: str) -> bool:
    """True when the target sim is Booted (screenshot of Shutdown hangs forever)."""
    if not udid or udid == "booted":
        proc = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "booted", "-j"],
            check=False,
            capture_output=True,
            text=True,
            timeout=8,
        )
        return proc.returncode == 0 and '"Booted"' in (proc.stdout or "")
    try:
        proc = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "booted", "-j"],
            check=False,
            capture_output=True,
            text=True,
            timeout=8,
        )
    except subprocess.TimeoutExpired:
        return False
    return proc.returncode == 0 and udid in (proc.stdout or "")


def _ios_kill_wedged_simctl_io(udid: str) -> None:
    """Kill orphaned `simctl io … screenshot` (xcrun timeout leaves these alive)."""
    import os
    import signal

    if not udid:
        return
    try:
        proc = subprocess.run(
            ["pgrep", "-f", f"simctl io {udid} screenshot"],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except subprocess.TimeoutExpired:
        return
    for line in (proc.stdout or "").splitlines():
        pid_s = line.strip()
        if not pid_s.isdigit():
            continue
        pid = int(pid_s)
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass


def _ios_run_simctl_screenshot(target: str, path: Path, timeout_secs: float) -> tuple[int, str]:
    """Run screenshot in a new session; on timeout kill the whole process group.

    Plain subprocess.run(timeout=…) only kills `xcrun` — the real
    CoreSimulator `simctl io` child keeps wedging the daemon.
    """
    import os
    import signal

    cmd = ["xcrun", "simctl", "io", target, "screenshot", str(path)]
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
    except OSError as exc:
        return 1, str(exc)
    try:
        stdout, stderr = proc.communicate(timeout=timeout_secs)
        detail = ((stderr or "") + "\n" + (stdout or "")).strip()
        return int(proc.returncode or 0), detail
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            try:
                proc.kill()
            except OSError:
                pass
        try:
            proc.communicate(timeout=2)
        except (subprocess.TimeoutExpired, OSError):
            pass
        _ios_kill_wedged_simctl_io(target)
        return 124, f"screenshot timed out after {timeout_secs:.0f}s"


def capture_screenshot(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if _agent_ui_platform() == "android":
        import os
        import shutil

        adb = shutil.which("adb") or os.path.expanduser(
            "~/Library/Android/sdk/platform-tools/adb"
        )
        if not os.path.isfile(adb) and not shutil.which("adb"):
            raise SystemExit("error: adb not found for Android screenshot")
        if not os.path.isfile(adb):
            adb = shutil.which("adb") or "adb"
        cmd = [adb]
        serial = _android_serial()
        if serial:
            cmd += ["-s", serial]
        cmd += ["exec-out", "screencap", "-p"]
        proc = subprocess.run(cmd, check=False, capture_output=True)
        if proc.returncode != 0 or not proc.stdout:
            detail = (proc.stderr or b"").decode("utf-8", errors="replace").strip()
            raise SystemExit(f"error: android screenshot failed: {detail or proc.returncode}")
        path.write_bytes(proc.stdout)
        return path

    import os
    import time

    target = (os.environ.get("ONTRACK_IOS_SIMULATOR_UDID") or "").strip() or "booted"
    # Shutdown / missing devices make `simctl io screenshot` hang forever.
    booted_ok = _ios_device_is_booted(target)
    if not booted_ok:
        raise SystemExit(
            f"error: screenshot failed: device not Booted ({target[:8] if target != 'booted' else target})"
        )
    last_detail = ""
    unparked = False
    reattached = False
    per_shot = _ios_simctl_timeout_secs()
    heal_deadline = time.time() + _ios_screenshot_heal_secs()
    _ios_acquire_capture_lock()
    _ios_kill_wedged_simctl_io(target)
    try:
        for attempt in range(5):
            if time.time() >= heal_deadline:
                last_detail = last_detail or "screenshot heal budget exhausted"
                break
            if path.is_file():
                path.unlink(missing_ok=True)
            code, detail = _ios_run_simctl_screenshot(target, path, per_shot)
            if code == 0 and path.is_file() and path.stat().st_size > 0:
                return path
            if path.is_file() and path.stat().st_size == 0:
                path.unlink(missing_ok=True)
            last_detail = detail or last_detail or f"simctl exit {code}"
            if not _ios_device_is_booted(target):
                last_detail = f"device not Booted ({target[:8]})"
                break
            if not _ios_screen_capture_healable(last_detail) or attempt >= 4:
                break
            if time.time() >= heal_deadline:
                break
            if (
                "display port" in last_detail.lower()
                and not reattached
                and target != "booted"
            ):
                # Reattach is expensive — only when heal budget still has room.
                if heal_deadline - time.time() < 15:
                    break
                _ios_reattach_agent_display(target)
                reattached = True
                unparked = True
                time.sleep(0.8)
                continue
            if not unparked:
                print(
                    "agent-ui: iOS screen capture blocked — unparking agent window…",
                    file=sys.stderr,
                )
                _ios_unpark_agent_window()
                unparked = True
            else:
                # Surfaces still dead after one unpark — nudge once more, then fail.
                _ios_unpark_agent_window()
            time.sleep(min(1.0 + attempt * 0.4, max(0.2, heal_deadline - time.time())))
    finally:
        try:
            if unparked or reattached:
                _ios_reparks_agent_windows()
        finally:
            _ios_kill_wedged_simctl_io(target)
            _ios_release_capture_lock()

    raise SystemExit(f"error: screenshot failed: {last_detail or 'unknown'}")


def assert_element_color(
    *,
    frame: dict[str, Any],
    expected_hex: str,
    scale: float,
    tolerance: float = 55.0,
    screenshot_path: Path | None = None,
) -> dict[str, Any]:
    """Compare sampled accent in frame to expected hex. Returns result dict."""
    expected = parse_hex_color(expected_hex)
    tmp: Path | None = None
    path = screenshot_path
    if path is None:
        tmp = Path(tempfile.mkstemp(suffix=".png", prefix="agent-ui-color-")[1])
        path = tmp
    try:
        if screenshot_path is None or not path.is_file():
            capture_screenshot(path)
        sampled = sample_frame_accent(path, frame, scale=scale)
        if sampled is None:
            return {
                "ok": False,
                "op": "color",
                "detail": "could not sample ink pixels in frame",
                "expected": expected_hex,
            }
        dist = color_distance(sampled, expected)
        ok = dist <= tolerance
        return {
            "ok": ok,
            "op": "color",
            "detail": (
                f"rgb={sampled[0]},{sampled[1]},{sampled[2]} "
                f"expected={expected_hex} dist={dist:.1f} tol={tolerance}"
            ),
            "expected": expected_hex,
            "sampled": f"#{sampled[0]:02X}{sampled[1]:02X}{sampled[2]:02X}",
            "distance": round(dist, 2),
            "tolerance": tolerance,
        }
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)
