# Checklists module map

Paths under `src/features/todos/` unless noted.

## App routes

- `src/app/(tabs)/to-do/index.tsx` — lists overview shell
- `src/app/(tabs)/to-do/[id].tsx` — routes by `list.kind` to checklist or grocery screen
- `src/app/todos/[id].tsx` — legacy redirect to tab detail
- `src/app/(tabs)/to-do/[id]/settings.tsx` — list settings
- `src/app/(tabs)/to-do/[id]/recipe-import.tsx` — recipe import for a grocery list
- `src/app/todo-invites.tsx` — email invites inbox
- `src/app/todo-collaborators.tsx` — collaborators management
- `src/app/l/[code].tsx` — single-list share join (`ChecklistJoinScreen`)
- `src/app/c/[code].tsx` — multi-list collaborator join (`ChecklistCollaboratorJoinScreen`)
- `src/app/share-import.tsx` — incoming OS share → grocery recipe destination
- `src/app/recipe-imports/analyze+api.ts` — authenticated recipe analyze API

## Lists overview / chrome

- `todo-lists-overview.tsx` — create/rename lists, edit mode, navigate into lists
- `todo-lists-overview-header.tsx` — overview heading + new-list composer
- `todo-list-remove.ts` — shared leave/delete confirm + mutation
- `todo-list-card.tsx` — list card UI (grocery vs checklist chrome)
- `empty-checklists.tsx` — empty illustration for no lists
- `todo-empty-state.tsx` — empty state inside a list
- `list-icon.ts` — icon from kind/name heuristics
- `checklist-popover-menu.tsx` — list/task action menus

## Checklist detail

- `todo-list-screen.tsx` — checklist orchestration (add/reorder/sort/complete)
- `todo-list-header.tsx` — hero, add field, filter/sort/edit chrome
- `todo-row.tsx` — task row
- `todo-sort.ts` — sort modes

## Grocery / recipes (feature UI)

- `grocery-list-screen.tsx` — meal vs combined views
- `grocery-rows.tsx` — row renderers
- `grocery-utils.ts` — parse quantities, combine ingredients, scale servings
- `recipe-import-screen.tsx` — URL/image import + review (owner + grocery only)
- `recipe-ingredient-editor.tsx` — edit imported ingredient lines
- `share.ts` — format/share list text + share base URL

## Collaboration UI

- `todo-list-settings-screen.tsx` — rename, share, members, ownership transfer, leave/delete
- `todo-collaborators-screen.tsx` — collaborators surface
- `todo-invites-screen.tsx` — pending invites
- `todo-join-screen.tsx` — `/l/{code}` join
- `todo-collaborator-join-screen.tsx` — `/c/{code}` join

## Store

- `src/store/todos.ts` — Zustand `useChecklists` orchestration
- `src/store/todos-types.ts` — shared checklist entity / persist types
- `src/store/todos-helpers.ts` — `canCompleteChecklistTask`, `privateChecklistPayload`, mutation queue helpers
- `src/store/todos-recipe-actions.ts` — grocery recipe/ingredient store actions
- `src/store/todos-normalize.ts` — normalize + `cleanHttpsUrl` + grocery kind migration
- `src/store/__tests__/todos.test.ts`
- `src/features/todos/voice-lists.ts` — Siri / Assistant snapshot + pending-op apply
- `src/features/todos/use-voice-lists-sync.ts` — hydrate pending voice adds
- `modules/ontrack-voice-lists` — native file bridge (`OnTrackVoiceStore` is the single iOS/Android store; plugin copies it into the app for App Intents)
- `plugins/with-ontrack-voice-lists.js` — App Intents + Assistant shortcuts

## Services

- `src/services/todos/collaboration.ts` — publish/flush/snapshot/invites/share links
- `src/services/todos/recipe-media.ts` — shared recipe images (`todo-recipe-images`)
- `src/hooks/use-todo-collaboration.ts` — load shared lists, flush, subscribe
- `src/services/recipes/client.ts` / `server.ts` / `types.ts` — analyze via `vision-transport`
- Cloud domain `'todos'` in `src/services/cloud/sync.ts`

## Feature tests

- `__tests__/grocery-utils.test.ts`, `share.test.ts`, `list-icon.test.ts`, `voice-lists.test.ts`

## Agent routes / IDs

- Alias: `checklists` / `todos` / `to-do` → `/to-do`
- Prefix: `ontrack.checklists.*`
