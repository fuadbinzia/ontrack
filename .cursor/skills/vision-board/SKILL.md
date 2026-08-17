---
name: vision-board
description: >-
  onTrack vision board: dashboard, categories, canvas items, consolidated cards,
  media persist, and Zustand store. Use when editing src/features/vision-board/,
  src/store/vision-board.ts, or vision-board app routes.
---

# Vision board (onTrack)

## Start here

| Surface | Entry |
|---------|--------|
| Dashboard | `src/features/vision-board/vision-board-dashboard.tsx` |
| Category screen | `src/features/vision-board/vision-board-category-screen.tsx` |
| Item editor | `src/features/vision-board/vision-board-item-editor.tsx` |
| Store | `src/store/vision-board.ts` |
| Types / defaults | `types.ts`, `defaults.ts`, `selectors.ts` |

Read [reference.md](reference.md) for the module map.

## Non-negotiables

- **Images:** never persist picker cache URIs — use `media.ts` helpers (`@/utils/image-persist`).
- **Responsive chrome:** prefer `useResponsive()` / `AppText fit`; avoid hard-coded `fontSize` on chrome when touching StyleSheets.
- **IDs:** `@/utils/id` for local entities.
- **Prompts:** `appPrompt` only.
- **Agent UI:** Prefer `./scripts/agent-ui.sh once --flow vision-board-demo` / `vision-board-demo-edit` / `vision-board-demo-item-editor` (`vision-mindset`, `vision-sample-forest`) over hand-building boards. Stamp `ontrack.vision.*` on interactive controls.
- Keep `AGENTS.md` as a one-line pointer; encyclopedic paths go in [reference.md](reference.md).

## Sub-area cheat sheet

| Task | Prefer |
|------|--------|
| Dashboard / home | `vision-board-dashboard`, `vision-board-background` |
| Category browse | `vision-board-category-screen`, `vision-board-gallery` |
| Items / cards | `vision-board-item-card`, `vision-board-canvas-item`, `vision-board-item-editor` |
| Consolidated view | `vision-board-consolidated`, `consolidated-card`, `consolidated-model` |
| Canvas math | `canvas.ts` |
| Media | `media.ts` |
