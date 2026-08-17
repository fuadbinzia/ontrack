# Workouts module map

Paths under `src/features/workouts/` unless noted.

## App / schedule surfaces

- `src/app/(tabs)/workouts.tsx` — Muscle Explorer tab orchestration
- `src/app/(tabs)/(today)/detail/gym/[id].tsx` — gym activity detail
- `src/app/detail/gym-active/[id].tsx` — live set/rest session
- `workout-calendar.tsx` / `workout-calendar-model.ts` — selected-day navigation + scheduled workout breakdowns
- `workout-day-planner.tsx` / `workout-day-planner-model.ts` — inline selected-day gym window, exercises, sets, reps, and weights
- `weight-unit.ts` — locale-region weight units and pound/kilogram persistence conversion
- `src/store/schedule.ts` — `workouts[]`, `upsertWorkout`
- `src/types/models.ts` — `Workout`, `WorkoutExercise`, `WorkoutSet`, `WorkoutRecommendation`
- `src/addons/registry.ts` — Fitness addon → `tabRoute: 'workouts'`

## Tab chrome / explorer

- `workouts-screen-header.tsx` — Strength Studio header + schedule pill
- `muscle-explorer.tsx` — sex/view toggles, atlas dropdowns, map stage, chips
- `muscle-summary-panel.tsx` — selected muscle summary + related targets
- `use-muscle-explorer-state.ts` / `muscle-explorer-selection.ts` — selection orchestration (when present)

## Body map / highlights

- `human-body-map.tsx` — full-bleed finished JPG + invisible hit boxes
- `muscle-highlight-plate.tsx` — plate image wrapper
- `muscle-highlight-images.ts` — require() catalogs per sex/view
- `muscle-highlight-map.ts` — highlight id → path ids
- `muscle-hit-targets.ts` — `MUSCLE_HIT_BOXES`, `muscleAtPoint`
- `anatomy-art.ts` — `ART_VIEWBOX`, `ANATOMY_BEIGE`

## Atlas / catalog data

- `muscle-data.ts` — `BodyView`, `AnatomySex`, groups, targets, `EXERCISES_BY_ID`
- `muscle-atlas.ts` — anatomical atlas entries/categories
- `muscle-atlas-dropdowns.tsx` — category/muscle dropdown UI
- `atlas-workout-selection.ts` — atlas pick → workout selection
- `format-muscle-label.ts`, `exercise-load.ts`

## Exercise focus / session UI

- `muscle-focus-exercises.tsx`
- `workout-session-builder.tsx`
- `workout-day-planner.tsx`, `workout-day-planner-model.ts`
- `workout-today-plan.tsx`
- `challenge-friend-button.tsx`

## Anatomy demos / motion

- `exercise-anatomy-demo.tsx`, `exercise-anatomy-still.tsx`
- `exercise-form-steps.ts`, `exercise-motion.ts`
- `bench-press-animation.tsx`, `front-plank-animation.tsx`
- `generic-anatomy-figure.tsx`

## Assets (`assets/images/workouts/`)

- `highlights/*.jpg` — **runtime** finished plates (`FINISHED_ART.txt`)
- `masks/*.png` + `mask-guides/` — offline bake inputs only
- `steps/bench-press/`, `steps/bench-press-female/` — motion step frames

## Feature tests

- `__tests__/muscle-data.test.ts`, `muscle-atlas.test.ts`, `muscle-highlight-images.test.ts`
- `__tests__/muscle-hit-targets.test.ts`, `exercise-load.test.ts`, `exercise-motion.test.ts`
- `__tests__/exercise-form-steps.test.ts`, `format-muscle-label.test.ts`
- `__tests__/workout-calendar-model.test.ts`, `workout-day-navigator-contract.test.ts`, `workout-day-planner-model.test.ts`, `workout-day-planner-sheet-contract.test.ts`
- `__tests__/weight-unit.test.ts`

## Agent routes / IDs

- Alias: `workouts` → `/workouts`
- Tab: `ontrack.tabs.workouts`
