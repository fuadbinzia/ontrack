#!/usr/bin/env bash
# Persistent-style agent-ui entrypoint — one Python process for multi-step once chains.
#
# Preferred verification shape (web-like):
#   ./scripts/agent-ui.sh once --flow travel-demo-list --assert-exists travel.list.currency.trip-agent-ui-demo
#   ./scripts/agent-ui.sh verify --route /travel/trip-agent-ui-demo --flow travel-demo \
#     --exists travel.planDetail.transportSection --color travel.planDetail.transportSection '#2474A8'
#   ./scripts/agent-ui.sh once --open travel --assert-prefix travel.planDetail.
#   ./scripts/agent-ui.sh assert --exists travel.newTrip.open --route /travel
#   ./scripts/agent-ui.sh flow travel-demo
#   ./scripts/agent-ui.sh open travel/trip-agent-ui-demo/add/flight
#
# JS key paths (travel.planDetail.transportSection) resolve via ids.ts.
# Run typecheck/tests in parallel with once — do not serialize them after UI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat >&2 <<'EOF'
usage:
  agent-ui.sh once [--flow|--open|--goto|--seed|--tap|--wait-*|--assert-*|--color|--screenshot]...
  agent-ui.sh verify --route <path> [--flow|--open] [--exists|--color|--screenshot]...
  agent-ui.sh assert [--exists|--missing|--route|--prefix|--contains|--color]...
  agent-ui.sh flow <name>
  agent-ui.sh open <alias|path>
  agent-ui.sh batch …
  agent-ui.sh tap|exists|route|wait|dump|seed|goto …
  agent-ui.sh hit <x> <y> | --pixel <px> <py> | --overlay on|off|toggle
  agent-ui.sh source <id|keyPath> | --label TEXT
  agent-ui.sh overlay on|off|toggle|status
  agent-ui.sh devmode on|off|release|status
  agent-ui.sh login [--guest|--status]   # sign in as this slot's agent_N account
EOF
  exit 2
}

# Help must run BEFORE sourcing host.sh — source auto-leases a pool slot.
if [[ $# -lt 1 ]]; then
  usage
fi
case "${1}" in
  -h|--help|help) usage ;;
esac
if [[ "${1}" == "once" || "${1}" == "verify" ]] &&
  [[ "${2:-}" == "-h" || "${2:-}" == "--help" ]]; then
  usage
fi

# shellcheck source=lib/agent-ui-host.sh
source "${ROOT}/scripts/lib/agent-ui-host.sh"

CMD="$1"
shift || true

case "${CMD}" in
  once)
    agent_ui_ensure_app_up
    agent_ui_apply_wait_budget flow
    AGENT_UI_ROOT="${ROOT}" \
    WAIT_SECS="${WAIT_SECS}" \
    AGENT_UI_WAIT_TIMEOUT_MS="${AGENT_UI_WAIT_TIMEOUT_MS}" \
      python3 "${ROOT}/scripts/lib/agent_ui_bridge.py" once -- "$@"
    ;;
  verify)
    exec "${ROOT}/scripts/agent-ui-verify.sh" "$@"
    ;;
  assert)
    exec "${ROOT}/scripts/agent-ui-assert.sh" "$@"
    ;;
  flow)
    exec "${ROOT}/scripts/agent-ui-flow.sh" "$@"
    ;;
  open)
    exec "${ROOT}/scripts/agent-ui-open.sh" "$@"
    ;;
  batch)
    exec "${ROOT}/scripts/agent-ui-batch.sh" "$@"
    ;;
  tap)
    exec "${ROOT}/scripts/agent-ui-tap.sh" "$@"
    ;;
  exists)
    exec "${ROOT}/scripts/agent-ui-exists.sh" "$@"
    ;;
  route)
    exec "${ROOT}/scripts/agent-ui-route.sh" "$@"
    ;;
  wait)
    exec "${ROOT}/scripts/agent-ui-wait.sh" "$@"
    ;;
  dump)
    exec "${ROOT}/scripts/agent-ui-dump.sh" "$@"
    ;;
  seed)
    exec "${ROOT}/scripts/agent-ui-seed.sh" "$@"
    ;;
  goto)
    exec "${ROOT}/scripts/agent-ui-goto.sh" "$@"
    ;;
  hit)
    exec "${ROOT}/scripts/agent-ui-hit.sh" "$@"
    ;;
  source|sources)
    if [[ "${CMD}" == "sources" ]]; then
      exec "${ROOT}/scripts/agent-ui-sources.sh" "$@"
    fi
    exec "${ROOT}/scripts/agent-ui-source.sh" "$@"
    ;;
  overlay)
    exec "${ROOT}/scripts/agent-ui-overlay.sh" "$@"
    ;;
  devmode)
    exec "${ROOT}/scripts/agent-ui-devmode.sh" "$@"
    ;;
  login)
    exec "${ROOT}/scripts/agent-ui-login.sh" "$@"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "error: unknown command ${CMD}" >&2
    usage
    ;;
esac
