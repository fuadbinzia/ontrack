---
name: workouts
description: >-
  onTrack Fitness addon: Muscle Explorer (male/female, front/side/back plates),
  atlas, exercise catalog, session builder, and schedule-backed gym activities.
  Use when editing src/app/(tabs)/workouts.tsx, src/features/workouts/,
  assets/images/workouts/, gym detail routes, or schedule workout models.
---

# Workouts (onTrack)

## Start here

| Surface | Entry |
|---------|--------|
| Tab (Muscle Explorer + builder) | `src/app/(tabs)/workouts.tsx` |
| Feature modules | `src/features/workouts/` |
| Highlight art (runtime) | `assets/images/workouts/highlights/` (+ `FINISHED_ART.txt`) |
| Gym activity detail | `src/app/(tabs)/(today)/detail/gym/[id].tsx` |
| Active workout session | `src/app/detail/gym-active/[id].tsx` |
| Persistence | **No workouts Zustand store** — `useSchedule` workouts in `src/store/schedule.ts` + `Workout*` in `src/types/models.ts` |
| Addon gate | `src/addons/registry.ts` (`id: 'fitness'`, `tabRoute: 'workouts'`) |

Read [reference.md](reference.md) for the full module map.

## Non-negotiables

- **Finished highlight JPGs are source of truth at runtime** (`highlights/`). Masks under `masks/` / `mask-guides/` are bake-only.
- **Do not overwrite** `assets/images/workouts/highlights/` with bake scripts unless intentional (`FINISHED_ART.txt`).
- **Display path:** `muscle-highlight-plate` / `human-body-map` show finished JPGs; taps use invisible hit boxes in `muscle-hit-targets.ts`.
- **Views / sex:** `AnatomySex` (`male` \| `female`) + `BodyView` (`front` \| `side` \| `back`). One side plate — body treated as symmetrical.
- **Catalog completeness:** tests require highlight JPGs for every workout muscle target / atlas entry.
- **Session data lives on schedule:** `useSchedule` (`upsertWorkout` / activities). Cloud sync is schedule `workouts`, not a separate domain.
- **Addon:** Fitness addon toggles the workouts tab without deleting data.
- **Agent UI:** Prefer `./scripts/agent-ui.sh once --flow workouts-demo` / `workouts-demo-explore` / `workouts-demo-anatomy` / `workouts-demo-gym-detail` / `workouts-demo-gym-active` (`activity-agent-ui-demo-workout`, `incline-curl`) over hand-building sessions. Stamp `ontrack.workouts.*` on interactive controls.

## Sub-area cheat sheet

| Task | Prefer |
|------|--------|
| Tab orchestration | `app/(tabs)/workouts.tsx` |
| Explorer chrome | `muscle-explorer`, `muscle-summary-panel`, `workouts-screen-header` |
| Body map / hits | `human-body-map`, `muscle-highlight-plate`, `muscle-hit-targets`, `muscle-highlight-images` |
| Catalog / atlas | `muscle-data`, `muscle-atlas`, `muscle-atlas-dropdowns`, `atlas-workout-selection` |
| Focus exercises / load | `muscle-focus-exercises`, `exercise-load` |
| Form / motion demos | `exercise-form-steps`, `exercise-motion`, `exercise-anatomy-demo`, `*-animation` |
| Plan / session UI | `workout-today-plan`, `workout-session-builder`, `challenge-friend-button` |
| Art constants | `anatomy-art.ts` |
| Bake scripts (offline) | `scripts/paint-muscle-masks.py`, `render-muscle-highlights.py` |

## When adding modules

Keep `AGENTS.md` as a one-line pointer (+ Muscle Explorer shared pattern). Put encyclopedic paths in [reference.md](reference.md).
