#!/usr/bin/env python3
"""Host-side agent-ui bridge.

Prefers the persistent daemon (Unix socket). Falls back to the simulator
Documents file protocol when the daemon is unavailable.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

BUNDLE_ID = os.environ.get("BUNDLE_ID", "com.imtihoss.ontracknow")
DUMP_NAME = os.environ.get("DUMP_NAME", "agent-ui-dump.json")
STATUS_NAME = os.environ.get("STATUS_NAME", "agent-ui-status.json")
COMMAND_NAME = os.environ.get("COMMAND_NAME", "agent-ui-command.json")
POLL_SLEEP = float(os.environ.get("POLL_SLEEP", "0.016"))
# Hard cap for simctl RPCs — wedged CoreSimulator otherwise hangs forever.
SIMCTL_TIMEOUT_SECS = float(os.environ.get("ONTRACK_SIMCTL_TIMEOUT_SECS", "10"))
CACHE_REL = Path(".cursor") / "agent-ui-data-dir"
ANDROID_DUMP_REL = Path(".cursor") / "agent-ui-android-dump.json"
TRANSPORT = os.environ.get("AGENT_UI_TRANSPORT", "auto")  # auto|daemon|file


def agent_ui_platform() -> str:
    """Host pin for dual-device runs. Default ios (backcompat)."""
    raw = (os.environ.get("AGENT_UI_PLATFORM") or "ios").strip().lower()
    if raw in {"android", "ios"}:
        return raw
    return "ios"


def agent_ui_device() -> str | None:
    """Optional device pin (adb serial / sim UDID)."""
    for key in (
        "AGENT_UI_DEVICE",
        "ONTRACK_ANDROID_SERIAL",
        "ANDROID_SERIAL",
        "ONTRACK_IOS_SIMULATOR_UDID",
    ):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            # Prefer android serials only when pinned to android.
            if key == "ONTRACK_IOS_SIMULATOR_UDID" and agent_ui_platform() == "android":
                continue
            if key in {"ONTRACK_ANDROID_SERIAL", "ANDROID_SERIAL"} and agent_ui_platform() != "android":
                continue
            return raw
    if agent_ui_platform() != "android":
        return None
    try:
        cached = repo_root() / ".cursor" / "android-emulator.serial"
        if cached.is_file():
            text = cached.read_text(encoding="utf-8").strip()
            if text:
                return text
    except OSError:
        pass
    return None


def agent_ui_slot() -> int | None:
    """Optional agent device pool slot (1…N)."""
    raw = (os.environ.get("AGENT_UI_SLOT") or "").strip()
    if not raw:
        return None
    try:
        n = int(raw)
    except ValueError:
        return None
    if n < 1 or n > 32:
        return None
    return n


def ios_sim_target() -> str:
    """simctl device id: pinned UDID, else booted."""
    udid = (os.environ.get("ONTRACK_IOS_SIMULATOR_UDID") or "").strip()
    return udid or "booted"


def stamp_platform(payload: dict) -> dict:
    body = dict(payload)
    body["platform"] = agent_ui_platform()
    slot = agent_ui_slot()
    if slot is not None:
        body["slot"] = slot
    device = agent_ui_device()
    if device and agent_ui_platform() == "android":
        body["device"] = device
        # Keep adb helpers aligned even when only AGENT_UI_DEVICE was set.
        os.environ.setdefault("ONTRACK_ANDROID_SERIAL", device)
        os.environ.setdefault("ANDROID_SERIAL", device)
    elif device and agent_ui_platform() == "ios":
        body["device"] = device
        os.environ.setdefault("ONTRACK_IOS_SIMULATOR_UDID", device)
    if agent_ui_platform() == "ios":
        # Address iOS commands to the leased sim by name. Several sims share one
        # Metro bundle and daemon, so slot alone lets the user's headed sim drain
        # the pool queue (and adopt its slot) while host ops target the lease.
        sim_name = (os.environ.get("ONTRACK_IOS_SIMULATOR") or "").strip()
        if sim_name:
            body["iosDeviceName"] = sim_name
    return body


def write_slot_pin_file() -> bool:
    """iOS Documents/agent-ui-pin.json. Android no-op (host-port slot — H17)."""
    slot = agent_ui_slot()
    if slot is None:
        return False
    if agent_ui_platform() == "android":
        return True
    try:
        data = resolve_data_dir()
        pin = data / "Documents" / "agent-ui-pin.json"
        pin.parent.mkdir(parents=True, exist_ok=True)
        pin.write_text(json.dumps({"slot": slot}), encoding="utf-8")
        return True
    except SystemExit:
        return False
    except OSError:
        return False


def android_host_dump_path(root: Path | None = None) -> Path:
    return (root or repo_root()) / ANDROID_DUMP_REL


def repo_root() -> Path:
    env = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
    if env:
        root = Path(env)
        if (root / "scripts" / "ensure-packager.sh").is_file():
            return root
    return Path(__file__).resolve().parents[2]


def _daemon():
    # Local import keeps `python -m py_compile` of this file independent.
    import agent_ui_daemon as daemon  # type: ignore

    return daemon


def _container_looks_valid(path: Path) -> bool:
    return path.is_dir() and (path / "Documents").is_dir()


def resolve_data_dir(root: Path | None = None) -> Path:
    env = os.environ.get("AGENT_UI_DATA_DIR")
    if env:
        path = Path(env)
        if _container_looks_valid(path):
            return path

    root = root or repo_root()
    target = ios_sim_target()
    # Per-device cache so parallel pool slots do not share one Documents path.
    cache = root / CACHE_REL
    if target != "booted":
        cache = root / Path(".cursor") / f"agent-ui-data-dir-{target}"
    if cache.is_file():
        cached = cache.read_text(encoding="utf-8").strip()
        if cached:
            path = Path(cached)
            if _container_looks_valid(path):
                os.environ["AGENT_UI_DATA_DIR"] = str(path)
                return path

    try:
        proc = subprocess.run(
            [
                "xcrun",
                "simctl",
                "get_app_container",
                target,
                BUNDLE_ID,
                "data",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=SIMCTL_TIMEOUT_SECS,
        )
    except subprocess.TimeoutExpired as exc:
        raise SystemExit(
            "error: simctl get_app_container timed out "
            f"(simulator may be wedged; timeout={SIMCTL_TIMEOUT_SECS}s)"
        ) from exc
    except OSError as exc:
        raise SystemExit(f"error: could not resolve app data container: {exc}") from exc

    dir_raw = (proc.stdout or "").strip()
    if proc.returncode != 0 or not dir_raw:
        raise SystemExit(f"error: could not resolve app data container for {BUNDLE_ID}")

    path = Path(dir_raw)
    if not _container_looks_valid(path):
        raise SystemExit(f"error: app data container missing Documents: {path}")

    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(f"{path}\n", encoding="utf-8")
    os.environ["AGENT_UI_DATA_DIR"] = str(path)
    return path


def paths(root: Path | None = None) -> tuple[Path, Path, Path]:
    data = resolve_data_dir(root)
    documents = data / "Documents"
    return (
        documents / DUMP_NAME,
        documents / STATUS_NAME,
        documents / COMMAND_NAME,
    )


def send_via_file(
    payload: dict,
    *,
    wait_secs: float,
    allow_fail: bool = False,
    expect_dump: bool = False,
) -> dict:
    dump_path, status_path, command_path = paths()
    try:
        status_path.unlink(missing_ok=True)
        command_path.unlink(missing_ok=True)
        if expect_dump:
            dump_path.unlink(missing_ok=True)
    except OSError:
        pass

    started = time.time()
    body = stamp_platform(payload)
    # Safe for JS Number — daemon path uses the same constraint.
    body["nonce"] = int(time.time() * 1000) % 9_007_199_254_740_991
    expected_op = str(body.get("op") or "dump")
    command_path.write_text(json.dumps(body, separators=(",", ":")), encoding="utf-8")

    deadline = started + max(0.1, float(wait_secs))
    while time.time() < deadline:
        if status_path.is_file():
            if expect_dump and not dump_path.is_file():
                time.sleep(POLL_SLEEP)
                continue
            try:
                mtime = status_path.stat().st_mtime
                if mtime < started - 2:
                    time.sleep(POLL_SLEEP)
                    continue
                data = json.loads(status_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                time.sleep(POLL_SLEEP)
                continue
            if data.get("op") != expected_op:
                time.sleep(POLL_SLEEP)
                continue
            ok = bool(data.get("ok"))
            if ok or allow_fail:
                try:
                    _daemon().write_last_ok()
                except Exception:
                    pass
                return data
            print(
                f"error: agent-ui op {expected_op} failed: "
                f"{json.dumps(data, separators=(',', ':'))}",
                file=sys.stderr,
            )
            raise SystemExit(1)
        time.sleep(POLL_SLEEP)

    print(f"error: timed out waiting for agent-ui status op={expected_op}", file=sys.stderr)
    if status_path.is_file():
        print("last status:", file=sys.stderr)
        try:
            print(status_path.read_text(encoding="utf-8"), file=sys.stderr)
        except OSError:
            pass
    raise SystemExit(1)


def _http_json(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    timeout: float = 6.0,
    port: int | None = None,
) -> tuple[int, dict | None]:
    import urllib.error
    import urllib.request

    port = port or int(os.environ.get("AGENT_UI_HTTP_PORT", "8191"))
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return res.status, payload if isinstance(payload, dict) else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8") if exc.fp else ""
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = None
        return exc.code, payload if isinstance(payload, dict) else None


def _write_host_dump_from_status(status: dict, dump_path: Path) -> None:
    """Materialize a dump file from HTTP status (Android has no simctl container)."""
    elements = status.get("elements")
    if not isinstance(elements, list):
        return
    payload = {
        "generatedAt": status.get("generatedAt"),
        "count": status.get("count", len(elements)),
        "route": status.get("route"),
        "screen": status.get("screen"),
        "elements": elements,
    }
    dump_path.parent.mkdir(parents=True, exist_ok=True)
    dump_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def send_via_daemon(
    payload: dict,
    *,
    wait_secs: float,
    allow_fail: bool = False,
    expect_dump: bool = False,
) -> dict:
    daemon = _daemon()
    root = repo_root()
    if not daemon.ensure_daemon(root):
        raise RuntimeError("daemon not healthy")

    body = stamp_platform(payload)
    body.pop("nonce", None)  # daemon assigns a JS-safe nonce
    # Solo nav/seed/flow: wrap as a 1-op batch so the app uses the proven
    # batch status path (solo goto has timed out on Android after remount).
    op_name = str(body.get("op") or "dump")
    if op_name in {"goto", "reset", "seed", "flow"} and not isinstance(
        body.get("ops"), list
    ):
        wrapped = {
            "op": "batch",
            "ops": [{k: v for k, v in body.items() if k not in {"platform", "device"}}],
            "platform": body.get("platform"),
        }
        if body.get("device"):
            wrapped["device"] = body["device"]
        body = wrapped
    expected_op = str(body.get("op") or "dump")
    platform = agent_ui_platform()

    dump_path = None
    if platform == "android":
        dump_path = android_host_dump_path(root)
        if expect_dump:
            dump_path.unlink(missing_ok=True)
    else:
        try:
            dump_path, status_path, command_path = paths(root)
            status_path.unlink(missing_ok=True)
            # Clear stale file-command so a cold file poll cannot steal the op.
            command_path.unlink(missing_ok=True)
            if expect_dump:
                dump_path.unlink(missing_ok=True)
        except Exception:
            dump_path = None

    try:
        code, queued = _http_json("POST", "/command", body=body, timeout=0.75)
    except Exception as exc:
        raise RuntimeError(f"daemon enqueue failed: {exc}") from exc
    if code != 200 or not queued or not queued.get("ok"):
        # Fall back to unix send (enqueue+wait) without file mirror.
        status = daemon.unix_send(
            body, wait_secs=wait_secs, allow_fail=True, root=root
        )
    else:
        nonce = int(queued["nonce"])
        # Skip Documents file mirror on the HTTP hot path — app long-polls /next.
        wait_ms = int(max(0.1, wait_secs) * 1000)
        code, status = _http_json(
            "GET",
            f"/status?nonce={nonce}&waitMs={wait_ms}",
            timeout=wait_secs + 1.0,
        )
        if code == 204 or status is None:
            status = {
                "ok": False,
                "op": expected_op,
                "detail": f"timed out after {wait_secs}s",
                "nonce": nonce,
            }

    if expect_dump and status.get("ok") and isinstance(status.get("elements"), list):
        out = dump_path if dump_path is not None else android_host_dump_path(root)
        _write_host_dump_from_status(status, out)
        dump_path = out
    elif expect_dump and dump_path is not None and platform != "android":
        deadline = time.time() + max(0.5, wait_secs)
        while time.time() < deadline and not dump_path.is_file():
            time.sleep(POLL_SLEEP)
        if not dump_path.is_file() and status.get("ok"):
            print("error: agent-ui dump file missing after ok status", file=sys.stderr)
            raise SystemExit(1)

    if expect_dump and platform == "android" and status.get("ok"):
        out = dump_path if dump_path is not None else android_host_dump_path(root)
        if not out.is_file() and not isinstance(status.get("elements"), list):
            print(
                "error: agent-ui android dump missing elements in status",
                file=sys.stderr,
            )
            raise SystemExit(1)

    ok = bool(status.get("ok"))
    if ok or allow_fail:
        if ok:
            daemon.write_last_ok(root)
        return status
    print(
        f"error: agent-ui op {expected_op} failed: "
        f"{json.dumps(status, separators=(',', ':'))}",
        file=sys.stderr,
    )
    raise SystemExit(1)


def send(
    payload: dict,
    *,
    wait_secs: float,
    allow_fail: bool = False,
    expect_dump: bool = False,
) -> dict:
    if not isinstance(payload, dict):
        raise SystemExit("payload must be a JSON object")

    payload = stamp_platform(resolve_payload_ids(payload))
    write_slot_pin_file()
    transport = TRANSPORT.lower().strip()
    # Android has no simctl Documents file transport — daemon only.
    if agent_ui_platform() == "android" and transport != "daemon":
        transport = "daemon"
    if transport in {"auto", "daemon"}:
        try:
            return send_via_daemon(
                payload,
                wait_secs=wait_secs,
                allow_fail=allow_fail,
                expect_dump=expect_dump,
            )
        except Exception as exc:
            if transport == "daemon" or agent_ui_platform() == "android":
                print(f"error: daemon transport failed: {exc}", file=sys.stderr)
                raise SystemExit(1) from exc
            # Fall through to file.
    return send_via_file(
        payload,
        wait_secs=wait_secs,
        allow_fail=allow_fail,
        expect_dump=expect_dump,
    )


def default_wait_timeout_ms() -> int:
    raw = os.environ.get("AGENT_UI_WAIT_TIMEOUT_MS", "2000")
    try:
        return max(100, int(raw))
    except ValueError:
        return 2000


def _ids():
    import agent_ui_ids as ids  # type: ignore

    return ids


def _color():
    import agent_ui_color as color  # type: ignore

    return color


def resolve_payload_ids(payload: dict[str, Any], *, root: Path | None = None) -> dict[str, Any]:
    """Resolve AgentUiIds key paths inside a single op or batch."""
    ids = _ids()
    root = root or repo_root()
    if payload.get("op") == "batch" and isinstance(payload.get("ops"), list):
        return {
            **payload,
            "ops": [ids.resolve_op_ids(op, root=root) for op in payload["ops"]],
        }
    return ids.resolve_op_ids(payload, root=root)


def build_payload(args: argparse.Namespace) -> dict:
    op = args.op
    if op == "dump":
        return {"op": "dump"}
    if op == "route":
        return {"op": "route"}
    if op == "reset":
        return {"op": "reset"}
    if op == "tap":
        return {"op": "tap", "id": args.id}
    if op == "scroll":
        return {"op": "scroll", "id": args.id}
    if op == "exists":
        return {"op": "exists", "id": args.id}
    if op == "prefix":
        return {"op": "prefix", "prefix": args.prefix}
    if op == "goto":
        return {"op": "goto", "to": args.to}
    if op == "seed":
        return {"op": "seed", "to": args.to or "travel-demo"}
    if op == "flow":
        return {"op": "flow", "to": args.to}
    if op == "assert":
        payload: dict[str, Any] = {"op": "assert"}
        if args.id:
            payload["id"] = args.id
        if args.to:
            payload["to"] = args.to
        if args.prefix:
            payload["prefix"] = args.prefix
        if getattr(args, "contains", None):
            payload["contains"] = args.contains
        if getattr(args, "missing", False):
            payload["missing"] = True
        return payload
    if op == "wait":
        payload = {"op": "wait", "timeoutMs": int(args.timeout_ms)}
        if args.id:
            payload["id"] = args.id
        elif args.to:
            payload["to"] = args.to
        elif args.prefix:
            payload["prefix"] = args.prefix
        if args.ms is not None:
            payload["ms"] = int(args.ms)
        return payload
    if op == "batch":
        ops = json.loads(args.ops_json)
        if not isinstance(ops, list) or not ops:
            raise SystemExit("ops must be a non-empty JSON array")
        return {"op": "batch", "ops": ops}
    if op == "overlay":
        return {"op": "overlay", "to": args.to or "toggle"}
    if op == "devmode":
        return {"op": "devmode", "to": args.to or "status"}
    if op == "login":
        # Password only ever comes from the environment (never argv) so it cannot
        # leak through `ps` or a shell history line.
        email = (getattr(args, "email", None) or os.environ.get("ONTRACK_AGENT_ACCOUNT_EMAIL") or "").strip()
        password = os.environ.get("ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED") or ""
        if not email or not password:
            raise SystemExit(
                "login needs ONTRACK_AGENT_ACCOUNT_EMAIL + "
                "ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED (see scripts/lib/agent-credentials.sh)"
            )
        return {"op": "login", "email": email, "password": password}
    if op == "hit":
        payload = {"op": "hit"}
        if getattr(args, "x", None) is not None:
            payload["x"] = args.x
        if getattr(args, "y", None) is not None:
            payload["y"] = args.y
        return payload
    if op == "raw":
        payload = json.loads(args.payload_json)
        if not isinstance(payload, dict):
            raise SystemExit("payload must be a JSON object")
        return payload
    raise SystemExit(f"unknown op {op}")


def parse_batch_args(
    argv: list[str],
    *,
    root: Path | None = None,
    allow_host_ops: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse batch/once/assert flags into (in-app ops, host-side ops).

    Host-side ops (--assert-color, --screenshot) only when allow_host_ops=True
    (once / verify). batch-args JSON mode rejects them.
    """
    ops: list[dict[str, Any]] = []
    host_ops: list[dict[str, Any]] = []
    args = list(argv)
    wait_ms = default_wait_timeout_ms()
    root = root or repo_root()
    ids = _ids()
    while args:
        flag = args.pop(0)
        if flag == "--goto":
            ops.append({"op": "goto", "to": args.pop(0) if args else ""})
        elif flag == "--open":
            # Alias for goto (agent-ui.sh once --open travel).
            ops.append({"op": "goto", "to": args.pop(0) if args else ""})
        elif flag == "--reset":
            ops.append({"op": "reset"})
        elif flag == "--seed":
            ops.append({"op": "seed", "to": args.pop(0) if args else "travel-demo"})
        elif flag == "--flow":
            ops.append({"op": "flow", "to": args.pop(0) if args else ""})
        elif flag == "--tap":
            ops.append(
                {
                    "op": "tap",
                    "id": ids.resolve_test_id(args.pop(0) if args else "", root=root),
                }
            )
        elif flag == "--scroll":
            ops.append(
                {
                    "op": "scroll",
                    "id": ids.resolve_test_id(args.pop(0) if args else "", root=root),
                }
            )
        elif flag in {"--exists", "--assert-exists"}:
            ops.append(
                {
                    "op": "assert",
                    "id": ids.resolve_test_id(args.pop(0) if args else "", root=root),
                }
            )
        elif flag in {"--missing", "--assert-missing"}:
            ops.append(
                {
                    "op": "assert",
                    "id": ids.resolve_test_id(args.pop(0) if args else "", root=root),
                    "missing": True,
                }
            )
        elif flag in {"--assert-route"}:
            ops.append({"op": "assert", "to": args.pop(0) if args else ""})
        elif flag in {"--assert-prefix"}:
            ops.append(
                {
                    "op": "assert",
                    "prefix": ids.resolve_prefix(
                        args.pop(0) if args else "", root=root
                    ),
                }
            )
        elif flag in {"--contains", "--assert-contains"}:
            target_id = ids.resolve_test_id(args.pop(0) if args else "", root=root)
            text = args.pop(0) if args else ""
            ops.append({"op": "assert", "id": target_id, "contains": text})
        elif flag in {"--color", "--assert-color"}:
            if not allow_host_ops:
                raise SystemExit(
                    "unknown arg: --assert-color (use agent-ui.sh once|verify)"
                )
            target_id = ids.resolve_test_id(args.pop(0) if args else "", root=root)
            hex_color = args.pop(0) if args else ""
            tolerance = 55.0
            if args and args[0] in {"--tolerance", "--tol"}:
                args.pop(0)
                tolerance = float(args.pop(0) if args else "55")
            host_ops.append(
                {
                    "op": "color",
                    "id": target_id,
                    "color": hex_color,
                    "tolerance": tolerance,
                }
            )
        elif flag == "--screenshot":
            if not allow_host_ops:
                raise SystemExit(
                    "unknown arg: --screenshot (use agent-ui.sh once|verify)"
                )
            path = args.pop(0) if args and not args[0].startswith("-") else ""
            host_ops.append({"op": "screenshot", "path": path})
        elif flag in {"--wait-prefix"}:
            ops.append(
                {
                    "op": "wait",
                    "prefix": ids.resolve_prefix(
                        args.pop(0) if args else "", root=root
                    ),
                    "timeoutMs": wait_ms,
                }
            )
        elif flag == "--prefix":
            # Bare --prefix is an assert for assert.sh / once chains.
            ops.append(
                {
                    "op": "assert",
                    "prefix": ids.resolve_prefix(
                        args.pop(0) if args else "", root=root
                    ),
                }
            )
        elif flag == "--wait-id":
            ops.append(
                {
                    "op": "wait",
                    "id": ids.resolve_test_id(args.pop(0) if args else "", root=root),
                    "timeoutMs": wait_ms,
                }
            )
        elif flag == "--wait-route":
            ops.append(
                {
                    "op": "wait",
                    "to": args.pop(0) if args else "",
                    "timeoutMs": wait_ms,
                }
            )
        elif flag == "--wait-ms":
            ops.append({"op": "wait", "ms": int(args.pop(0) if args else "80")})
        elif flag == "--dismiss":
            # Best-effort close leftover sheets (optional prefix scope).
            scope = "ontrack."
            if args and not args[0].startswith("-"):
                scope = ids.resolve_prefix(args.pop(0), root=root)
            ops.append({"op": "dismiss", "prefix": scope})
        elif flag == "--dismiss-prefix":
            ops.append(
                {
                    "op": "dismiss",
                    "prefix": ids.resolve_prefix(
                        args.pop(0) if args else "ontrack.", root=root
                    ),
                }
            )
        elif flag == "--route":
            # Probe current route (no match). Prefer --assert-route for checks.
            ops.append({"op": "route"})
        elif flag == "--dump":
            ops.append({"op": "dump"})
        elif flag in {"-h", "--help"}:
            raise SystemExit("usage: batch-args [--goto …]")
        else:
            raise SystemExit(f"unknown arg: {flag}")
    if not ops and not host_ops:
        raise SystemExit("ops must be a non-empty JSON array")
    return ops, host_ops


def run_host_ops(
    host_ops: list[dict[str, Any]],
    *,
    wait_secs: float,
    shared_screenshot: Path | None = None,
) -> list[dict[str, Any]]:
    """Run host-only verification steps (color sample / screenshot)."""
    color = _color()
    results: list[dict[str, Any]] = []
    shot = shared_screenshot
    for hop in host_ops:
        if hop.get("op") == "screenshot":
            path_raw = hop.get("path") or ""
            path = (
                Path(path_raw)
                if path_raw
                else repo_root() / ".tmp" / "agent-ui-verify.png"
            )
            if not path.is_absolute():
                path = repo_root() / path
            color.capture_screenshot(path)
            shot = path
            results.append(
                {
                    "op": "screenshot",
                    "ok": True,
                    "detail": str(path),
                    "path": str(path),
                }
            )
            continue
        if hop.get("op") == "color":
            target_id = str(hop.get("id") or "")
            status = send(
                {"op": "exists", "id": target_id},
                wait_secs=wait_secs,
                allow_fail=True,
            )
            element = status.get("element") or {}
            frame = element.get("frame") if isinstance(element, dict) else None
            screen = status.get("screen") or {}
            scale = float(screen.get("scale") or 0) or 3.0
            if not frame:
                results.append(
                    {
                        "op": "color",
                        "id": target_id,
                        "ok": False,
                        "detail": "element missing or has no frame",
                    }
                )
                continue
            remove_after = False
            if shot is None:
                shot = Path(
                    tempfile.mkstemp(suffix=".png", prefix="agent-ui-color-")[1]
                )
                color.capture_screenshot(shot)
                remove_after = True
            elif not shot.is_file():
                color.capture_screenshot(shot)
            try:
                result = color.assert_element_color(
                    frame=frame,
                    expected_hex=str(hop.get("color") or ""),
                    scale=scale,
                    tolerance=float(hop.get("tolerance") or 55),
                    screenshot_path=shot,
                )
                result["id"] = target_id
                results.append(result)
            finally:
                if remove_after:
                    shot.unlink(missing_ok=True)
                    shot = None
            continue
        results.append(
            {"op": hop.get("op"), "ok": False, "detail": "unknown host op"}
        )
    return results


# Let sheet/route chrome finish painting before a host screenshot (avoids
# mid-open transparency / partial-layout captures on Android).
SCREENSHOT_SETTLE_SECS = float(os.environ.get("AGENT_UI_SCREENSHOT_SETTLE_SECS", "0.45"))


def run_once(argv: list[str], *, wait_secs: float) -> dict[str, Any]:
    """Run a multi-step once chain in one process / one in-app batch."""
    ops, host_ops = parse_batch_args(argv, allow_host_ops=True)
    data: dict[str, Any]
    if ops:
        data = send(
            {"op": "batch", "ops": ops},
            wait_secs=wait_secs,
            allow_fail=True,
            expect_dump=any(op.get("op") == "dump" for op in ops),
        )
    else:
        data = {"ok": True, "op": "batch", "results": [], "route": None}
    if host_ops:
        # Reuse one screenshot across color + --screenshot when both present.
        shared = None
        needs_capture = False
        for hop in host_ops:
            op_name = hop.get("op")
            if op_name in {"screenshot", "color"}:
                needs_capture = True
            if op_name == "screenshot":
                path_raw = hop.get("path") or ""
                shared = (
                    Path(path_raw)
                    if path_raw
                    else repo_root() / ".tmp" / "agent-ui-verify.png"
                )
                if not shared.is_absolute():
                    shared = repo_root() / shared
        if needs_capture and SCREENSHOT_SETTLE_SECS > 0:
            time.sleep(SCREENSHOT_SETTLE_SECS)
        host_results = run_host_ops(
            host_ops, wait_secs=wait_secs, shared_screenshot=shared
        )
        merged = list(data.get("results") or [])
        merged.extend(host_results)
        data = {
            **data,
            "results": merged,
            "ok": bool(data.get("ok")) and all(r.get("ok") for r in host_results),
            "detail": (
                data.get("detail")
                if all(r.get("ok") for r in host_results)
                else "host assert failed"
            ),
        }
    return data


def normalize_route_path(path: str) -> str:
    """Canonicalize pathname for equality checks (query/groups/trailing slash)."""
    # Drop query/hash, Expo group segments like /(tabs), trailing slash.
    p = path.split("?", 1)[0].split("#", 1)[0].strip()
    p = re.sub(r"/\([^/]+\)", "", p)
    p = p.rstrip("/") or "/"
    if not p.startswith("/"):
        p = f"/{p}"
    return p


def route_matches(current: str | None, target: str) -> bool:
    """True only when paths are the same surface (not a parent/child prefix).

    `/travel` must NOT match `/travel/trip-…` — that false positive skipped land
    (or skipped Android cold retry) and forced agents into redo loops.
    """
    if not current:
        return False
    return normalize_route_path(current) == normalize_route_path(target)


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "0").strip().lower() in {"1", "true", "yes", "on"}


def _android_cold_root(current: str | None, route_want: str | None) -> bool:
    """True when Android is on `/` (or unknown) but verify wants another surface."""
    if agent_ui_platform() != "android":
        return False
    if not route_want or route_want in {"/", ""}:
        return False
    return not current or current == "/"


HMR_BEACON_REL = Path("src/utils/dev/metro-hmr-beacon.ts")
HMR_BEACON_RE = re.compile(r"METRO_HMR_BEACON\s*=\s*'([^']+)'")
HMR_BEACON_NS_RE = re.compile(r"(\d+)$")


def hmr_beacon_path(root: Path | None = None) -> Path:
    return (root or repo_root()) / HMR_BEACON_REL


def read_hmr_beacon(root: Path | None = None) -> str | None:
    path = hmr_beacon_path(root)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = HMR_BEACON_RE.search(text)
    return match.group(1) if match else None


def hmr_beacon_ns(value: str | None) -> int:
    """Numeric generation from `metro-hmr-beacon-<time_ns>` (0 if unknown)."""
    if not value:
        return 0
    match = HMR_BEACON_NS_RE.search(value.strip())
    if not match:
        return 0
    try:
        return int(match.group(1))
    except ValueError:
        return 0


def beacon_satisfies(app_beacon: str | None, minimum: str) -> bool:
    """True when the app is on `minimum` or a newer beacon (watcher may re-bump)."""
    return hmr_beacon_ns(app_beacon) >= hmr_beacon_ns(minimum) > 0


def bump_hmr_beacon(root: Path | None = None) -> str:
    """Rewrite the Metro HMR beacon nonce so connected clients must refresh."""
    root = root or repo_root()
    path = hmr_beacon_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    nonce = f"metro-hmr-beacon-{time.time_ns()}"
    path.write_text(
        "// Local Metro watcher probe artifact (gitignored).\n"
        "// Created by scripts/ensure-metro-hmr-beacon.sh; nonce updates by "
        "metro-watcher.sh / agent_ui_bridge ensure_js_fresh (H20).\n"
        f"export const METRO_HMR_BEACON = '{nonce}';\n",
        encoding="utf-8",
    )
    return nonce


def _soft_reconnect_dev_client(root: Path | None = None) -> None:
    """Soft Metro reconnect without taking a new agent-ui lease."""
    root = root or repo_root()
    env = os.environ.copy()
    env["AGENT_UI_SKIP_LEASE"] = "1"
    # Nested soft reconnect must not fight the parent lease holder.
    env.setdefault("AGENT_UI_LOCK_HELD", "1")
    script = f"""
set -euo pipefail
# shellcheck source=/dev/null
source "{root}/scripts/lib/agent-ui-host.sh"
agent_ui_soft_reconnect_dev_client
"""
    subprocess.run(
        ["bash", "-c", script],
        cwd=str(root),
        env=env,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def ensure_js_fresh(
    *,
    root: Path | None = None,
    wait_secs: float | None = None,
    bump: bool | None = None,
) -> dict[str, Any]:
    """Ensure the device JS runtime is at least as new as the HMR beacon (H20).

    Warm Android often keeps a live agent-ui bridge on a stale bundle ("App
    already connected") while iOS cold-reconnects and picks up new testIDs.
    Bump (unless AGENT_UI_EXPECTED_HMR_BEACON is preset), wait for HMR, then
    soft-reconnect once if the app is still behind. Accept app beacons that are
    newer than the minimum — Metro watcher probes may re-bump the file mid-wait.
    """
    root = root or repo_root()
    if _env_flag("AGENT_UI_SKIP_JS_FRESH"):
        return {"ok": True, "skipped": True, "detail": "AGENT_UI_SKIP_JS_FRESH"}

    minimum = (os.environ.get("AGENT_UI_EXPECTED_HMR_BEACON") or "").strip()
    did_bump = False
    if bump is None:
        # Preset env (verify-both parent bump) → wait only; else bump a new nonce.
        bump = not minimum
    if bump:
        minimum = bump_hmr_beacon(root)
        did_bump = True
        os.environ["AGENT_UI_EXPECTED_HMR_BEACON"] = minimum
    elif not minimum:
        minimum = read_hmr_beacon(root) or ""
        if not minimum:
            minimum = bump_hmr_beacon(root)
            did_bump = True
        os.environ["AGENT_UI_EXPECTED_HMR_BEACON"] = minimum

    deadline = float(
        wait_secs
        if wait_secs is not None
        else os.environ.get("AGENT_UI_JS_FRESH_WAIT_SECS", "12")
    )
    poll_wait = min(2.5, max(0.8, deadline / 4))
    platform = agent_ui_platform()
    refreshed = False

    def _app_beacon() -> str | None:
        status = send({"op": "route"}, wait_secs=poll_wait, allow_fail=True)
        raw = status.get("hmrBeacon")
        return raw.strip() if isinstance(raw, str) and raw.strip() else None

    # Give Fast Refresh a short window before forcing a reload.
    hmr_grace = float(os.environ.get("AGENT_UI_JS_FRESH_HMR_GRACE_SECS", "2.5"))
    started = time.time()
    while time.time() - started < hmr_grace:
        got = _app_beacon()
        if beacon_satisfies(got, minimum):
            return {
                "ok": True,
                "hmrBeacon": got,
                "minimum": minimum,
                "bumped": did_bump,
                "refreshed": False,
                "detail": "hmr matched",
            }
        time.sleep(0.35)

    got = _app_beacon()
    if beacon_satisfies(got, minimum):
        return {
            "ok": True,
            "hmrBeacon": got,
            "minimum": minimum,
            "bumped": did_bump,
            "refreshed": False,
            "detail": "hmr matched",
        }

    print(
        f"agent-ui: JS stale on {platform} "
        f"(app hmr={got or '?'} min={minimum}) — soft reconnect…",
        file=sys.stderr,
    )
    _soft_reconnect_dev_client(root)
    refreshed = True
    if platform == "android":
        # Soft reconnect wakes on `/` — verify must not skip land.
        os.environ["AGENT_UI_ANDROID_FORCE_LAND"] = "1"

    match_deadline = time.time() + max(deadline, 8.0)
    while time.time() < match_deadline:
        got = _app_beacon()
        if beacon_satisfies(got, minimum):
            return {
                "ok": True,
                "hmrBeacon": got,
                "minimum": minimum,
                "bumped": did_bump,
                "refreshed": refreshed,
                "detail": "matched after soft reconnect",
            }
        time.sleep(0.45)

    print(
        f"error: agent-ui: JS still stale on {platform} after soft reconnect "
        f"(app hmr={got or '?'} min={minimum})",
        file=sys.stderr,
    )
    return {
        "ok": False,
        "hmrBeacon": got,
        "expected": minimum,
        "minimum": minimum,
        "bumped": did_bump,
        "refreshed": refreshed,
        "detail": "stale after soft reconnect",
    }


def run_verify(argv: list[str], *, wait_secs: float) -> dict[str, Any]:
    """Skip flow/open when already on --route; then assert (+ optional color/shot).

    When --route is set and the device is on another surface, auto-goto that
    route if --flow/--open/--goto was omitted (both platforms). Agents used to
    thrash assert-only retries on whatever tab was left open — especially iOS
    after Profile → Privacy/Terms work.

    Android cold boot / reconnect still wakes on `/`: same auto-goto path, plus
    one land retry if the first pass races JS mount.
    """
    # H20: warm Android bridge ≠ fresh JS. Prove the HMR beacon before asserts.
    fresh = ensure_js_fresh(wait_secs=min(12.0, max(6.0, wait_secs)))
    if not fresh.get("ok"):
        return {
            "ok": False,
            "op": "ensure-js-fresh",
            "detail": fresh.get("detail") or "JS bundle stale",
            "hmrBeacon": fresh.get("hmrBeacon"),
            "expected": fresh.get("expected"),
        }

    args = list(argv)
    route_want: str | None = None
    land_ops: list[dict[str, Any]] = []
    assert_flags: list[str] = []
    # Split landing vs checks. --flow/--open/--goto only run on route miss.
    i = 0
    while i < len(args):
        flag = args[i]
        if flag in {"--route", "--assert-route"} and i + 1 < len(args):
            route_want = args[i + 1]
            assert_flags.extend(["--assert-route", route_want])
            i += 2
            continue
        if flag == "--flow" and i + 1 < len(args):
            land_ops.append({"op": "flow", "to": args[i + 1]})
            i += 2
            continue
        if flag in {"--open", "--goto"} and i + 1 < len(args):
            land_ops.append({"op": "goto", "to": args[i + 1]})
            i += 2
            continue
        assert_flags.append(flag)
        i += 1

    already = False
    current: str | None = None
    cold_root = False
    auto_land = False
    force_land = _env_flag("AGENT_UI_ANDROID_FORCE_LAND")
    if route_want:
        probe = send({"op": "route"}, wait_secs=min(2.5, wait_secs), allow_fail=True)
        current = probe.get("route") if isinstance(probe.get("route"), str) else None
        cold_root = _android_cold_root(current, route_want)
        # Named flows seed fixtures — never skip them just because the route
        # already matches (stale /travel without travel-home seed → assert miss).
        has_flow_land = any(op.get("op") == "flow" for op in land_ops)
        if land_ops:
            already = (
                route_matches(current, route_want)
                and not cold_root
                and not force_land
                and not has_flow_land
            )
        else:
            # No explicit land — skip only when already on the wanted surface.
            already = route_matches(current, route_want) and not force_land
            if not already:
                # Assert-only on a wrong tab forces redo loops; auto-goto once.
                reason = (
                    f"Android on {current or '?'} after cold boot"
                    if cold_root
                    else f"on {current or '?'}"
                )
                print(
                    f"verify: {reason} — auto-landing via goto {route_want}",
                    file=sys.stderr,
                )
                land_ops.append({"op": "goto", "to": route_want})
                auto_land = True
                already = False
        if force_land and land_ops and not auto_land:
            already = False
            print(
                "verify: Android force-land (post reconnect) — not skipping flow/open",
                file=sys.stderr,
            )

    chain: list[str] = []
    if land_ops and not already:
        for lop in land_ops:
            if lop["op"] == "flow":
                chain.extend(["--flow", str(lop["to"])])
            else:
                chain.extend(["--open", str(lop["to"])])
        # Wait for navigation before asserts race the mount (both platforms).
        if route_want:
            chain.extend(["--wait-route", route_want])
    elif already:
        # Cheap settle — no flow/seed.
        pass
    chain.extend(assert_flags)
    if not chain:
        raise SystemExit("verify requires --route and/or asserts")

    data = run_once(chain, wait_secs=wait_secs)

    # Cold boot land often races JS mount (batch allow_fail → assert on route=/).
    # Retry land+assert once with the Android cold-flow budget.
    if (
        land_ops
        and not already
        and route_want
        and agent_ui_platform() == "android"
        and not route_matches(
            data.get("route") if isinstance(data.get("route"), str) else None,
            route_want,
        )
    ):
        retry_wait = max(
            wait_secs,
            float(os.environ.get("AGENT_UI_ANDROID_COLD_FLOW_WAIT_SECS", "20")),
        )
        print(
            f"verify: Android land missed (route={data.get('route') or '?'}) — "
            f"retrying land (wait={retry_wait}s)…",
            file=sys.stderr,
        )
        time.sleep(1.5)
        data = run_once(chain, wait_secs=retry_wait)

    if already:
        data = {**data, "skippedLand": True, "detail": data.get("detail") or "already on route"}
    elif cold_root or force_land:
        data = {
            **data,
            "coldLand": True,
            "detail": data.get("detail") or "landed after Android cold boot",
        }
    elif auto_land:
        data = {
            **data,
            "autoLand": True,
            "detail": data.get("detail") or "auto-landed via goto",
        }
    return data


def main(argv: list[str] | None = None) -> int:
    # Ensure sibling daemon import works when invoked as a script path.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

    parser = argparse.ArgumentParser(description="agent-ui host bridge")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_data = sub.add_parser("data-dir", help="print cached/resolved data container")
    p_data.add_argument("--refresh", action="store_true", help="ignore cache")

    p_send = sub.add_parser("send", help="send an op and print status JSON")
    p_send.add_argument("--op", required=True)
    p_send.add_argument("--id")
    p_send.add_argument("--prefix")
    p_send.add_argument("--to")
    p_send.add_argument("--email")
    p_send.add_argument("--x", type=float)
    p_send.add_argument("--y", type=float)
    p_send.add_argument("--contains")
    p_send.add_argument("--missing", action="store_true")
    p_send.add_argument(
        "--timeout-ms", type=int, default=default_wait_timeout_ms()
    )
    p_send.add_argument("--ms", type=int)
    p_send.add_argument("--ops-json")
    p_send.add_argument("--payload-json")
    p_send.add_argument(
        "--wait-secs",
        type=float,
        default=float(os.environ.get("WAIT_SECS", "6")),
    )
    p_send.add_argument("--allow-fail", action="store_true")
    p_send.add_argument("--expect-dump", action="store_true")

    p_batch = sub.add_parser(
        "batch-args", help="parse batch.sh flags into a JSON ops array"
    )
    p_batch.add_argument("flags", nargs=argparse.REMAINDER)

    p_once = sub.add_parser(
        "once",
        help="run a multi-step once chain in one process (one in-app batch)",
    )
    p_once.add_argument(
        "--wait-secs",
        type=float,
        default=float(os.environ.get("WAIT_SECS", "5")),
    )
    p_once.add_argument("flags", nargs=argparse.REMAINDER)

    p_verify = sub.add_parser(
        "verify",
        help="assert on current surface; skip --flow/--open when already on --route",
    )
    p_verify.add_argument(
        "--wait-secs",
        type=float,
        default=float(os.environ.get("WAIT_SECS", "5")),
    )
    p_verify.add_argument("flags", nargs=argparse.REMAINDER)

    p_resolve = sub.add_parser("resolve-id", help="resolve AgentUiIds key path → wire id")
    p_resolve.add_argument("id")

    p_warm = sub.add_parser("warm", help="exit 0 when daemon is healthy and recently used")
    p_warm.add_argument("--max-age", type=float, default=30.0)

    p_ensure = sub.add_parser("ensure-daemon", help="start daemon if needed")

    p_pin = sub.add_parser(
        "write-slot-pin",
        help="write iOS Documents/agent-ui-pin.json for AGENT_UI_SLOT (Android no-op)",
    )

    p_js = sub.add_parser(
        "ensure-js-fresh",
        help="bump/wait Metro HMR beacon so warm Android is not on a stale bundle (H20)",
    )
    p_js.add_argument(
        "--no-bump",
        action="store_true",
        help="wait for AGENT_UI_EXPECTED_HMR_BEACON or the current on-disk beacon",
    )
    p_js.add_argument(
        "--wait-secs",
        type=float,
        default=float(os.environ.get("AGENT_UI_JS_FRESH_WAIT_SECS", "12")),
    )
    p_js.add_argument(
        "--bump-only",
        action="store_true",
        help="rewrite the beacon file and print the nonce (no device wait)",
    )

    args = parser.parse_args(argv)
    root = repo_root()

    if args.cmd == "write-slot-pin":
        ok = write_slot_pin_file()
        print(json.dumps({"ok": ok, "slot": agent_ui_slot()}, separators=(",", ":")))
        return 0 if ok else 1

    if args.cmd == "ensure-js-fresh":
        if args.bump_only:
            nonce = bump_hmr_beacon(root)
            print(nonce)
            return 0
        data = ensure_js_fresh(
            root=root,
            wait_secs=args.wait_secs,
            bump=not args.no_bump,
        )
        print(json.dumps(data, separators=(",", ":")))
        return 0 if data.get("ok") else 1

    if args.cmd == "data-dir":
        if args.refresh:
            cache = root / CACHE_REL
            cache.unlink(missing_ok=True)
            os.environ.pop("AGENT_UI_DATA_DIR", None)
        print(resolve_data_dir(root))
        return 0

    if args.cmd == "batch-args":
        flags = list(args.flags)
        if flags and flags[0] == "--":
            flags = flags[1:]
        ops, _host = parse_batch_args(flags, allow_host_ops=False)
        print(json.dumps(ops, separators=(",", ":")))
        return 0

    if args.cmd == "once":
        flags = list(args.flags)
        if flags and flags[0] == "--":
            flags = flags[1:]
        data = run_once(flags, wait_secs=args.wait_secs)
        print(json.dumps(data, indent=2))
        return 0 if data.get("ok") else 1

    if args.cmd == "verify":
        flags = list(args.flags)
        if flags and flags[0] == "--":
            flags = flags[1:]
        data = run_verify(flags, wait_secs=args.wait_secs)
        print(json.dumps(data, indent=2))
        return 0 if data.get("ok") else 1

    if args.cmd == "resolve-id":
        print(_ids().resolve_test_id(args.id, root=root))
        return 0

    if args.cmd == "warm":
        daemon = _daemon()
        warm = daemon.is_warm(args.max_age, root) and daemon.health_http()
        print(json.dumps({"ok": True, "warm": warm}, separators=(",", ":")))
        return 0 if warm else 1

    if args.cmd == "ensure-daemon":
        ok = _daemon().ensure_daemon(root)
        print(json.dumps({"ok": ok}, separators=(",", ":")))
        return 0 if ok else 1

    payload = build_payload(args)
    expect_dump = bool(args.expect_dump or payload.get("op") == "dump")
    allow_fail = bool(
        args.allow_fail
        or payload.get("op") in {"exists", "prefix", "route", "assert", "login"}
    )
    data = send(
        payload,
        wait_secs=args.wait_secs,
        allow_fail=allow_fail,
        expect_dump=expect_dump,
    )
    print(json.dumps(data, separators=(",", ":")))
    if payload.get("op") in {"assert", "login"}:
        return 0 if data.get("ok") else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
