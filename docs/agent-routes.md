# Agent routes

Stable deep links and aliases for jumping to onTrack surfaces without tab-hopping or screenshot coordinates (default: iOS Simulator; Android with `AGENT_UI_PLATFORM=android`).

**Prefer these over tapping through the carousel** when you already know the destination.

## Android (when the emulator is the target)

```bash
# One-shot: Metro + Galaxy_S26 + travel demo assert
./scripts/agent-ui-android-travel-demo.sh
./scripts/agent-ui-android-travel-demo.sh --fixture path/to/chase.png

# Or manual pin:
export AGENT_UI_PLATFORM=android
# Optional adb serial pin (also used for screencap / --color):
# export AGENT_UI_DEVICE=emulator-5554
npm run android:ensure:start   # Metro + Galaxy_S26 + reconnect
./scripts/agent-ui.sh verify --route /travel/trip-agent-ui-demo --flow travel-demo \
  --exists travel.planDetail.transportSection
# Push a confirmation screenshot for the photo picker:
npm run android:push-fixture -- path/to/chase.png
# OAuth / Custom Tab paste (best-effort — Chrome may still need long-press Paste):
./scripts/android-clipboard.sh "text to paste"
```

Pin is required when iOS Simulator and Android Emulator are both running — otherwise either app may answer `/next`. Prefer `verify` / `once` **batches** over many solo `send` ops on Android.

**Simulator lease:** agent-ui CLI entrypoints take `.cursor/agent-ui.lockdir` so parallel threads cannot interleave commands on the shared sim. Wait for the holder to finish; escape hatch `AGENT_UI_SKIP_LEASE=1` only.

## Fast path (use this)

```bash
# Fastest when you may already be on the surface (skips flow if route matches)
./scripts/agent-ui.sh verify --route /travel/trip-agent-ui-demo --flow travel-demo \
  --exists travel.planDetail.transportSection \
  --color travel.planDetail.transportSection '#2474A8'

# One-process once chain (flow/open + structural asserts)
./scripts/agent-ui.sh once --flow travel-demo-list \
  --assert-exists travel.list.itinerary.trip-agent-ui-demo \
  --assert-route /travel

# Trip tools (top of plan detail; legacy /hub redirects here)
./scripts/agent-ui.sh once --flow travel-demo-hub \
  --assert-exists travel.planDetail.section.tools \
  --assert-exists travel.list.tripWeather.trip-agent-ui-demo \
  --assert-route /travel/trip-agent-ui-demo

# Food tab — runtime routes drop the (tabs) group (/food, not /(tabs)/food)
./scripts/agent-ui-verify-both.sh --route /food --flow food-demo \
  --exists ontrack.food.home.section.suggestions

# Food Phase 5 surfaces (same runtime-route rule)
./scripts/agent-ui-verify-both.sh --route /food/ai-ideas --flow food-demo \
  --exists ontrack.food.aiIdeas.generate
./scripts/agent-ui-verify-both.sh --route /food/scan --flow food-demo \
  --exists ontrack.food.scan.capture
./scripts/agent-ui-verify-both.sh --route /food/ingredients --flow food-demo \
  --exists ontrack.food.ingredients.search
./scripts/agent-ui-verify-both.sh --route /food/preferences --flow food-demo \
  --exists ontrack.food.preferences.section.diet
./scripts/agent-ui-verify-both.sh --route /food/plan --flow food-demo \
  --exists ontrack.food.plan.section.week
./scripts/agent-ui-verify-both.sh --route /food/community --flow food-demo \
  --exists ontrack.food.community.section.feed

# Leftover sheets: land flows dismiss travel overlays first; or once --dismiss
./scripts/agent-ui.sh once --dismiss --flow travel-demo-hub \
  --assert-exists travel.list.currency.trip-agent-ui-demo

./scripts/agent-ui.sh once --flow travel-demo-add-flight \
  --assert-prefix travel.itineraryAdd.

./scripts/agent-ui.sh once --flow travel-demo-add-activity \
  --assert-exists travel.itineraryAdd.time \
  --assert-exists travel.itineraryAdd.endTime \
  --assert-contains travel.itineraryAdd.time From \
  --assert-contains travel.itineraryAdd.endTime To

# Named flow — seed + navigate + settle in one round trip
./scripts/agent-ui-flow.sh travel-demo
./scripts/agent-ui-flow.sh travel-demo-add-flight
./scripts/agent-ui-flow.sh travel-demo-add-activity
./scripts/agent-ui-flow.sh open-new-trip
./scripts/agent-ui-flow.sh checklist-demo
./scripts/agent-ui-flow.sh grocery-demo
./scripts/agent-ui-flow.sh grocery-demo-recipe-import
./scripts/agent-ui-flow.sh health-demo
./scripts/agent-ui-flow.sh plants-demo
./scripts/agent-ui-flow.sh activity-demo-edit
./scripts/agent-ui-flow.sh workouts-demo
./scripts/agent-ui-flow.sh vision-board-demo-edit
./scripts/agent-ui-flow.sh vehicle-demo-detail
./scripts/agent-ui-flow.sh --list

# Structural asserts (Playwright-style — prefer over screenshots for route/id)
# IDs accept wire ontrack.* or AgentUiIds key paths (travel.planDetail.transportSection)
./scripts/agent-ui-assert.sh --exists travel.newTrip.open
./scripts/agent-ui-assert.sh --route /travel/trip-agent-ui-demo
./scripts/agent-ui-assert.sh --prefix travel.planDetail.
./scripts/agent-ui-assert.sh --color travel.planDetail.transportSection '#2474A8'

# Stable demo fixtures (upsert; do not wipe other domain data)
./scripts/agent-ui-seed.sh travel-demo
./scripts/agent-ui-seed.sh checklist-demo
./scripts/agent-ui-seed.sh grocery-demo
./scripts/agent-ui-seed.sh health-demo
./scripts/agent-ui-seed.sh vehicle-demo
./scripts/agent-ui-seed.sh plants-demo
./scripts/agent-ui-seed.sh activity-demo
./scripts/agent-ui-seed.sh workouts-demo
./scripts/agent-ui-seed.sh vision-board-demo

# One hop to a surface (in-app goto + wait)
./scripts/agent-ui-open.sh travel
./scripts/agent-ui-open.sh travel/trip-agent-ui-demo/add/flight
./scripts/agent-ui-open.sh health/mood

# Custom multi-step batch (waits settle in-app)
./scripts/agent-ui-batch.sh --seed travel-demo --goto travel/trip-agent-ui-demo --wait-prefix travel.planDetail.

# Cheap probes (no dump file)
./scripts/agent-ui-route.sh
./scripts/agent-ui-exists.sh travel.newTrip.open
```

Do **not** dump before every tap when the id is already in [`agent-ui-map.md`](./agent-ui-map.md). Prefer **assert** / **`--color`** for route/id/label/accent claims; screenshot only for broader visual/layout proof.

**Screenshot bug report?** Use the triage ladder in `.cursor/rules/screenshot-triage.mdc`: `./scripts/agent-ui-source.sh` / `--label` → `./scripts/agent-ui-hit.sh` → `./scripts/agent-ui-overlay.sh on` → edit the resolved file. File index: [`agent-ui-sources.json`](./agent-ui-sources.json).

**Mandatory decision tree** (`.cursor/skills/agent-ui/SKILL.md`, stub in `.cursor/rules/agent-ui-selectors.mdc`): `verify` (skip land if on route) → `once`/flow → open/batch → known tap (wire id or `AgentUiIds` path) → dump only if unknown → assert/`--color` or one final screenshot. Budget: ≤1 dump; ≤1 screenshot and only for visual claims. Fail-fast when the daemon is warm (~2.5s simple / ~5s flow). Never re-run a flow just to re-check a screen you’re already on; never prophylactic Metro heal.

## Named flows

| Flow | What it does |
|------|----------------|
| `travel-demo` | Seed demo trip → open plan detail |
| `travel-punta-cana` | Seed Airbnb Punta Cana stay mock → open plan detail (`trip-agent-ui-punta-cana`) |
| `travel-demo-list` | Seed → travel list with demo itinerary button |
| `travel-home` | Seed Iceland/Antigua visual fixtures → Travel Home list. Smoke: `verify-both --route /travel --flow travel-home --exists travel.list.section.yourTrips` (H18 — bare goto fails empty guest) |
| `travel-home-empty` | Clear trips → Travel Home zero-trip welcome (`travel.list.empty.create`) |
| `travel-home-iceland` | Seed travel-home → open Iceland itinerary (`skyDecor`) |
| `travel-demo-add-flight` | Seed → add-flight sheet |
| `travel-demo-timeline-add` | Seed → plan detail → Add to Timeline kind picker |
| `travel-demo-add-flight-connecting` | Seed → United GUA→IAH→LGA connecting prefills Add Flight Name/route |
| `travel-demo-add-flight-roundtrip` | Seed → Chase round-trip prefills → submit → expand outbound card (passenger ready) |
| `travel-demo-add-flight-jetblue` | Seed → JetBlue JFK↔SDQ trip-detail prefills → submit → outbound timeline card |
| `travel-demo-edit-flight` | Seed → open demo flight editor |
| `open-new-trip` | Travel list → New Trip sheet |
| `open-new-checklist` | Checklists → new-list name field ready |
| `open-home-location` | Today → Home location weather sheet |
| `today-prev-day` | Seed home-weather → Today → previous day (H/L banner) |
| `today-next-day` | Seed home-weather → Today → next day (H/L banner) |
| `open-avatar-editor` | Profile → avatar editor sheet |
| `open-developer` | Profile → Developer Tools (Dev Mode toggle; needs developer_tools) |
| `profile-usage-analytics` | Profile → Usage Analytics GlassSwitch row |
| `checklist-demo` | Seed demo checklist → open list detail (task ready) |
| `checklist-demo-list` | Seed → checklists overview with demo list card |
| `checklist-demo-settings` | Seed → checklist settings (add editors) |
| `grocery-demo` | Seed demo grocery list → open meal view (recipe ready) |
| `grocery-demo-combined` | Seed → grocery detail → Combined tab (copy ready) |
| `grocery-demo-recipe-import` | Seed → recipe import URL field ready |
| `grocery-demo-settings` | Seed → grocery detail → settings (list name field) |
| `health-demo` | Seed mood factor + entry → Health Mind section |
| `health-demo-mood` | Seed → mood check-in with demo factor chip |
| `plants-demo` | Seed Monstera sample → plant detail (log watering ready) |
| `plants-demo-list` | Seed → plants list with sample card |
| `plants-demo-log-watering` | Seed → log watering → undo control ready |
| `activity-demo` | Seed mindfulness activity → Today card |
| `activity-demo-detail` | Seed → open generic event detail |
| `activity-demo-edit` | Seed → open activity form editor |
| `workouts-demo` | Seed gym activity → Today’s Plan card |
| `workouts-demo-explore` | Seed → Muscle Explorer (incline-curl add ready) |
| `workouts-demo-anatomy` | Seed → Female + Side anatomy controls (chest chip) |
| `workouts-demo-gym-detail` | Seed → gym detail (Start workout) |
| `workouts-demo-gym-active` | Seed → active workout (Complete set) |
| `vision-board-demo` | Seed sample board → consolidated Mindset filter |
| `vision-board-categories` | Categories dashboard (filter / add / View All) |
| `vision-board-demo-edit` | Seed → Mindset board edit (affirmation + sample canvas item) |
| `vision-board-demo-item-editor` | Seed → select sample item → edit → item editor primary |
| `vehicle-demo` | Seed demo vehicle → vehicles list card |
| `vehicle-demo-detail` | Seed → open vehicle detail |
| `vehicle-demo-expenses` | Seed → expenses section (amount field) |
| `food-demo` | Seed food profile/pantry/recipes/meal plan + meal activity → Food home |
| `food-detail-demo` | Seed → meal detail (edit ready; former `food-demo` landing) |
| `games-balloon-pop` | Games hub → Balloon Pop Play ready |
| `travel-list` / `calendar` / `today` / `checklists` / `health` / `health-mood` / `health-settings` / `activity-form` / `profile` / `vehicles` / `vehicles-new` / `social` / `workouts` / `plants` / `plants-new` / `vision-board` / `games` | Goto + settle |

Demo IDs (`src/utils/agent-ui/fixtures.ts`): travel `trip-agent-ui-demo` / `item-agent-ui-demo-flight` / chase outbound+return; checklist `list-agent-ui-demo-checklist` / `task-agent-ui-demo-plan`; grocery `list-agent-ui-demo-grocery` / `recipe-agent-ui-demo-pasta`; health `factor-agent-ui-demo-work` / `mood-agent-ui-demo-calm`; vehicle `vehicle-agent-ui-demo`; plant `plant-sample-monstera`; activity `activity-agent-ui-demo-mindfulness`; workout `activity-agent-ui-demo-workout`; vision `vision-mindset` / `vision-sample-forest`; food meal `activity-agent-ui-demo-meal` + `recipe-agent-ui-food-*` / `pantry-agent-ui-food-*` / `plan-agent-ui-food-*` (`src/features/food/fixtures.ts`).

Chase traveler-count proof (no dump — stable ids after submit):

```bash
./scripts/agent-ui.sh once --flow travel-demo-add-flight-roundtrip \
  --assert-contains ontrack.travel.flight.passenger.item-agent-ui-demo-chase-outbound "2 Travelers"
```

Host bridge notes:

- Persistent daemon: `scripts/lib/agent_ui_daemon.py` (auto-started) — Unix socket + HTTP `:8191` (`0.0.0.0`)
- App long-polls `http://<packager-host>:8191/next` and POSTs `/status` (Simulator → `127.0.0.1:8191`)
- Optional Metro `/__agent_ui` proxy when `enhanceMiddleware` is honored; not required
- Documents file poll remains as fallback if the daemon is down
- `agent_ui_bridge.py` prefers the daemon, caches the data container under `.cursor/agent-ui-data-dir`
- Prefer `agent-ui.sh once` / `flow` / `batch` / `assert` / in-app `wait`; one shell chain per verification; never mid-flow dump/screenshot; never prophylactic Metro heal
- Warm fail-fast budgets: `AGENT_UI_WARM_WAIT_SECS` (default 2.5) / `AGENT_UI_WARM_FLOW_WAIT_SECS` (default 5); in-app wait ceiling `AGENT_UI_WAIT_TIMEOUT_MS` (default 2000)

## Host commands

```bash
./scripts/agent-ui-open.sh today
./scripts/agent-ui-open.sh calendar
./scripts/agent-ui-open.sh checklists
./scripts/agent-ui-open.sh travel
./scripts/agent-ui-open.sh profile
./scripts/agent-ui-open.sh health
./scripts/agent-ui-open.sh design-system
./scripts/agent-ui-open.sh integrations
./scripts/agent-ui-open.sh reset

# Nested shortcuts
./scripts/agent-ui-open.sh travel/<planId>
./scripts/agent-ui-open.sh travel/<planId>/flights
./scripts/agent-ui-open.sh travel/<planId>/add/flight
./scripts/agent-ui-open.sh travel/<planId>/add/stay
./scripts/agent-ui-open.sh travel/<planId>/add/timeline
./scripts/agent-ui-open.sh travel/<planId>/import
./scripts/agent-ui-open.sh travel/<planId>/expense
./scripts/agent-ui-open.sh travel/<planId>/stay-booking
./scripts/agent-ui-open.sh health/mood
./scripts/agent-ui-open.sh health/settings
./scripts/agent-ui-open.sh plants/new
./scripts/agent-ui-open.sh vehicles/new
./scripts/agent-ui-open.sh checklists/<listId>

./scripts/agent-ui-goto.sh calendar
./scripts/agent-ui-wait.sh --prefix ontrack.today.
./scripts/agent-ui-wait.sh --route /calendar
./scripts/agent-ui-dump.sh --prefix ontrack.travel   # discover only
```

Packager health (reconnect only when needed):

```bash
npm run packager:ensure
# or
npm run packager:ensure:start
```

## In-app agent ops (dev)

- `op=reset` / `op=goto&to=…` / `op=route` / `op=prefix&prefix=…` / `op=exists&id=…` / `op=tap&id=…` / `op=dump`
- `op=assert` — structural checks (`id` / `missing` / `prefix` / `to` route / `contains` label); prefer over screenshots for these claims
- `op=wait` — settle (`ms`) and/or poll until `id` / `prefix` / route (`to`) within `timeoutMs` (default 2000)
- `op=seed&to=…-demo` — upsert stable demo data (`travel|checklist|grocery|health|vehicle|plants|activity|workouts|vision-board`); enters agent Dev Mode sandbox
- `op=devmode&to=on|off|release|status` — Dev Mode sandbox (`release` exits only agent-entered; `off` always exits). Off by default; `verify-both` auto-releases
- `op=flow&to=travel-demo` (or other named flow) — expand named recipe
- `op=batch` with `ops: […]` — run steps in one command

Tap/goto no longer rewrite the dump by default.

## Nested shortcuts

| Shortcut | Resolves to |
|----------|-------------|
| `travel/<id>/add/flight` (also stay, rental, transport, activity, moment, timeline) | `/travel/<id>?add=<kind>` |
| `travel/<id>/import` | `/travel/<id>?previewModal=import` |
| `travel/<id>/expense` | `/travel/<id>?previewModal=expense` (opens Expenses sheet) |
| `travel/<id>/expense-saved` | `/travel/<id>?previewModal=expense-saved` (import success modal QA) |
| `travel/<id>/stay-booking` | `/travel/<id>?openStayBooking=1` |
| `travel/<id>/flights` / `stays` / `chat` | nested routes |
| `health/mood` | `/health/mood-check-in` |
| `health/settings` | `/health/settings` |
| `health/playbook` | `/health/playbook-editor` |
| `plants/new` / `vehicles/new` | create screens |
| `plants/<id>` | `/plants/<id>` |
| `checklists/<id>` | `/to-do/<id>` |
| `checklists/<id>/settings` | `/todos/<id>/settings` |
| `checklists/<id>/recipe-import` | `/todos/<id>/recipe-import` |

## Alias → Expo path → deep link

| Alias | Path | Deep link |
|-------|------|-----------|
| `today` / `home` / `reset` | `/` | `ontrack:///` |
| `calendar` | `/calendar` | `ontrack:///calendar` |
| `checklists` / `todos` / `to-do` | `/to-do` | `ontrack:///to-do` |
| `social` | `/social` | `ontrack:///social` |
| `insights` | `/insights` | `ontrack:///insights` |
| `profile` | `/profile` | `ontrack:///profile` |
| `workouts` | `/workouts` | `ontrack:///workouts` |
| `plants` | `/plants` | `ontrack:///plants` |
| `travel` | `/travel` | `ontrack:///travel` |
| `visionBoard` / `vision-board` | `/vision-board` | `ontrack:///vision-board` |
| `games` | `/games` | `ontrack:///games` |
| `vehicles` | `/vehicles` | `ontrack:///vehicles` |
| `health` | `/health` | `ontrack:///health` |
| `agents` | `/agents` | `ontrack:///agents` |
| `designSystem` / `design-system` | `/design-system` | `ontrack:///design-system` |
| `integrations` / `apiUsage` / `api-usage` | `/integrations` | `ontrack:///integrations` |
| `developer` / `developer-tools` | `/developer` | `ontrack:///developer` |
| `nutrition` | `/nutrition-profile` | `ontrack:///nutrition-profile` |
| `activityForm` / `activity` | `/activity-form` | `ontrack:///activity-form` |
| `privacy` | `/privacy` | `ontrack:///privacy` |
| `terms` | `/terms` | `ontrack:///terms` |

Raw paths also work: `./scripts/agent-ui-open.sh /todos/<listId>/settings`

## Source of truth

Aliases + shortcuts: [`src/utils/agent-ui/route.ts`](../src/utils/agent-ui/route.ts).  
Fixtures + flows: [`fixtures.ts`](../src/utils/agent-ui/fixtures.ts), [`flows.ts`](../src/utils/agent-ui/flows.ts).  
Control IDs: [`docs/agent-ui-map.md`](./agent-ui-map.md) + [`ids.ts`](../src/utils/agent-ui/ids.ts).
