#!/usr/bin/env bash
# Clear prompts on the leased agent device and sign in as its agent_N account.
#
#   ./scripts/agent-ui-login.sh            # prompts + agent account
#   ./scripts/agent-ui-login.sh --guest    # prompts + guest only
#   ./scripts/agent-ui-login.sh --status   # auth gate up?
#
# Creds: .env.local via agent-credentials.sh. Provision: agent-accounts-setup.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

MODE="account"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --guest) MODE="guest"; shift ;;
    --status) MODE="status"; shift ;;
    -h|--help)
      sed -n '2,10p' "$0" >&2
      exit 2
      ;;
    *)
      echo "error: unknown arg '$1'" >&2
      exit 2
      ;;
  esac
done

# shellcheck source=lib/agent-ui-host.sh
LEASE_RC=0
source "${ROOT}/scripts/lib/agent-ui-host.sh" || LEASE_RC=$?
if (( LEASE_RC != 0 )); then
  if (( LEASE_RC == 3 )); then
    echo "login: skipped — no free agent device slot (nothing tested)" >&2
  fi
  exit "${LEASE_RC}"
fi
# shellcheck source=lib/agent-credentials.sh
source "${ROOT}/scripts/lib/agent-credentials.sh"

agent_ui_ensure_app_up

if ! agent_ui_is_android; then
  agent_ui_ensure_ios_system_alerts_clear || true
fi
AGENT_UI_SKIP_APP_UP=1 "${ROOT}/scripts/agent-ui.sh" once --dismiss >/dev/null 2>&1 || true

ROUTE="$(AGENT_UI_SKIP_APP_UP=1 "${ROOT}/scripts/agent-ui-route.sh" 2>/dev/null || true)"

auth_gate_up() {
  "${ROOT}/scripts/agent-ui-exists.sh" ontrack.auth.section.providers >/dev/null 2>&1
}
auth_gate_cleared() {
  agent_ui_send_op assert --id ontrack.auth.section.providers --missing >/dev/null 2>&1
}

if [[ "${MODE}" == "status" ]]; then
  if auth_gate_up; then
    echo "login: auth gate up on ${ROUTE:-?} — no session"
    exit 1
  fi
  echo "login: past the auth gate (route=${ROUTE:-?})"
  exit 0
fi

continue_as_guest() {
  if ! "${ROOT}/scripts/agent-ui-exists.sh" ontrack.auth.guest >/dev/null 2>&1; then
    echo "login: guest is not offered on this device" >&2
    return 1
  fi
  echo "login: continuing as guest (route=${ROUTE:-?})"
  agent_ui_send_op tap ontrack.auth.guest >/dev/null
  if auth_gate_cleared; then
    echo "login: guest session active"
    return 0
  fi
  echo "login: guest tap did not clear the auth card" >&2
  return 1
}

if [[ "${MODE}" == "account" ]]; then
  if agent_creds_load_account; then
    echo "login: signing in as ${ONTRACK_AGENT_ACCOUNT_EMAIL} (agent account ${ONTRACK_AGENT_ACCOUNT_INDEX}, slot ${AGENT_UI_SLOT:-?})"
    if agent_ui_send_op login "${ONTRACK_AGENT_ACCOUNT_EMAIL}" >/dev/null; then
      echo "login: signed in as ${ONTRACK_AGENT_ACCOUNT_EMAIL}"
      exit 0
    fi
    echo "login: agent account sign-in failed — falling back to guest" >&2
  else
    agent_creds_account_hint
  fi
fi

if ! auth_gate_up; then
  echo "login: no auth gate (route=${ROUTE:-?}) — nothing to do"
  exit 0
fi
continue_as_guest
