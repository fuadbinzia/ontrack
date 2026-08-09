#!/usr/bin/env bash
# Create / repair the four agent verification accounts (agent_1…agent_4).
#
#   ./scripts/agent-accounts-setup.sh            # ensure all four
#   ./scripts/agent-accounts-setup.sh --dry-run  # show what would happen
#
# Needs SUPABASE_SERVICE_ROLE_KEY (env or .env.local) — creating users and
# granting account_flags.agent_test bypasses RLS by design.
# Generated passwords are appended to .env.local and never printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export AGENT_UI_ROOT="$ROOT"
exec python3 "${ROOT}/scripts/lib/agent_accounts_setup.py" "$@"
