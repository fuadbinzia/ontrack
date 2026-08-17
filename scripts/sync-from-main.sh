#!/usr/bin/env bash
# Fetch remote main and merge it into the current branch.
# Prefer upstream (canonical imtiazhossain/ontrack) when it has a main branch.
#
# Usage: ./scripts/sync-from-main.sh
# Does not push. Aborts on a dirty worktree or detached HEAD.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not a git repository" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "HEAD" ]]; then
  echo "error: detached HEAD — checkout a branch first" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty — commit or stash before syncing main" >&2
  git status --short
  exit 1
fi

remote=""
if git remote get-url upstream >/dev/null 2>&1; then
  if git ls-remote --heads --exit-code upstream main >/dev/null 2>&1; then
    remote="upstream"
  fi
fi
if [[ -z "$remote" ]]; then
  if git ls-remote --heads --exit-code origin main >/dev/null 2>&1; then
    remote="origin"
  fi
fi
if [[ -z "$remote" ]]; then
  echo "error: no remote main found (tried upstream, then origin)" >&2
  git remote -v
  exit 1
fi

echo "Fetching ${remote}/main…"
git fetch "$remote" main

remote_main="$(git rev-parse "${remote}/main")"
before="$(git rev-parse HEAD)"

if git merge-base --is-ancestor "$remote_main" HEAD; then
  echo "Already up to date with ${remote}/main ($(git rev-parse --short HEAD))."
else
  echo "Merging ${remote}/main into ${branch}…"
  if ! git merge --no-edit "${remote}/main"; then
    echo "error: merge conflicts — resolve, then git add and git commit" >&2
    git status --short
    exit 2
  fi
fi

if git show-ref --verify --quiet refs/heads/main && [[ "$branch" != "main" ]]; then
  if git merge-base --is-ancestor main "$remote_main"; then
    git branch -f main "$remote_main"
    echo "Updated local main → ${remote}/main ($(git rev-parse --short main))"
  else
    echo "warn: local main has unique commits — left it unchanged" >&2
  fi
fi

after="$(git rev-parse HEAD)"
echo "Branch ${branch} is at $(git rev-parse --short HEAD) (was $(git rev-parse --short "$before"))."
if [[ "$before" == "$after" ]]; then
  echo "No new commits merged. Did not push."
else
  echo "Merged ${remote}/main. Did not push."
fi
