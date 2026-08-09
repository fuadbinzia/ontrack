#!/usr/bin/env python3
"""Persistent agent-ui bridge daemon.

Hosts talk over a Unix socket (or HTTP). The app long-polls HTTP /next and
POSTs /status. Metro can proxy /__agent_ui/* here for physical devices.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

DEFAULT_HTTP_PORT = int(os.environ.get("AGENT_UI_HTTP_PORT", "8191"))


def _slot_port_count() -> int:
    """Match AGENT_UI_POOL_HARD_MAX (exported by agent-ui-pool.sh). Default 2."""
    raw = (os.environ.get("AGENT_UI_POOL_HARD_MAX") or "2").strip()
    try:
        n = int(raw)
    except ValueError:
        return 2
    return max(1, min(n, 8))


SOCK_NAME = "agent-ui.sock"
PID_NAME = "agent-ui-daemon.pid"
LOG_NAME = "agent-ui-daemon.log"
LAST_OK_NAME = "agent-ui-last-ok"
CODE_HASH_NAME = "agent-ui-daemon.code-hash"


def repo_root() -> Path:
    env = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
    if env:
        root = Path(env)
        if (root / "scripts" / "ensure-packager.sh").is_file():
            return root
    return Path(__file__).resolve().parents[2]


def cursor_dir(root: Path | None = None) -> Path:
    d = (root or repo_root()) / ".cursor"
    d.mkdir(parents=True, exist_ok=True)
    return d


def normalize_platform(raw: Any) -> str:
    """Host/app platform pin: ios | android (default ios)."""
    if raw is None:
        return "ios"
    text = str(raw).strip().lower()
    if text in {"android", "ios"}:
        return text
    # RN sometimes reports "macos"/"web" — treat non-android as ios for pin.
    if text in {"macos", "web", "windows"}:
        return "ios"
    return "ios"


def normalize_slot(raw: Any) -> str | None:
    """Optional agent device pool slot (1…N) for parallel hosts."""
    if raw is None or raw is False:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        n = int(text)
    except (TypeError, ValueError):
        return None
    if n < 1 or n > 32:
        return None
    return str(n)


def command_index_for_device(
    queue: list[dict[str, Any]], device: str | None
) -> int | None:
    """Index of the first command this device may run, or None.

    A pool slot and the user's headed simulator share one daemon, so a command
    addressed to a named device waits for that device instead of being consumed
    by whoever polls first. Unaddressed commands stay first-come (legacy hosts).
    """
    want = (device or "").strip()
    for index, cmd in enumerate(queue):
        addressed = str(cmd.get("iosDeviceName") or "").strip()
        if not addressed or not want or addressed == want:
            return index
    return None


def queue_key(platform: str, slot: str | None = None) -> str:
    """Daemon FIFO key — platform, or platform:slot when a pool slot is set."""
    pin = normalize_platform(platform)
    slot_id = normalize_slot(slot)
    if slot_id:
        return f"{pin}:{slot_id}"
    return pin


# Cap in-flight commands per platform/slot so a runaway host cannot OOM the daemon.
MAX_PENDING_PER_PLATFORM = 32
# Retain completed statuses briefly so late waiters / retries can still match.
MAX_STATUS_BY_NONCE = 64


class BridgeState:
    def __init__(self) -> None:
        # RLock: enqueue notifies both command + status waiters without deadlock.
        self._lock = threading.RLock()
        # FIFO per platform (or platform:slot) — never overwrite an in-flight command.
        self.pending_by_platform: dict[str, list[dict[str, Any]]] = {}
        self.command_seq = 0
        self.command_cv = threading.Condition(self._lock)
        # Status keyed by nonce so iOS + Android (or back-to-back ops) do not
        # clobber each other's waiters.
        self.status_by_nonce: dict[int, dict[str, Any]] = {}
        self.status_order: list[int] = []
        self.last_status: dict[str, Any] | None = None
        self.status_nonce: int | None = None
        self.status_cv = threading.Condition(self._lock)
        self._nonce_seq = 0

    def _next_nonce(self) -> int:
        # Keep nonces inside JS Number.MAX_SAFE_INTEGER so the app can echo them.
        self._nonce_seq = (self._nonce_seq + 1) % 9_000_000_000_000_000
        return int(time.time() * 1000) * 1_000 + self._nonce_seq

    def enqueue(self, payload: dict[str, Any]) -> int:
        with self.command_cv:
            body = dict(payload)
            platform = normalize_platform(body.get("platform"))
            body["platform"] = platform
            slot = normalize_slot(body.get("slot"))
            if slot:
                body["slot"] = int(slot)
            else:
                body.pop("slot", None)
            raw = body.get("nonce")
            try:
                nonce = int(raw) if raw is not None else self._next_nonce()
            except (TypeError, ValueError):
                nonce = self._next_nonce()
            if nonce >= 9_007_199_254_740_991:  # Number.MAX_SAFE_INTEGER
                nonce = self._next_nonce()
            body["nonce"] = nonce
            key = queue_key(platform, slot)
            queue = self.pending_by_platform.setdefault(key, [])
            if len(queue) >= MAX_PENDING_PER_PLATFORM:
                # Drop oldest — host will time out; prefer fresh commands.
                queue.pop(0)
            queue.append(body)
            self.command_seq += 1
            self.status_nonce = nonce
            self.command_cv.notify_all()
            with self.status_cv:
                self.status_cv.notify_all()
            return nonce

    def take_command(
        self,
        wait_ms: int,
        platform: str | None = None,
        slot: str | None = None,
        device: str | None = None,
    ) -> dict[str, Any] | None:
        key = queue_key(platform, slot)
        deadline = time.time() + max(0, wait_ms) / 1000.0
        with self.command_cv:
            while True:
                queue = self.pending_by_platform.get(key) or []
                index = command_index_for_device(queue, device)
                if index is not None:
                    cmd = queue.pop(index)
                    if not queue:
                        self.pending_by_platform.pop(key, None)
                    return cmd
                remaining = deadline - time.time()
                if remaining <= 0:
                    return None
                self.command_cv.wait(timeout=remaining)

    def publish_status(self, status: dict[str, Any]) -> None:
        with self.status_cv:
            self.last_status = status
            raw = status.get("nonce")
            try:
                nonce = int(raw) if raw is not None else None
            except (TypeError, ValueError):
                nonce = None
            if nonce is not None:
                if nonce not in self.status_by_nonce:
                    self.status_order.append(nonce)
                self.status_by_nonce[nonce] = status
                self.status_nonce = nonce
                while len(self.status_order) > MAX_STATUS_BY_NONCE:
                    old = self.status_order.pop(0)
                    self.status_by_nonce.pop(old, None)
            self.status_cv.notify_all()

    def wait_status(self, nonce: int | None, wait_secs: float) -> dict[str, Any] | None:
        deadline = time.time() + max(0.05, wait_secs)
        with self.status_cv:
            while True:
                if nonce is not None:
                    hit = self.status_by_nonce.get(int(nonce))
                    if hit is not None:
                        return hit
                elif self.last_status is not None:
                    return self.last_status
                remaining = deadline - time.time()
                if remaining <= 0:
                    if nonce is not None:
                        return self.status_by_nonce.get(int(nonce))
                    return self.last_status
                self.status_cv.wait(timeout=remaining)

    # Back-compat for handlers that still read STATE.status.
    @property
    def status(self) -> dict[str, Any] | None:
        return self.last_status


STATE = BridgeState()


def write_last_ok(root: Path | None = None) -> None:
    path = cursor_dir(root) / LAST_OK_NAME
    path.write_text(f"{time.time():.3f}\n", encoding="utf-8")


def read_last_ok(root: Path | None = None) -> float | None:
    path = cursor_dir(root) / LAST_OK_NAME
    if not path.is_file():
        return None
    try:
        return float(path.read_text(encoding="utf-8").strip())
    except ValueError:
        return None


def is_warm(max_age_secs: float = 30.0, root: Path | None = None) -> bool:
    ts = read_last_ok(root)
    if ts is None:
        return False
    return (time.time() - ts) <= max_age_secs


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep daemon stdout quiet; optional file log is enough.
        return

    def slot_from_port(self) -> str | None:
        """Slot implied by the listening port (DEFAULT_HTTP_PORT + N → slot N)."""
        try:
            port = int(self.server.server_address[1])
        except (AttributeError, IndexError, TypeError, ValueError):
            return None
        offset = port - DEFAULT_HTTP_PORT
        if offset <= 0:
            return None
        return normalize_slot(offset)

    def _read_json(self) -> Any:
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _send(self, code: int, payload: Any | None = None) -> None:
        body = b"" if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        if path in {"/health", "/__agent_ui/health"}:
            self._send(200, {"ok": True, "service": "agent-ui-daemon"})
            return

        if path in {"/next", "/__agent_ui/next"}:
            wait_ms = int((qs.get("waitMs") or ["5000"])[0])
            platform = (qs.get("platform") or [None])[0]
            slot = (qs.get("slot") or [None])[0]
            device = (qs.get("device") or [None])[0]
            if normalize_slot(slot) is None:
                slot = self.slot_from_port() or slot  # H17
            cmd = STATE.take_command(
                wait_ms, platform=platform, slot=slot, device=device
            )
            if cmd is None:
                self._send(204)
                return
            self._send(200, cmd)
            return

        if path in {"/status", "/__agent_ui/status"}:
            wait_ms = int((qs.get("waitMs") or ["0"])[0])
            nonce_raw = (qs.get("nonce") or [None])[0]
            nonce = int(nonce_raw) if nonce_raw not in (None, "") else None
            if wait_ms > 0:
                status = STATE.wait_status(nonce, wait_ms / 1000.0)
            else:
                with STATE.status_cv:
                    if nonce is not None:
                        status = STATE.status_by_nonce.get(nonce)
                    else:
                        status = STATE.last_status
            if status is None:
                self._send(204)
                return
            self._send(200, status)
            return

        if path in {"/warm", "/__agent_ui/warm"}:
            self._send(200, {"ok": True, "warm": is_warm()})
            return

        self._send(404, {"ok": False, "detail": f"unknown path {path}"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            self._send(400, {"ok": False, "detail": "invalid JSON"})
            return

        if path in {"/command", "/__agent_ui/command"}:
            if not isinstance(body, dict):
                self._send(400, {"ok": False, "detail": "command must be object"})
                return
            nonce = STATE.enqueue(body)
            self._send(200, {"ok": True, "queued": True, "nonce": nonce})
            return

        if path in {"/status", "/__agent_ui/status"}:
            if not isinstance(body, dict):
                self._send(400, {"ok": False, "detail": "status must be object"})
                return
            # Attach nonce from pending wait if client omitted it.
            if "nonce" not in body and STATE.status_nonce is not None:
                body = {**body, "nonce": STATE.status_nonce}
            STATE.publish_status(body)
            if body.get("ok"):
                write_last_ok()
            self._send(200, {"ok": True})
            return

        self._send(404, {"ok": False, "detail": f"unknown path {path}"})


def handle_unix_client(conn: socket.socket) -> None:
    try:
        data = b""
        while not data.endswith(b"\n"):
            chunk = conn.recv(65536)
            if not chunk:
                break
            data += chunk
        if not data:
            return
        req = json.loads(data.decode("utf-8"))
        action = req.get("action")
        if action == "health":
            conn.sendall(b'{"ok":true}\n')
            return
        if action == "warm":
            conn.sendall(
                json.dumps({"ok": True, "warm": is_warm()}, separators=(",", ":")).encode()
                + b"\n"
            )
            return
        if action == "send":
            payload = req.get("payload")
            if not isinstance(payload, dict):
                conn.sendall(b'{"ok":false,"detail":"payload required"}\n')
                return
            wait_secs = float(req.get("waitSecs") or 6)
            allow_fail = bool(req.get("allowFail"))
            nonce = STATE.enqueue(payload)
            status = STATE.wait_status(nonce, wait_secs)
            if status is None:
                conn.sendall(
                    json.dumps(
                        {
                            "ok": False,
                            "op": payload.get("op"),
                            "detail": f"timed out after {wait_secs}s",
                        },
                        separators=(",", ":"),
                    ).encode()
                    + b"\n"
                )
                return
            ok = bool(status.get("ok"))
            if ok:
                write_last_ok()
            if not ok and not allow_fail:
                conn.sendall(json.dumps(status, separators=(",", ":")).encode() + b"\n")
                return
            conn.sendall(json.dumps(status, separators=(",", ":")).encode() + b"\n")
            return
        conn.sendall(b'{"ok":false,"detail":"unknown action"}\n')
    except Exception as exc:  # noqa: BLE001 — surface to client
        try:
            conn.sendall(
                json.dumps({"ok": False, "detail": str(exc)}, separators=(",", ":")).encode()
                + b"\n"
            )
        except OSError:
            pass
    finally:
        try:
            conn.close()
        except OSError:
            pass


def serve_unix(sock_path: Path, stop: threading.Event) -> None:
    if sock_path.exists():
        sock_path.unlink()
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(str(sock_path))
    server.listen(32)
    server.settimeout(0.5)
    sock_path.chmod(0o600)
    while not stop.is_set():
        try:
            conn, _ = server.accept()
        except socket.timeout:
            continue
        except OSError:
            break
        threading.Thread(target=handle_unix_client, args=(conn,), daemon=True).start()
    try:
        server.close()
    except OSError:
        pass
    if sock_path.exists():
        sock_path.unlink(missing_ok=True)


def serve(http_port: int = DEFAULT_HTTP_PORT) -> None:
    root = repo_root()
    cdir = cursor_dir(root)
    sock_path = cdir / SOCK_NAME
    pid_path = cdir / PID_NAME
    log_path = cdir / LOG_NAME

    pid_path.write_text(f"{os.getpid()}\n", encoding="utf-8")
    log_path.write_text(f"agent-ui daemon starting pid={os.getpid()} port={http_port}\n", encoding="utf-8")

    stop = threading.Event()

    def _shutdown(*_args: Any) -> None:
        stop.set()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    unix_thread = threading.Thread(target=serve_unix, args=(sock_path, stop), daemon=True)
    unix_thread.start()

    # 0.0.0.0 required: adb reverse's host-side connect is not from loopback.
    servers: list[ThreadingHTTPServer] = []
    for port in [http_port] + [
        http_port + n for n in range(1, _slot_port_count() + 1)
    ]:
        try:
            server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
        except OSError:
            if port == http_port:
                raise
            continue
        server.daemon_threads = True
        server.allow_reuse_address = True
        servers.append(server)

    with log_path.open("a", encoding="utf-8") as log:
        ports = ",".join(str(s.server_address[1]) for s in servers)
        log.write(f"listening http://0.0.0.0:{{{ports}}} sock={sock_path}\n")

    http_threads = [
        threading.Thread(
            target=s.serve_forever, kwargs={"poll_interval": 0.2}, daemon=True
        )
        for s in servers
    ]
    for thread in http_threads:
        thread.start()
    try:
        while not stop.is_set():
            time.sleep(0.2)
    finally:
        stop.set()
        for server in servers:
            server.shutdown()
            server.server_close()
        pid_path.unlink(missing_ok=True)
        if sock_path.exists():
            sock_path.unlink(missing_ok=True)


def health_http(port: int = DEFAULT_HTTP_PORT, timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout) as sock:
            sock.sendall(
                b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
            )
            data = sock.recv(1024)
            return b"200" in data and b"agent-ui-daemon" in data
    except OSError:
        return False


def daemon_code_fingerprint() -> str:
    """Short hash of host bridge modules — used to auto-restart stale daemons."""
    import hashlib

    digest = hashlib.sha256()
    lib = Path(__file__).resolve().parent
    for name in ("agent_ui_daemon.py", "agent_ui_bridge.py", "agent_ui_color.py"):
        path = lib / name
        if path.is_file():
            digest.update(path.read_bytes())
            digest.update(b"\0")
    return digest.hexdigest()[:20]


def write_code_hash(root: Path | None = None, fingerprint: str | None = None) -> None:
    path = cursor_dir(root) / CODE_HASH_NAME
    path.write_text(f"{fingerprint or daemon_code_fingerprint()}\n", encoding="utf-8")


def read_code_hash(root: Path | None = None) -> str | None:
    path = cursor_dir(root) / CODE_HASH_NAME
    if not path.is_file():
        return None
    try:
        return path.read_text(encoding="utf-8").strip() or None
    except OSError:
        return None


def stop_daemon(root: Path | None = None) -> None:
    """Best-effort stop of a previously ensure'd daemon (code upgrades)."""
    root = root or repo_root()
    pid_path = cursor_dir(root) / PID_NAME
    if not pid_path.is_file():
        return
    try:
        pid = int(pid_path.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        pid_path.unlink(missing_ok=True)
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        pass
    pid_path.unlink(missing_ok=True)
    # Give the port a moment to free.
    for _ in range(30):
        if not health_http():
            break
        time.sleep(0.02)


def ensure_daemon(
    root: Path | None = None,
    port: int = DEFAULT_HTTP_PORT,
    *,
    restart: bool = False,
) -> bool:
    root = root or repo_root()
    fingerprint = daemon_code_fingerprint()
    cached = read_code_hash(root)
    stale = cached is not None and cached != fingerprint
    if restart or stale:
        if stale and not restart:
            print(
                "agent-ui: daemon code changed — restarting bridge daemon",
                file=sys.stderr,
            )
        stop_daemon(root)
    elif health_http(port):
        if cached is None:
            write_code_hash(root, fingerprint)
        return True
    daemon_py = Path(__file__).resolve()
    log_path = cursor_dir(root) / LOG_NAME
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as log:
        proc = subprocess_popen_daemon(daemon_py, port, root, log)
    _ = proc
    # Wait briefly for listen.
    for _ in range(50):
        if health_http(port):
            write_code_hash(root, fingerprint)
            return True
        time.sleep(0.02)
    ok = health_http(port)
    if ok:
        write_code_hash(root, fingerprint)
    return ok


def subprocess_popen_daemon(
    daemon_py: Path,
    port: int,
    root: Path,
    log: Any,
) -> Any:
    import subprocess

    env = os.environ.copy()
    env["AGENT_UI_ROOT"] = str(root)
    env["AGENT_UI_HTTP_PORT"] = str(port)
    return subprocess.Popen(
        [sys.executable, str(daemon_py), "serve", "--port", str(port)],
        cwd=str(root),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def unix_send(
    payload: dict[str, Any],
    *,
    wait_secs: float,
    allow_fail: bool,
    root: Path | None = None,
) -> dict[str, Any]:
    root = root or repo_root()
    sock_path = cursor_dir(root) / SOCK_NAME
    req = {
        "action": "send",
        "payload": payload,
        "waitSecs": wait_secs,
        "allowFail": allow_fail,
    }
    line = json.dumps(req, separators=(",", ":")).encode("utf-8") + b"\n"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.settimeout(max(1.0, wait_secs + 1.0))
        sock.connect(str(sock_path))
        sock.sendall(line)
        data = b""
        while not data.endswith(b"\n"):
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
    if not data:
        raise RuntimeError("daemon closed connection")
    return json.loads(data.decode("utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="agent-ui daemon")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve")
    p_serve.add_argument("--port", type=int, default=DEFAULT_HTTP_PORT)

    sub.add_parser("health")
    p_ensure = sub.add_parser("ensure")
    p_ensure.add_argument("--port", type=int, default=DEFAULT_HTTP_PORT)
    p_ensure.add_argument(
        "--restart",
        action="store_true",
        help="Kill any existing daemon before starting (after host code changes).",
    )
    p_warm = sub.add_parser("warm")
    p_warm.add_argument("--max-age", type=float, default=30.0)
    sub.add_parser("stop")

    args = parser.parse_args(argv)
    if args.cmd == "serve":
        serve(args.port)
        return 0
    if args.cmd == "health":
        ok = health_http()
        print(json.dumps({"ok": ok}))
        return 0 if ok else 1
    if args.cmd == "stop":
        stop_daemon()
        print(json.dumps({"ok": True, "stopped": True}))
        return 0
    if args.cmd == "ensure":
        ok = ensure_daemon(port=args.port, restart=bool(args.restart))
        print(json.dumps({"ok": ok}))
        return 0 if ok else 1
    if args.cmd == "warm":
        warm = is_warm(args.max_age) and health_http()
        print(json.dumps({"ok": True, "warm": warm}))
        return 0 if warm else 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
