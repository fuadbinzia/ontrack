# onTrack agent guide

iOS-first, local-first daily-life Expo app (schedule, food, fitness, plants, travel, todos, vision board). Add-ons toggle without deleting data.

**Token mandate:** keep always-on context slim; put domain depth in `.cursor/skills/<domain>/`; prefer Shared patterns over copies; extract when a touched file would stay **>700 lines**. Session essentials: `.cursor/rules/ontrack-core.mdc`. Device/simulator testing is **opt-in only**: never run it unless the user explicitly asks in the current task. When requested, read `.cursor/skills/agent-ui/SKILL.md` before verifying.

## Cursor compatibility

- Treat `.cursor/rules/*.mdc` and inherited `../.cursor/rules/*.mdc` as Codex project instructions: read `ontrack-core.mdc` plus every rule with `alwaysApply: true` at task start, then read every rule whose `globs` match files you inspect or change. The rule body is authoritative; do not rely only on this summary.
- Cursor skills are exposed to Codex through `.agents/skills/`. Load the matching skill before domain work, and follow its linked references when relevant.

## Stack

- Expo SDK 57 / Expo Router / React Native 0.86 / React 19
- Zustand + AsyncStorage (`src/store/`); optional Supabase (`src/services/cloud/`)
- Design system: `src/design-system/` + `src/components/primitives/`; alias `@/*` → `src/*`
- Expo docs **v57.0.0** only: https://docs.expo.dev/versions/v57.0.0/

## Layout

| Path | Role |
|------|------|
| `src/app/` | Expo Router screens + API routes (`*+api.ts`) |
| `src/features/` | Feature UI/models |
| `src/store/` | Zustand; checklist normalize in `todos-normalize.ts` |
| `src/services/` | AI, cloud, domain clients, HTTP |
| `src/utils/` | Dates, IDs, parse, image persist, agent-ui |
| `src/addons/` | First-party add-on catalog |
| `supabase/` | Migrations / RLS — `supabase db push` after changes |

## Commands (agents)

- Metro / Android / APK / `push` / user-requested dual verify → `package.json` scripts + **agent-ui** / **android-release-apk** skills. **Never** `npm start` in agent shells. Node 24 (`.nvmrc`).
- Pull latest remote main into this branch → **sync-from-main** skill (`./scripts/sync-from-main.sh`).
- `npm run typecheck` · `npm test` · `npm run lint` — prefer leaving Metro up for Fast Refresh.

## Agent close-out

App-affecting → typecheck/tests. Do **not** run device, simulator, emulator, or dual-platform UI verification unless the user explicitly requests it in the current task. Stamp `ontrack.*` testIDs. New or materially changed user journeys → add/update a named recipe in `src/utils/agent-ui/flows-*.ts`; the Living System Map discovers those recipes automatically. Migrations → `supabase db push` same turn.

## Non-negotiable UI

- **Glass UI:** product chrome is glass — see `.cursor/rules/glass-ui.mdc`.
- **Smooth transitions:** pages, sheets, add/remove, open/close ease — `Presence` / `useListEnterIds` / sheet `held` exit. Page open stays at rest. Never snap-unmount visible chrome.
- **Safe area:** `AppSafeArea`; never `insets.top` in scroll content; native Modals pad non-scrolling parent with `insets.top`.
- **Responsive:** `useResponsive()` + `AppText fit` — `.cursor/rules/responsive-layout.mdc`.
- **Field icons:** `FieldLeadingIcon` + `fieldLeadingIconRowStyle` — vertically centered.
- **Dates:** `DateField`; keys `YYYY-MM-DD` via `@/utils/date`.
- **Prompts:** `appPrompt` only — never RN `Alert` / `ActionSheetIOS`. Cancel = top-right X.
- **No redundant actions:** one local outcome → one control.

## Feature entry points

Domain depth → `.cursor/skills/` (**travel**, **todos**, **workouts**, **vision-board**, **health**, **agent-ui**, **android-release-apk**).

| Change | Start here |
|--------|------------|
| Checklist / grocery list UI | `features/todos/todo-list-screen.tsx` → **todos** |
| Lists overview / create list | `features/todos/todo-lists-overview.tsx` |
| Grocery meals / combined | `features/todos/grocery-list-screen.tsx` |
| Recipe import | `features/todos/recipe-import-screen.tsx` |
| Checklist store / normalize | `store/todos.ts`, `store/todos-normalize.ts` → **todos** |
| Voice add/read (Siri / Assistant) | `features/todos/voice-lists.ts` + `modules/ontrack-voice-lists` |
| Today / day timeline | `features/daily-tracking/day-view.tsx` |
| Activity add/edit | `app/activity-form.tsx` |
| Meal photo / link analysis | `app/detail/food/[id].tsx`, `services/nutrition/` |
| Plants | `app/(tabs)/plants/index.tsx`, `app/(tabs)/plants/`, `features/plants/` |
| Travel | `app/(tabs)/travel/` (home + itinerary stack), `features/travel/travel-plan-detail.tsx` → **travel** |
| Social / friends | `app/(tabs)/social.tsx`, `features/social/`, `services/friends`, `store/friends` |
| Vision board | `features/vision-board/` → **vision-board** |
| Workouts | `app/(tabs)/workouts.tsx` → **workouts** |
| Vehicles | `app/(tabs)/vehicles/index.tsx`, `features/vehicles/`, `store/vehicles.ts` |
| Health | `app/(tabs)/health/index.tsx`, `features/health/`, `store/health.ts` → **health** |
| Finance | `app/(tabs)/finance/`, `features/finance/`, `store/finance.ts` → **finance** |
| Journal | `app/(tabs)/journal/`, `features/journal/`, `store/journal.ts` → **journal** |
| StraiAway partner | `app/(tabs)/profile/straiaway`, `services/partner/`, `features/travel/stay-package.ts` |
| Games | `app/(tabs)/games.tsx`, `features/games/` |
| Auth / guest | `features/auth/` |
| Tab bar / Trackers pins | `components/navigation/bottom-nav-bar.tsx`, `tab-pins` store, `/(tabs)/trackers` |
| Airbnb Punta Cana stay mock | seed/flow `travel-punta-cana` → `trip-agent-ui-punta-cana`; OCR fixture `fixtures/airbnb-punta-cana-trips-page.ts` |
| Profile avatar | `features/account/profile-avatar.tsx` |
| Backup / Google Drive | `app/(tabs)/profile/backup.tsx`, `features/account/backup-*.ts` |
| Dev Mode | Off by default. Seeds enter agent sandbox; `devmode release` / `verify-both` / cold start exit it (hub toggle too). → `dev-mode-controller.ts`, `dev-access.ts` |
| Cloud sync | `services/cloud/sync.ts` |
| Design tokens / DateField | `design-system/`, `components/primitives/` |

## Shared patterns (prefer these)

- **IDs:** `@/utils/id` — `newId` / `newUuid` / `newPrefixedUuid`
- **Parse / numeric:** `@/utils/parse` (`sanitizeNumericInput`, …); see `numeric-input.mdc`
- **Persist:** `@/services/storage` `createPersistStorage`
- **List equality / idle:** `@/utils/list-equality`, `@/utils/defer-until-idle`
- **Perf / capability:** `@/utils/device-capability` + `usePerformanceTier` — gate blur, loop motion, sensors, SharedTransition; travel sky uses `planTravelSkyFx`
- **API / vision:** `@/services/http/api-url` + `api-client`; `@/services/ai/vision-transport`
- **Images:** `@/utils/image-persist`, `@/utils/pick-image`
- **Destructive:** `@/utils/confirm-destructive`
- **Motion / presence:** `Presence` + `useListEnterIds` / `listEntering` (just-added only) / `useSettledListLayout` / `popoverEntering` — prefer over ad-hoc `FadeInDown.duration(n)`; sheets hold through exit (`useSheetDismissPan` `held`)
- **UI primitives:** `LoadingBlock`, `EmptyState`, `Dropdown`, `SettingsGroup`/`SettingsRow`, `DangerZone`, `StatusBadge`, `MetaList`, `ActionChip`, `useSafeAreaChrome`
- **Responsive / field icons:** `useResponsive`, `AppText fit`, `FieldLeadingIcon` + `fieldLeadingIconRowStyle`
- **Agent UI:** `@/utils/agent-ui` + scripts — **agent-ui** skill (navigation decision tree: `verify` → flow/open → tap → one dump → assert; never re-run a flow just to re-check a screen you’re already on)
- **Typography:** `typeConfig` / `appTextStyle` / `AppText` (bold only when explicit)
- **Pull-to-refresh:** `usePullToRefresh` / `refreshAppData` (default on `Screen`; `refresh={false}` on dense editors)
- **Muscle Explorer:** `assets/images/workouts/highlights/` — male/female × front/side/back; `muscle-highlight-plate` + hit boxes

## State & sync

Local-first Zustand; guests local until SSO. Cloud sync debounced (`services/cloud/sync.ts`). `startCloudSync` is a no-op stub — do not revive polling. Secrets server-side / EAS only.

## Pitfalls

- Never persist image-picker cache URIs — re-encode via image helpers.
- Recipe/meal source URLs must be `https:` when normalized for sync.
- Entity IDs via `@/utils/id` — no ad-hoc generators.
- Keep platform extensions (`*.ios.tsx`, …) — Metro resolves them.
- **Avatar initials:** fixed `Text` + `avatarInitialsFontSize()` — never `AppText fit` inside `ProfileAvatar`.
- Travel pitfalls → **travel** skill.
