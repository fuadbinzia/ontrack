# Checklists Product Spec (living)

How checklists and grocery lists **should behave** for the user. This is the
product contract — implementation details live in code and the checklists
skill.

**Update protocol (mandatory):** any change to checklist/grocery behavior
updates this file in the same change. New behavior → new bullet; changed
behavior → edit the bullet; add the regression test that enforces it to
[Regression guards](#regression-guards).

## Lists hub — `/(tabs)/to-do`

- One flat catalog of all lists (private + shared) in **one persisted order**.
  The stored array is the only source of truth — no hidden re-sorting, no
  recency sort on load, browse and Edit show the identical order.
- Order changes only three ways:
  1. **Create** — the new list goes to the top and opens immediately.
  2. **Open** — the opened list is promoted to the top (rapid re-opens within
     750ms do not re-promote).
  3. **Reorder** — dragging in Edit mode is preserved exactly as dropped.
- First paint is complete and at rest: every card present, no items loading
  in, no visible reshuffle, no entrance replay on tab land.
- **Tapping a card opens exactly that list — including the very first tap
  after launch.** Route warming/prefetch must never change the destination or
  the order (a warm mount does not count as an open).
- Edit mode: inline rename (owners only), drag to reorder, remove. Browsing
  never starts a drag.
- Empty state invites creating the first list.

## Opening a list

- An "open" counts only when the detail screen actually gains focus.
- The promotion is pushed to the cloud immediately — killing the app right
  after opening must not lose it.
- Detail renders checklist or grocery UI by list kind; while a list is being
  deleted the last-visible list is held so the screen exits to the hub without
  a "List Unavailable" flash.

## Order persistence & restore

- The order (including the promoted top list) survives: app restart, device
  restart, sign-out → sign-in, and reinstall + sign-in.
- The private cloud blob carries the **full catalog order** (private + shared
  ids) and per-list open recency; opening a list is not a list edit (never
  bumps `updatedAt`, never queues a shared mutation).
- Restore rules:
  - Private lists come back in their saved order.
  - Shared lists reclaim their saved position when they reload — never blindly
    appended — regardless of whether the shared catalog or the private blob
    lands first.
  - Lists created after the last sync stay above restored positions.
  - A shared list never seen before (fresh invite) appends at the end.
  - Rejoining a list after leaving it is a fresh invite — it appends at the
    end instead of reclaiming its pre-leave slot.
- A mid-session cloud pull never reshuffles lists already on the device; a
  stale remote order cannot demote a locally promoted list.
- A stale private blob row for a list that is shared on this device never
  duplicates the list — the shared copy is authoritative.

## Collaboration

- Roles: `owner` / `editor` / `member`. Editors change items; members only
  complete unassigned or self-assigned tasks. Owner-only: membership, recipes,
  rename, delete.
- List settings (owner) keep List Name and Sharing. They do not show a List
  Type picker or Checklist / Grocery conversion controls — kind stays whatever
  the list already is.
- Owner delete removes the list for every collaborator; editors/members leave
  instead. Share/join via `/l/<code>` (single list) and `/c/<code>`
  (collaborator multi-list).
- Remote snapshots are not applied to a list that still has pending local
  mutations.
- Leaving or deleting a list wins over any catalog reload already in flight —
  a stale snapshot must not resurrect the list.
- A snapshot that omits `recipes` (or `categories`) leaves those groups
  unchanged; only an explicit array — even empty — replaces them.

## Grocery lists

- Kind `grocery` gets the grocery detail (meal/combined views, recipes,
  ingredient rows); the store still refuses grocery → checklist while recipes
  exist, but settings no longer offers that conversion.
- Recipe/meal source URLs are `https:` only; recipe images are re-encoded and
  persisted (never picker cache URIs).

## Voice (Siri / Assistant)

- Add-to-list and read-list work by voice using static shortcut phrases;
  voice writes land in the same store and follow the same ordering rules.

## Regression guards

| Behavior | Test |
|---|---|
| Order stays put on land; opens are focus-only; recency sort stays deleted; opens flush to cloud | `src/features/todos/__tests__/checklist-hub-order.test.ts` |
| First tap opens the tapped list (preloaded-route params fix); hub warms only the top route | `src/features/todos/__tests__/checklist-open-target.test.ts` + `patches/expo-router+*.patch` |
| Promotion + order survive restart and sign-in restore (private and shared, both sync arrival orders) | `src/store/__tests__/todos-open-and-sync.test.ts` |
| Browse list is static; drag only in Edit | `src/features/todos/__tests__/todo-list-scroll-style.test.ts` |
| Roles / completion permissions | `src/services/todos/__tests__/collaboration-core.test.ts` |
| No duplicate list id from a stale private row; omitted snapshot recipes preserved; rejoin appends | `src/store/__tests__/todos-open-and-sync.test.ts` |
| Leave/delete during an in-flight catalog reload does not resurrect the list | `src/services/todos/__tests__/collaboration-reload.test.ts` |
| Private list settings keep List Name and Sharing and never show List Type / Checklist / Grocery | `src/features/todos/__tests__/todo-list-settings-screen.test.tsx` |
