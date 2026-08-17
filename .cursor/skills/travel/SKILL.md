---
name: travel
description: >-
  onTrack travel domain map, sheet chrome, confirmation import, stays/flights/rentals,
  expenses/FX, trip roster, and destination covers. Use when editing travel plans,
  itinerary, bookings, trip chat, join codes, or files under src/features/travel/,
  src/services/travel/, or travel-related app routes.
---

# Travel (onTrack)

## Start here

| Surface | Entry |
|---------|--------|
| Tab / list | `src/app/(tabs)/travel/index.tsx` + `travel-home-your-trips.tsx` / `travel-home-empty.tsx` / `travel-home-*.tsx` — design kit `design/travel/` |
| Header flight motif | `travel-home-icons.tsx` `TravelHomeRouteMotif` + `design/travel/assets/icons/travel-route.svg` — match via `design/travel/GLYPH_MATCHING.md` |
| Trip tools page | `travel-trip-tools-screen.tsx` + `travel-plan-trip-tools.tsx` (+ glass `TravelSheetAction`); legacy `/hub` redirects to `/tools` |
| Plan detail | `src/features/travel/travel-plan-detail.tsx` |
| Types / store-ish models | `src/features/travel/types.ts` |
| StraiAway stay handoff | `stay-package.ts` + `services/partner/` + Profile → StraiAway |
| Shared trip expenses API | `src/services/travel/expense-collaboration.ts` |
| Open join | `src/app/j/[code].tsx` (landing in `open-join-landing.tsx`) |

Read [reference.md](reference.md) only when you need the full module map for a sub-area.

## Non-negotiables

- **Glass UI:** Travel chrome is glass only — `GlassPlate` / `Card airy` / `GlassTonePill` / `GlassIconWell` / `GlassMetaChip` / `glassFieldBackground`. No opaque paper fills (`backgroundElevated` / `backgroundSunken` / `accentFaint` / solid `kindTint` wells). Repo rule: `.cursor/rules/glass-ui.mdc`.
- **Sheets:** every travel sheet uses canonical `travel-sheet` frame/header (`travel-sheet.tsx`) with frosted `surface="glass"` (via `TravelSheetModal` / direct `SheetScaffold`) and `SheetGrabber` dismiss (not header X). In-tree add sheet (`travel-itinerary-add-sheet`) matches the same glass plate. Full-screen chat uses `TravelSheetHeader presentation="page"` (keeps X). Do not invent a parallel sheet chrome or solid elevated paper for Travel modals.
- **IDs:** travel entities use `@/utils/id` (`newId` / `newUuid` / `newPrefixedUuid`) — no ad-hoc generators.
- **Stay confirmation address:** only extract high-confidence addresses (explicit labels, recognized street formats, or clean multi-part geographic locations). If unclear/ambiguous (phone numbers, date lines, noise), leave address blank for manual entry.
- **Flight confirmation schedules:** every confirmation consumer (New Trip, itinerary add/edit, and future flows) must use `flight-confirmation-parser` plus `flight-confirmation-schedule`. Do not read `imported.date` or calculate arrival dates independently in screens/hooks; OCR date fallback and connecting-flight arrival must remain identical across screenshot, PDF, and saved-email imports.
- **Flight connection drafts:** when a confirmation has connecting segments, the Add Flight review draft must preserve the first segment's `layoverMinutesAfter` (formatted with `formatLayoverDuration`) while using the last segment's airport as the final destination. Review **Name** uses `formatFlightTitle` / `formatFlightRouteLabel` so hubs appear (`Flight GUA → IAH → LGA`), not only the first leg.
- **Flight round-trip drafts:** departing + returning (including same-day / overnight turnarounds) must not be collapsed into one connecting journey — `isConnectingSegmentGroup` rejects return-to-origin, and `isRoundTripSegmentGroup` requires a reverse-route pair (not multi-city). Add Flight uses a One-way / Roundtrip toggle (`flight-roundtrip-draft`, `FlightReturnLegFields`); roundtrip shows Departing / Returning sections with Returning name + schedule + airline/number/airports **and layover/connection fields on both sides**. Split directions with `splitRoundTripDirections` so a layover inside outbound (or return) still collapses that side via `mergeFlightConfirmationDraftDetails`. Submit expands both via `segmentsFromRoundTripForm` → `applyImportedFlightsToPlan` (TZ-aware `calculateFlightDuration`; form edits win over stored connecting `legs`).
- **Flight import review:** importing into an Add Flight sheet only populates the draft. Never call `updatePlan` or create itinerary segments until the user presses the sheet’s submit action.
- **Dates:** editable calendar dates use `DateField`; keys are local `YYYY-MM-DD` via `@/utils/date`.
- **Prompts:** `appPrompt` only — never RN `Alert` / `ActionSheetIOS`.

## Sub-area cheat sheet

| Task | Prefer |
|------|--------|
| New / edit sheet UI | `travel-new-trip-sheet`, `travel-sheet`, `travel-dialog-chrome`, `travel-itinerary-sheet-chrome` |
| Itinerary timeline | `travel-itinerary-timeline`, `travel-timeline-node` (+ `-chrome`), `travel-timeline-add-modal` |
| Flights | `flight-details-*`, `flight-schedule`, `flight-confirmation-parser` + `flight-confirmation-schedule` (shared import dates), `apply-imported-flights` |
| Stays | `stays/*`, `stay-details*`, `stay-confirmation-*` |
| Rentals | `rental-details*`, `rental-confirmation-*`, `apply-imported-rental` |
| Expenses / FX | `expenses/travel-expenses-sheet`, `expenses/fx-rates`, `expenses/fx-providers` (`ACTIVE_FX_PROVIDER`) |
| Currency UI | `travel-currency-*`, `currency-for-destination` |
| Covers | `destination-cover*` — Unsplash-first scenic + Wiki lead; people/text filters in `destination-cover-lookup` (no Commons search) |
| Roster / friends | `travel-friends-sheet`, `travel-friends-join-panels`, `trip-people`, `trip-friend-row`, `trip-roster` |
| Itinerary visibility / sync | `itinerary-visibility` (trip-wide; no per-stop gate), `services/travel/itinerary-collaboration` (+ shared `travel-collaboration-shared`) |
| Home sky / atmosphere | `use-travel-home-atmosphere-image` → `travel-home-atmosphere-resolve` / `-queries` / `-catalog`; trip header sky → `travel-header-sky-decor` + `use-travel-sky-quality` (`paintTravelSkyQuality`: non-`full` → frozen SVG `minimal`, never photo still) → `travel-sky-day` / `travel-sky-night` (+ `travel-sky-motion-layer`, climate banks, ground) |
| Group chat | `travel-chat-screen` (+ `use-travel-chat-session` / `use-travel-chat-actions` / `travel-chat-access-gate` / `travel-chat-alerts`) + `travel-chat-message-row` / `composer` / `message-menu`, `chat` — realtime, reply/edit/delete, reactions, ticks, typing; entry via hero `planDetail.groupChat` |
| Weather | `weather/travel-weather-sheet` + `weather/temperature-unit` (`temperatureUnitForDateFormat`) |

## Verify travel UI (fast path)

Do **not** explore with dump/screenshot loops. If a dump is unavoidable, retire it same turn (stamp id/map/flow — agent-ui skill). Prefer `verify` when you may already be on the surface (skips land):

```bash
# Already on plan detail? — skips travel-demo when route matches
./scripts/agent-ui.sh verify --route /travel/trip-agent-ui-demo --flow travel-demo \
  --exists travel.planDetail.notesSection

# Cold land (not on the surface yet)
./scripts/agent-ui.sh once --flow travel-demo --assert-exists travel.planDetail.weather
./scripts/agent-ui-flow.sh travel-demo-add-flight   # Add Flight sheet
./scripts/agent-ui-flow.sh open-new-trip            # New Trip sheet
# chain --tap / --assert-* in one once; STOP after assert — screenshot only if visual
```

Stable ids: `trip-agent-ui-demo`, `item-agent-ui-demo-flight`. Nested opens: `travel/<id>/add/flight`, `…/import`. See `docs/agent-routes.md`.

## When adding modules

Keep `AGENTS.md` as a one-line pointer. Put new encyclopedic paths in [reference.md](reference.md), not in always-on docs.
