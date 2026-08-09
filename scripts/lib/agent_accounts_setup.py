#!/usr/bin/env python3
"""Create / repair agent_1…agent_4 (service role). Creds → .env.local (never printed).

See agent-ui skill + migration 202608090001_account_flags_agent_test.sql.
Usage: ./scripts/agent-accounts-setup.sh [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ACCOUNT_COUNT = 4
DEFAULT_EMAIL_DOMAIN = "example.com"
# config.toml: min 10 + lower_upper_letters_digits — guarantee each class.
PASSWORD_LENGTH = 32
PASSWORD_LOWER = "abcdefghijkmnopqrstuvwxyz"
PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
PASSWORD_DIGITS = "23456789"


def generate_password(length: int = PASSWORD_LENGTH) -> str:
    """Random password with lower + upper + digit (Supabase strength rules)."""
    alphabet = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS
    chars = [
        secrets.choice(PASSWORD_LOWER),
        secrets.choice(PASSWORD_UPPER),
        secrets.choice(PASSWORD_DIGITS),
        *[secrets.choice(alphabet) for _ in range(max(length, 12) - 3)],
    ]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def repo_root() -> Path:
    env = os.environ.get("AGENT_UI_ROOT") or os.environ.get("ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2]


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[name.strip()] = value
    return values


def config(dotenv: dict[str, str], key: str, *fallbacks: str) -> str:
    for name in (key, *fallbacks):
        value = os.environ.get(name) or dotenv.get(name)
        if value:
            return value
    return ""


def account_email(index: int, dotenv: dict[str, str]) -> str:
    override = config(dotenv, f"ONTRACK_AGENT_ACCOUNT_{index}_EMAIL")
    if override:
        return override
    domain = config(dotenv, "ONTRACK_AGENT_ACCOUNT_EMAIL_DOMAIN") or DEFAULT_EMAIL_DOMAIN
    return f"agent_{index}@{domain}"


def request_json(
    url: str,
    *,
    token: str,
    method: str = "GET",
    payload: dict | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, object]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "apikey": token,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode("utf-8") or "null"
            return res.status, json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8") or "null"
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw


def find_user_id(base: str, token: str, email: str) -> str | None:
    """Admin user lookup by email (paged — GoTrue has no exact-match filter)."""
    page = 1
    while page <= 20:
        query = urllib.parse.urlencode({"page": page, "per_page": 200})
        status, data = request_json(f"{base}/auth/v1/admin/users?{query}", token=token)
        if status != 200 or not isinstance(data, dict):
            return None
        users = data.get("users") or []
        for user in users:
            if (user.get("email") or "").lower() == email.lower():
                return user.get("id")
        if len(users) < 200:
            return None
        page += 1
    return None


def ensure_user(base: str, token: str, email: str, password: str) -> tuple[str | None, str]:
    """Create the user (email pre-confirmed) or reset its password. -> (id, action)"""
    status, data = request_json(
        f"{base}/auth/v1/admin/users",
        token=token,
        method="POST",
        payload={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"agent_test": True, "full_name": email.split("@")[0]},
        },
    )
    if status in (200, 201) and isinstance(data, dict) and data.get("id"):
        return str(data["id"]), "created"

    user_id = find_user_id(base, token, email)
    if not user_id:
        detail = data if isinstance(data, str) else json.dumps(data)
        print(f"error: could not create or find {email}: {status} {detail}", file=sys.stderr)
        return None, "failed"

    status, data = request_json(
        f"{base}/auth/v1/admin/users/{user_id}",
        token=token,
        method="PUT",
        payload={"password": password, "email_confirm": True},
    )
    if status != 200:
        detail = data if isinstance(data, str) else json.dumps(data)
        print(f"warn: password reset failed for {email}: {status} {detail}", file=sys.stderr)
        return user_id, "existing"
    return user_id, "updated"


def flag_agent_account(base: str, token: str, user_id: str) -> bool:
    status, data = request_json(
        f"{base}/rest/v1/account_flags?on_conflict=user_id",
        token=token,
        method="POST",
        payload={
            "user_id": user_id,
            "agent_test": True,
            # Agents need the Developer Hub; analytics_admin stays false (DB check).
            "developer_tools": True,
            "analytics_admin": False,
        },
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    if status not in (200, 201, 204):
        detail = data if isinstance(data, str) else json.dumps(data)
        print(f"error: flagging {user_id} failed: {status} {detail}", file=sys.stderr)
        return False
    return True


def append_env_local(root: Path, lines: list[str]) -> None:
    if not lines:
        return
    path = root / ".env.local"
    existing = path.read_text(encoding="utf-8") if path.is_file() else ""
    block = "\n".join(lines)
    prefix = "" if existing.endswith("\n") or not existing else "\n"
    header = "\n# Agent verification accounts (agent_1…agent_4) — local only.\n"
    if "# Agent verification accounts" in existing:
        header = "\n"
    path.write_text(f"{existing}{prefix}{header}{block}\n", encoding="utf-8")
    print(f"agent-accounts: wrote {len(lines)} credential line(s) to .env.local")


def main() -> int:
    parser = argparse.ArgumentParser(description="Set up agent_1…agent_N accounts")
    parser.add_argument("--accounts", type=int, default=ACCOUNT_COUNT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = repo_root()
    dotenv = read_dotenv(root / ".env.local")
    dotenv.update({k: v for k, v in read_dotenv(root / ".env").items() if k not in dotenv})

    base = config(dotenv, "SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL").rstrip("/")
    token = config(dotenv, "SUPABASE_SERVICE_ROLE_KEY")
    if not base:
        print("error: SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL is not set", file=sys.stderr)
        return 2
    if not token:
        print(
            "error: SUPABASE_SERVICE_ROLE_KEY is required (service role bypasses RLS).\n"
            "       Add it to .env.local (gitignored) or export it for this run only.",
            file=sys.stderr,
        )
        return 2

    count = max(1, min(args.accounts, 8))
    new_env: list[str] = []
    failures = 0

    for index in range(1, count + 1):
        email = account_email(index, dotenv)
        password = config(
            dotenv,
            f"ONTRACK_AGENT_ACCOUNT_{index}_PASSWORD",
            "ONTRACK_AGENT_ACCOUNT_PASSWORD",
        )
        generated = False
        if not password:
            password = generate_password()
            generated = True

        if args.dry_run:
            print(f"agent-accounts: would ensure {email} (password {'generated' if generated else 'from env'})")
            continue

        user_id, action = ensure_user(base, token, email, password)
        if not user_id:
            failures += 1
            continue
        if not flag_agent_account(base, token, user_id):
            failures += 1
            continue

        if generated:
            new_env.append(f"ONTRACK_AGENT_ACCOUNT_{index}_EMAIL={email}")
            new_env.append(f"ONTRACK_AGENT_ACCOUNT_{index}_PASSWORD={password}")
        print(f"agent-accounts: {email} {action} + agent_test flag set")

    if not args.dry_run:
        append_env_local(root, new_env)

    if failures:
        print(f"agent-accounts: {failures} account(s) failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
