#!/usr/bin/env bash
# Full ship flow for onTrack:
#   patch-bump version + release notes/changelog → commit → branch → PR →
#   merge main → delete branch → ensure compatible TestFlight binary →
#   TestFlight + device OTA
#
# Agent / human phrases that mean this script:
#   "push" · "run the push script" · "push script" · "ship push" · "ship:push"
#
# Usage (from repo root):
#   npm run ship:push -- -m "Why this ships"
#   npm run ship:push -- -m "…" --branch feat/travel-home-ui
#   npm run ship:push -- --ota-only -m "Reship current main"
#   npm run ship:push -- -m "…" --skip-ota
#
# Every non--ota-only push:
#   - bumps expo.version patch (.x.y → .x.(y+1)) in app.json (+ package.json)
#   - prepends Release Notes + Changelog in release-notes-user/changelog.ts
#   - pins runtimeVersion when still on appVersion policy so OTA keeps working
#
# Flags:
#   -m, --message   Commit / PR / OTA / release-notes message (required unless --ota-only)
#   --branch        Feature branch name (default: ship/<slug>-<yyyymmdd>)
#   --ota-only      Skip version bump + git/PR; publish OTA from current HEAD
#                   (alias: --ota-apk-only)
#   --skip-ota      Skip EAS Update publish
#   --dry-run       Print steps only
#
# Android JS/assets ship via the `device` channel (same as update:device).
# Rebuild/sideload APK only for native / runtimeVersion changes:
#   npm run android:release-to-drive (or eas build --profile device).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MESSAGE=""
BRANCH=""
OTA_ONLY=0
SKIP_OTA=0
DRY_RUN=0

usage() {
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

die() {
  echo "error: $*" >&2
  exit 1
}

slugify() {
  # lowercase, non-alnum → -, squeeze, trim, max 48 chars
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
    | cut -c1-48 \
    | sed -E 's/-$//'
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

latest_testflight_runtime() {
  npx eas-cli@latest build:list \
    --platform ios \
    --build-profile testflight \
    --status finished \
    --limit 1 \
    --json \
    --non-interactive \
    2>/dev/null | node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        try {
          const builds = JSON.parse(input);
          process.stdout.write(String(builds?.[0]?.runtimeVersion || ""));
        } catch {
          process.exit(1);
        }
      });
    '
}

ensure_testflight_runtime() {
  local required_runtime latest_runtime
  required_runtime="$(
    node -e "const a=require('${ROOT}/app.json'); process.stdout.write(String(a?.expo?.runtimeVersion||''))"
  )"
  [[ -n "$required_runtime" ]] || die "app.json missing a fixed expo.runtimeVersion"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] compare latest finished TestFlight runtime with $required_runtime"
    echo "[dry-run] npm run build:testflight when no compatible binary exists"
    return 0
  fi

  echo "==> Checking TestFlight binary runtime compatibility"
  latest_runtime="$(latest_testflight_runtime)" || \
    die "could not inspect the latest finished TestFlight build"
  if [[ "$latest_runtime" == "$required_runtime" ]]; then
    echo "    compatible TestFlight binary found (runtime $required_runtime)"
    return 0
  fi

  if [[ -n "$latest_runtime" ]]; then
    echo "    latest TestFlight binary runtime: $latest_runtime"
  else
    echo "    no finished TestFlight binary found"
  fi
  echo "    required OTA runtime: $required_runtime"
  echo "==> Building and submitting a compatible TestFlight binary"
  npm run build:testflight
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || die "--message requires a value"
      MESSAGE="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || die "--branch requires a value"
      BRANCH="$2"
      shift 2
      ;;
    --ota-only|--ota-apk-only) OTA_ONLY=1; shift ;;
    --skip-ota) SKIP_OTA=1; shift ;;
    --skip-apk)
      echo "warning: --skip-apk is obsolete (ship:push no longer builds APKs); ignoring" >&2
      shift
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown arg: $1 (try --help)"
      ;;
  esac
done

command -v git >/dev/null || die "git not found"
command -v gh >/dev/null || die "gh not found (GitHub CLI)"
command -v npm >/dev/null || die "npm not found"

if [[ -n "$(git status --porcelain)" ]]; then
  DIRTY=1
else
  DIRTY=0
fi

CURRENT_BRANCH="$(git branch --show-current)"
[[ -n "$CURRENT_BRANCH" ]] || die "detached HEAD is not supported"

PR_URL=""
MERGE_SHA=""
SHIPPED_VERSION=""

if [[ "$OTA_ONLY" -eq 0 ]]; then
  [[ -n "$MESSAGE" ]] || die "pass -m \"commit/PR/OTA message\""

  # Always patch-bump + notes before commit so every push ships a new .xx version.
  echo "==> Bumping patch version + release notes / changelog"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    run node "$ROOT/scripts/ship-bump-version.mjs" --message "$MESSAGE" --dry-run
  else
    run node "$ROOT/scripts/ship-bump-version.mjs" --message "$MESSAGE"
  fi
  SHIPPED_VERSION="$(
    node -e "const a=require('${ROOT}/app.json'); process.stdout.write(String(a?.expo?.version||''))"
  )"
  DIRTY=1

  if [[ "$CURRENT_BRANCH" == "main" ]]; then
    if [[ -z "$BRANCH" ]]; then
      SLUG="$(slugify "$MESSAGE")"
      [[ -n "$SLUG" ]] || SLUG="update"
      BRANCH="ship/${SLUG}-$(date +%Y%m%d)"
    fi
    echo "==> Creating branch $BRANCH from main"
    run git checkout -b "$BRANCH"
    CURRENT_BRANCH="$BRANCH"
  elif [[ -n "$BRANCH" && "$BRANCH" != "$CURRENT_BRANCH" ]]; then
    die "already on $CURRENT_BRANCH; omit --branch or checkout first"
  else
    BRANCH="$CURRENT_BRANCH"
    echo "==> Using current branch $BRANCH"
  fi

  echo "==> Committing working tree (includes version bump)"
  run git add -A
  # HEREDOC keeps multi-line messages intact without interactive editors.
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] git commit -m $(printf %q "$MESSAGE")"
  else
    git commit -m "$MESSAGE"
  fi

  echo "==> Pushing $BRANCH"
  run git push -u origin HEAD

  echo "==> Opening PR"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] gh pr create …"
    PR_URL="https://example.com/pr/dry-run"
  else
    # Reuse an open PR for this branch if one exists.
    EXISTING="$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url' 2>/dev/null || true)"
    if [[ -n "$EXISTING" ]]; then
      PR_URL="$EXISTING"
      echo "    existing PR: $PR_URL"
    else
      PR_URL="$(
        gh pr create \
          --title "$MESSAGE" \
          --body "$(cat <<EOF
## Summary
- ${MESSAGE}

## Test plan
- [ ] Smoke Travel / changed surfaces on iOS + Android
- [ ] Confirm TestFlight + device channel OTA after merge

EOF
)"
      )"
      echo "    created: $PR_URL"
    fi
  fi

  echo "==> Merging PR into main and deleting branch"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] gh pr merge --merge --delete-branch"
  else
    gh pr merge "$PR_URL" --merge --delete-branch
  fi

  echo "==> Syncing local main"
  run git checkout main
  run git pull origin main
  MERGE_SHA="$(git rev-parse --short HEAD)"
  echo "    main @ $MERGE_SHA"
else
  if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "==> --ota-only: syncing to main first"
    run git checkout main
    run git pull origin main
  elif [[ -n "$(git status -sb | grep -E '\[behind' || true)" ]]; then
    run git pull origin main
  else
    # Still pull to be safe when tracking is ahead/behind-unknown.
    run git pull origin main 2>/dev/null || true
  fi
  MERGE_SHA="$(git rev-parse --short HEAD)"
  if [[ -z "$MESSAGE" ]]; then
    MESSAGE="$(git log -1 --pretty=%s)"
  fi
  echo "==> OTA-only from main @ $MERGE_SHA"
fi

OTA_MSG="$MESSAGE"
[[ -n "$OTA_MSG" ]] || OTA_MSG="Ship $(git rev-parse --short HEAD)"

if [[ "$SKIP_OTA" -eq 0 ]]; then
  ensure_testflight_runtime
  echo "==> Publishing TestFlight OTA (iOS)"
  run npm run update:testflight -- --message "$OTA_MSG" --non-interactive
  echo "==> Publishing device OTA (Android sideload)"
  run npm run update:device -- --message "$OTA_MSG" --non-interactive
else
  echo "==> Skipping EAS Update (--skip-ota)"
fi

echo
echo "======== ship:push complete ========"
[[ -n "$PR_URL" ]] && echo "pr=$PR_URL"
echo "main=$(git rev-parse --short HEAD)"
[[ -n "$SHIPPED_VERSION" ]] && echo "version=$SHIPPED_VERSION"
echo "message=$OTA_MSG"
[[ "$SKIP_OTA" -eq 0 ]] && echo "ota=testflight + device (see EAS Dashboard links above)"
echo "===================================="
