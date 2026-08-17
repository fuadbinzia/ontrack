---
name: checklists
description: >-
  onTrack checklists and grocery lists: list overview, task rows, collaboration
  (share/join/invites), grocery meal/combined views, recipe import (URL/image),
  normalize/store, cloud sync, and Siri / Google Assistant add+read. Use when
  editing src/features/todos/, src/store/todos*.ts, src/services/todos/,
  src/services/recipes/, modules/ontrack-voice-lists, or todo/grocery app
  routes (/to-do, /todos, /l, /c, recipe-imports).
---

# Checklists (onTrack)

**Product spec (living): [`docs/checklists-spec.md`](../../../docs/checklists-spec.md)** — read it before changing behavior, and update it in the **same change** whenever checklist/grocery behavior changes.

## Start here

| Surface | Entry |
|---------|--------|
| Tab / lists overview | `src/app/(tabs)/to-do/index.tsx` → `features/todos/todo-lists-overview.tsx` |
| List detail (checklist vs grocery) | `src/app/(tabs)/to-do/[id].tsx` → `todo-list-screen` / `grocery-list-screen` |
| Legacy detail redirect | `src/app/todos/[id].tsx` → `/(tabs)/to-do/:id` |
| Settings | `src/app/(tabs)/to-do/[id]/settings.tsx` → `todo-list-settings-screen.tsx` |
| Recipe import | `src/app/(tabs)/to-do/[id]/recipe-import.tsx` → `recipe-import-screen.tsx` |
| Invites / collaborators routes | `src/app/todo-invites.tsx`, `src/app/todo-collaborators.tsx` |
| Share-link join | `src/app/l/[code].tsx` → `todo-join-screen.tsx` |
| Collaborator multi-list join | `src/app/c/[code].tsx` → `todo-collaborator-join-screen.tsx` |
| OS share → grocery recipe | `src/app/share-import.tsx` |
| Store / normalize | `src/store/todos.ts` (+ `todos-types`, `todos-helpers`, `todos-recipe-actions`, `todos-normalize`) |
| Siri / Assistant add+read | `features/todos/voice-lists.ts` + `modules/ontrack-voice-lists` |
| Collaboration API | `src/services/todos/collaboration.ts` |
| Recipe AI analyze | `src/app/recipe-imports/analyze+api.ts` + `src/services/recipes/` |

Read [reference.md](reference.md) for the full module map.

## Non-negotiables

- **Kinds:** `ChecklistKind = 'checklist' | 'grocery'`. Grocery detail uses `GroceryListScreen`; checklist uses `ChecklistScreen`.
- **HTTPS recipe URLs:** recipe/meal source URLs must be `https:` when normalized for sync (`cleanHttpsUrl` in `checklists-normalize.ts`).
- **Images:** never persist picker cache URIs; use recipe image helpers / `recipe-media.ts` (`todo-recipe-images` bucket).
- **Shared vs private cloud:** `privateChecklistPayload` excludes shared lists/tasks/recipes and pending mutations from the private sync blob.
- **Roles:** `owner` | `editor` | `member`. Editors edit items (`canEditChecklistContent`); members may only complete unassigned or self-assigned tasks (`canCompleteChecklistTask`). Owner-only: membership, recipes, rename/kind/delete.
- **Optimistic shared edits:** do not apply remote snapshots while that list still has pending mutations (`use-todo-collaboration.ts`).
- **Grocery kind lock:** cannot convert grocery → checklist while recipes still exist.
- **IDs / prompts / dates:** `@/utils/id`, `appPrompt`, `DateField` + local `YYYY-MM-DD`.
- **Agent UI:** `ontrack.checklists.*` + `ontrack.grocery.*` + `ontrack.recipeImport.*` + `ontrack.listSettings.*`. Prefer `./scripts/agent-ui.sh once --flow checklist-demo` / `grocery-demo` / `grocery-demo-recipe-import` / `grocery-demo-settings` (stable ids in `fixtures.ts`) over hand-building lists.

## Sub-area cheat sheet

| Task | Prefer |
|------|--------|
| Lists overview / create | `todo-lists-overview`, `todo-list-card`, `empty-checklists`, `list-icon` |
| Checklist tasks | `todo-list-screen`, `todo-list-header`, `todo-row`, `todo-sort`, `checklist-popover-menu` |
| Grocery meal / combined | `grocery-list-screen`, `grocery-rows`, `grocery-utils` |
| Recipe import | `recipe-import-screen`, `recipe-ingredient-editor`, `services/recipes/*` |
| Share text / links | `share.ts`, `EXPO_PUBLIC_TODO_SHARE_BASE_URL` |
| Collab / join | `collaboration.ts`, `use-todo-collaboration`, `/l` + `/c` join screens |
| Normalize / migrate | `checklists-normalize.ts` |

## When adding modules

Keep `AGENTS.md` as a one-line pointer. Put encyclopedic paths in [reference.md](reference.md).
