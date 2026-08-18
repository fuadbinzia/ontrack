# Vision board module map

Paths under `src/features/vision-board/` unless noted.

## Screens / UI

- `vision-board-dashboard.tsx` — board home
- `vision-board-category-screen.tsx` — category detail
- `vision-board-category-editor.tsx` — create/edit category
- `vision-board-gallery.tsx` — gallery layout
- `vision-board-item-editor.tsx` — create/edit item
- `vision-board-item-card.tsx`, `vision-board-canvas-item.tsx`
- `vision-board-background.tsx`
- `vision-board-consolidated.tsx`, `consolidated-card.tsx`

## Models / helpers

- `types.ts`, `defaults.ts`, `selectors.ts`, `sample.ts`
- `canvas.ts` — layout math
- `consolidated-model.ts`
- `media.ts` — image prepare/persist

## Store / tests

- `src/store/vision-board.ts`
- `__tests__/canvas.test.ts`, `selectors.test.ts`, `schema.test.ts`, `sample.test.ts`
