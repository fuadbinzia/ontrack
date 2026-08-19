#!/usr/bin/env bash
# Metro / Watchman liveness helpers for onTrack.
# Sourced by ensure-packager.sh and start-metro.sh — not meant to be executed alone.
#
# Healthy Fast Refresh on this repo needs:
#   1) expo-router/entry resolves (Node crawl; node_modules ignored by Watchman)
#   2) Watchman metro-file-map subscription attached
#   3) A src edit advances that subscription (or is observed in Metro logs)

: "${ROOT:?ROOT must be set before sourcing metro-watcher.sh}"
: "${METRO_PORT:=8081}"
: "${LSOF_BIN:=$(command -v lsof 2>/dev/null || true)}"
if [[ -z "$LSOF_BIN" && -x /usr/sbin/lsof ]]; then
  LSOF_BIN=/usr/sbin/lsof
fi
: "${LSOF_BIN:=lsof}"

METRO_WATCHER_PROBE_FILE="${METRO_WATCHER_PROBE_FILE:-$ROOT/src/utils/dev/metro-hmr-beacon.ts}"
METRO_WATCHER_PROBE_WAIT_SECS="${METRO_WATCHER_PROBE_WAIT_SECS:-6}"
METRO_LOG="${METRO_LOG:-$ROOT/.cursor/metro-ensure.log}"
METRO_WATCHMAN_REQUIRED_CAPS="${METRO_WATCHMAN_REQUIRED_CAPS:-field-content.sha1hex relative_root suffix-set wildmatch}"

# Gitignored probe file — create a stable stub so Metro/tsc can resolve the import.
ensure_metro_hmr_beacon_probe_file() {
  METRO_WATCHER_PROBE_FILE="$METRO_WATCHER_PROBE_FILE" \
    "$ROOT/scripts/ensure-metro-hmr-beacon.sh"
}

watchman_bin() {
  command -v watchman 2>/dev/null || true
}

# Watchman stores state under $XDG_STATE_HOME/watchman (default ~/.local/state).
# That parent is sometimes root-owned, so mkdir fails and Metro heals forever.
ensure_watchman_state_home() {
  local default_dir="${HOME}/.local/state/watchman"
  if mkdir -p "$default_dir" 2>/dev/null; then
    return 0
  fi
  local fallback="${ONTRACK_WATCHMAN_STATE_HOME:-${HOME}/.cursor/watchman-state}"
  if ! mkdir -p "$fallback"; then
    echo "error: cannot create Watchman state dir (${default_dir} unwritable, ${fallback} failed)" >&2
    return 1
  fi
  export XDG_STATE_HOME="$fallback"
  echo "note: ${default_dir} is not writable — Watchman state → ${fallback}" >&2
}

ensure_watchman_state_home || true

ensure_watchman_project() {
  local bin
  bin="$(watchman_bin)"
  if [[ -z "$bin" ]]; then
    echo "error: watchman is required for Metro live updates (brew install watchman)" >&2
    return 1
  fi
  if ! "$bin" watch-project "$ROOT" >/dev/null 2>&1; then
    "$bin" watch-del "$ROOT" >/dev/null 2>&1 || true
    if ! "$bin" watch-project "$ROOT" >/dev/null 2>&1; then
      echo "error: could not establish watchman watch for ${ROOT}" >&2
      return 1
    fi
  fi
  return 0
}

watchman_capabilities_ready() {
  local bin raw
  bin="$(watchman_bin)"
  [[ -n "$bin" ]] || return 1
  raw="$("$bin" list-capabilities --output-encoding=json --no-pretty --no-spawn 2>/dev/null || true)"
  [[ -n "$raw" ]] || return 1
  REQUIRED_CAPS="$METRO_WATCHMAN_REQUIRED_CAPS" python3 -c '
import json, os, sys
try:
    data = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
have = set(data.get("capabilities") or [])
need = [c for c in os.environ.get("REQUIRED_CAPS", "").split() if c]
raise SystemExit(0 if all(c in have for c in need) else 1)
' <<<"$raw"
}

wait_for_watchman() {
  local bin deadline
  bin="$(watchman_bin)"
  [[ -n "$bin" ]] || return 1
  deadline=$((SECONDS + 20))
  while (( SECONDS < deadline )); do
    if "$bin" version >/dev/null 2>&1 && "$bin" watch-project "$ROOT" >/dev/null 2>&1; then
      if watchman_capabilities_ready; then
        return 0
      fi
    fi
    sleep 0.25
  done
  return 1
}

reset_watchman_project() {
  local bin
  bin="$(watchman_bin)"
  [[ -n "$bin" ]] || return 0
  echo "Resetting Watchman crawl for ${ROOT}…"
  "$bin" watch-del "$ROOT" >/dev/null 2>&1 || true
  if [[ "${METRO_WATCHER_HARD_RESET:-0}" == "1" ]]; then
    echo "Hard-resetting Watchman server…"
    "$bin" shutdown-server >/dev/null 2>&1 || true
    sleep 0.5
  fi
  if ! wait_for_watchman; then
    echo "error: Watchman did not become ready after reset" >&2
    return 1
  fi
}

metro_listen_pids() {
  "$LSOF_BIN" -nP -iTCP:"${METRO_PORT}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
}

metro_has_watchman_client() {
  local bin json listen_pids
  bin="$(watchman_bin)"
  [[ -n "$bin" ]] || return 1
  listen_pids="$(metro_listen_pids | tr '\n' ' ')"
  [[ -n "${listen_pids// /}" ]] || return 1
  json="$("$bin" debug-get-subscriptions "$ROOT" 2>/dev/null || true)"
  [[ -n "$json" ]] || return 1
  LISTEN_PIDS="$listen_pids" python3 -c '
import json, os, sys
try:
    data = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
listen = {int(p) for p in os.environ.get("LISTEN_PIDS", "").split() if p.isdigit()}
for sub in data.get("subscribers") or []:
    info = sub.get("info") or {}
    name = info.get("name") or ""
    pid = info.get("pid")
    if name.startswith("metro-file-map-") and isinstance(pid, int) and pid in listen:
        raise SystemExit(0)
raise SystemExit(1)
' <<<"$json"
}

metro_entry_resolves() {
  local code body
  body="$(mktemp -t ontrack-metro-entry.XXXXXX)"
  code="$(curl -s -o "$body" -w '%{http_code}' --connect-timeout 2 --max-time 45 \
    "http://127.0.0.1:${METRO_PORT}/node_modules/expo-router/entry.bundle?platform=ios&dev=true&minify=false" \
    || true)"
  if [[ "$code" != "200" ]]; then
    rm -f "$body"
    return 1
  fi
  if python3 -c '
import sys
t=open(sys.argv[1],"rb").read(800).decode("utf-8","replace")
raise SystemExit(1 if ("Unable to resolve" in t or "UnableToResolveError" in t) else 0)
' "$body"; then
    rm -f "$body"
    return 0
  fi
  rm -f "$body"
  return 1
}

metro_subscription_since() {
  local bin json
  bin="$(watchman_bin)"
  [[ -n "$bin" ]] || return 1
  json="$("$bin" debug-get-subscriptions "$ROOT" 2>/dev/null || true)"
  [[ -n "$json" ]] || return 1
  python3 -c '
import json,sys
try:
  d=json.load(sys.stdin)
except Exception:
  raise SystemExit(1)
for s in d.get("subscribers") or []:
  info=s.get("info") or {}
  if str(info.get("name","")).startswith("metro-file-map-"):
    since=(info.get("query") or {}).get("since")
    if since:
      print(since)
      raise SystemExit(0)
raise SystemExit(1)
' <<<"$json"
}

# Metro's own watcher health check writes a cookie file and waits for the watch
# event — a logged success is end-to-end proof that file events reach Metro.
# Requires the ensure-launched Metro (DEBUG=Metro:Watcher → METRO_LOG).
# Recency-gated so a stale log from a dead instance can't pass.
metro_recent_health_check_ok() {
  local max_age="${METRO_WATCHER_HEALTH_MAX_AGE_SECS:-300}"
  MAX_AGE="$max_age" python3 - "$METRO_LOG" <<'PY'
import os, re, sys, time
from datetime import datetime, timezone
try:
    lines = open(sys.argv[1], encoding="utf-8", errors="replace").readlines()
except OSError:
    raise SystemExit(1)
last_watcher_kind = None
last_health = None
for line in lines:
    m = re.match(r"^(\S+) Metro:Watcher Using watcher: (\w+)", line)
    if m:
        last_watcher_kind = m.group(2)
    m = re.match(r"^(\S+) Metro:Watcher Health check result: .*type: '(\w+)'", line)
    if m:
        last_health = (m.group(1), m.group(2))
# NativeWatcher passes root-level cookie checks while dropping deep src/ events,
# so only a watchman-backed health check counts.
if last_watcher_kind != "watchman" or last_health is None or last_health[1] != "success":
    raise SystemExit(1)
try:
    ts = datetime.fromisoformat(last_health[0].replace("Z", "+00:00")).timestamp()
except ValueError:
    raise SystemExit(1)
raise SystemExit(0 if time.time() - ts <= float(os.environ["MAX_AGE"]) else 1)
PY
}

metro_subscription_live() {
  local before after nonce
  before="$(metro_subscription_since)" || return 1
  ensure_metro_hmr_beacon_probe_file || return 1

  nonce="$(python3 - "$METRO_WATCHER_PROBE_FILE" <<'PY'
import pathlib, sys, time
path = pathlib.Path(sys.argv[1])
nonce = f"metro-hmr-beacon-{time.time_ns()}"
path.write_text(
    "// Local Metro watcher probe artifact (gitignored).\n"
    "// Created by scripts/ensure-metro-hmr-beacon.sh; nonce updates by metro-watcher.sh.\n"
    f"export const METRO_HMR_BEACON = '{nonce}';\n",
    encoding="utf-8",
)
print(nonce)
PY
)"

  local deadline=$((SECONDS + METRO_WATCHER_PROBE_WAIT_SECS))
  while (( SECONDS < deadline )); do
    # Primary: Metro's own watchman-backed health check succeeded recently.
    if metro_recent_health_check_ok; then
      return 0
    fi
    # debug-get-subscriptions reports the *initial* since only — it advancing is
    # a bonus signal, never required (it stays fixed on healthy Metro too).
    after="$(metro_subscription_since)" || true
    if [[ -n "$after" && "$after" != "$before" ]]; then
      return 0
    fi
    if grep -q "$nonce" "$METRO_LOG" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
  done

  # Human-terminal Metro (npm start) has no DEBUG log we can observe; trust the
  # earlier gates (watchman client attached + entry resolves) instead of failing.
  if ! grep -q "Metro:Watcher" "$METRO_LOG" 2>/dev/null; then
    echo "note: no Metro:Watcher debug log — relying on watchman client + entry resolve gates"
    return 0
  fi
  return 1
}

metro_watcher_healthy() {
  ensure_watchman_project || return 1
  watchman_capabilities_ready || return 1
  metro_has_watchman_client || return 1
  metro_entry_resolves || return 1
  if [[ "${METRO_WATCHER_SKIP_LIVE_PROBE:-0}" == "1" ]]; then
    return 0
  fi
  metro_subscription_live || return 1
  return 0
}

print_metro_watcher_diagnostics() {
  local bin sub_count="?"
  bin="$(watchman_bin)"
  if [[ -n "$bin" ]]; then
    sub_count="$("$bin" debug-get-subscriptions "$ROOT" 2>/dev/null | python3 -c '
import json,sys
try:
  d=json.load(sys.stdin)
except Exception:
  print("unavailable"); raise SystemExit
subs=[s for s in (d.get("subscribers") or []) if (s.get("info") or {}).get("name","").startswith("metro-file-map-")]
print(len(subs))
' 2>/dev/null || echo unavailable)"
  fi

  cat <<EOF
--- metro watcher diagnostic ---
Watchman bin:     $(watchman_bin || echo missing)
Capabilities:     $(watchman_capabilities_ready && echo ready || echo NOT READY)
metro-file-map:   ${sub_count} subscription(s)
Watchman client:  $(metro_has_watchman_client && echo yes || echo NO)
Entry resolves:   $(metro_entry_resolves && echo yes || echo NO)
Health check:     $(metro_recent_health_check_ok && echo "recent watchman success" || echo "none/stale/native")
Sub since:        $(metro_subscription_since 2>/dev/null || echo unavailable)
Metro PIDs:       $(metro_listen_pids | tr '\n' ' ' | sed 's/[[:space:]]*$//')
Probe file:       ${METRO_WATCHER_PROBE_FILE}
-------------------------------
EOF
}

# Keep the gitignored import target present whenever this lib is sourced.
ensure_metro_hmr_beacon_probe_file || true
