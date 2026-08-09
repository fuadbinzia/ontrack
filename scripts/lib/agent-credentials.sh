#!/usr/bin/env bash
# Agent accounts agent_1…agent_4. Index = (android ? 2 : 0) + slot.
# Creds: .env.local only (see agent-ui skill). Passwords never echoed.

: "${ONTRACK_AGENT_ACCOUNT_EMAIL_DOMAIN:=example.com}"

# Read one KEY=value from a dotenv file without sourcing it (values may contain
# spaces, #, quotes). Prints nothing when absent.
agent_creds_read_dotenv() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  KEY="$key" python3 - "$file" <<'PY'
import os, sys

key = os.environ["KEY"]
try:
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            if name.strip() != key:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if value:
                print(value)
            break
except OSError:
    pass
PY
}

# Env first, then .env.local, then .env (warn — tracked file).
agent_creds_value() {
  local key="$1" root="${AGENT_UI_ROOT:-${ROOT:-.}}" value
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return 0
  fi
  value="$(agent_creds_read_dotenv "${root}/.env.local" "$key" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    value="$(agent_creds_read_dotenv "${root}/.env" "$key" 2>/dev/null || true)"
    if [[ -n "$value" ]]; then
      echo "agent-ui: warn — ${key} came from .env (tracked). Move it to .env.local." >&2
    fi
  fi
  [[ -n "$value" ]] || return 1
  printf '%s' "$value"
}

# Account index for this device (platform + pool slot). Empty when unleased.
agent_creds_account_index() {
  local slot="${AGENT_UI_SLOT:-}" platform="${1:-${AGENT_UI_PLATFORM:-ios}}" base=0
  [[ "$slot" =~ ^[1-9][0-9]*$ ]] || return 1
  case "$platform" in
    android) base=2 ;;
    *) base=0 ;;
  esac
  printf '%s' "$((base + slot))"
}

# Optional operator override from gitignored .env.local (never commit emails).
# When both ONTRACK_AGENT_LOGIN_EMAIL + ONTRACK_AGENT_LOGIN_PASSWORD are set,
# login uses those instead of the slot's agent_N account. The account must still
# have account_flags.agent_test (dev-only sign-in gate).
agent_creds_load_login_override() {
  local email password
  email="$(agent_creds_value ONTRACK_AGENT_LOGIN_EMAIL || true)"
  password="$(agent_creds_value ONTRACK_AGENT_LOGIN_PASSWORD || true)"
  if [[ -z "$email" || -z "$password" ]]; then
    return 1
  fi
  export ONTRACK_AGENT_ACCOUNT_INDEX="${ONTRACK_AGENT_ACCOUNT_INDEX:-override}"
  export ONTRACK_AGENT_ACCOUNT_EMAIL="$email"
  export ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED="$password"
}

# Export ONTRACK_AGENT_ACCOUNT_EMAIL / _PASSWORD (+ _INDEX) for this device.
# Returns 1 when the account is not configured — callers skip sign-in, not fail.
agent_creds_load_account() {
  local index email password
  if agent_creds_load_login_override; then
    return 0
  fi
  index="$(agent_creds_account_index "${1:-${AGENT_UI_PLATFORM:-ios}}" || true)"
  if [[ -z "$index" ]]; then
    echo "agent-ui: no pool slot — cannot resolve an agent account" >&2
    return 1
  fi
  email="$(agent_creds_value "ONTRACK_AGENT_ACCOUNT_${index}_EMAIL" || true)"
  [[ -n "$email" ]] || email="agent_${index}@${ONTRACK_AGENT_ACCOUNT_EMAIL_DOMAIN}"
  password="$(agent_creds_value "ONTRACK_AGENT_ACCOUNT_${index}_PASSWORD" || true)"
  [[ -n "$password" ]] || password="$(agent_creds_value ONTRACK_AGENT_ACCOUNT_PASSWORD || true)"
  if [[ -z "$password" ]]; then
    return 1
  fi
  export ONTRACK_AGENT_ACCOUNT_INDEX="$index"
  export ONTRACK_AGENT_ACCOUNT_EMAIL="$email"
  export ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED="$password"
}

agent_creds_account_hint() {
  cat >&2 <<'EOF'
agent-ui: no agent account credentials configured for this device.
agent-ui: provision the four accounts once (needs SUPABASE_SERVICE_ROLE_KEY):
agent-ui:   ./scripts/agent-accounts-setup.sh
agent-ui: or add to .env.local (gitignored — never commit these):
agent-ui:   ONTRACK_AGENT_ACCOUNT_<n>_EMAIL / ONTRACK_AGENT_ACCOUNT_<n>_PASSWORD
agent-ui: optional operator override (must have account_flags.agent_test):
agent-ui:   ONTRACK_AGENT_LOGIN_EMAIL / ONTRACK_AGENT_LOGIN_PASSWORD
EOF
}
