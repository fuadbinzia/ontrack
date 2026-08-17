---
name: sync-from-main
description: >-
  Fetches the latest remote main and merges it into the current branch,
  then resolves merge conflicts. Use when the user asks to pull latest from
  main, merge main into this branch, sync with upstream/main, update Fuad
  from remote main, or bring a feature branch up to date with main.
---

# Sync from remote main

Inbound only: **remote main → current branch**. Opposite of `npm run ship:push` (branch → PR → main).

## Do this

1. Run `./scripts/sync-from-main.sh` (stay on the current branch).
2. If exit **2**, resolve conflicts (below), then `git add` + `git commit` to finish the merge.
3. Report: branch name, remote used (`upstream` vs `origin`), fast-forward vs merge, conflict files if any.
4. **Do not push** unless the user asks.

## Remote

Prefer **`upstream/main`** (`imtiazhossain/ontrack`) when that remote exists. Fall back to `origin/main`. Do not treat a stale fork `origin/main` as canonical when `upstream` is present.

## Conflicts

- Never leave `<<<<<<<` / `=======` / `>>>>>>>` markers.
- Keep current-branch work; take incoming main for shared infrastructure unless the branch change is the point of the file.
- After resolving: `npm run typecheck` and focused tests for touched domains.
- Do not abort the merge with `git merge --abort` unless the user asks.

## Do not

- Rebase unless the user asks
- Stash, force-push, `--no-verify`, or amend
- Run `ship:push` / open a PR as part of this sync
- Switch away from the current branch to do the merge
