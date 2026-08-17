# Agent UI map

Stable `testID`s for AI agents driving the iOS Simulator. Prefer these over screenshot coordinates.

Convention: `ontrack.<feature>.<surface>.<control>`

## Screenshot → code (fast path)

When a user posts a UI screenshot, do **not** browse the tree. Resolve a reference point:

```bash
# Visible label / chrome text → candidate ids
./scripts/agent-ui-source.sh --label "Transport"

# Known id / AgentUiIds key path → source files + feature entry
./scripts/agent-ui-source.sh travel.planDetail.transportSection

# Point on the live sim (logical window points) → id + files
./scripts/agent-ui-hit.sh 200 480
./scripts/agent-ui-hit.sh --pixel 600 1440   # screenshot pixels ÷ scale

# Burn ids into the screenshot (DEV overlay; pointerEvents=none)
./scripts/agent-ui-overlay.sh on
./scripts/agent-ui-overlay.sh off
```

Generated index: [`docs/agent-ui-sources.json`](./agent-ui-sources.json) (`npm run agent-ui:sources`). Triage rule: `.cursor/rules/screenshot-triage.mdc`.

Each map row below is a stable id; use `agent-ui-source.sh` for the **file** column (generated — stays in sync without hand-maintaining hundreds of paths here).

## Host commands

```bash
# Named flow (seed + navigate + settle — preferred)
./scripts/agent-ui-flow.sh travel-demo
./scripts/agent-ui-flow.sh travel-punta-cana
./scripts/agent-ui-flow.sh travel-demo-add-flight
./scripts/agent-ui-flow.sh open-new-checklist
./scripts/agent-ui-flow.sh profile
./scripts/agent-ui-flow.sh --list

# Jump to a surface
./scripts/agent-ui-open.sh travel
./scripts/agent-ui-open.sh travel/trip-agent-ui-demo/add/flight
./scripts/agent-ui-open.sh reset

# Seed stable demo trip (trip-agent-ui-demo)
./scripts/agent-ui-seed.sh travel-demo

# Multi-step in one round trip (in-app waits)
./scripts/agent-ui-batch.sh --seed travel-demo --goto travel/trip-agent-ui-demo --wait-prefix ontrack.travel.planDetail.

# Daemon (auto-started): Unix socket + http://127.0.0.1:8191 — prefer flow/batch chains

# Invoke a known control by id (no dump, no coordinates)
./scripts/agent-ui-tap.sh ontrack.tabs.travel

# Cheap probes (status only — no dump file)
./scripts/agent-ui-route.sh
./scripts/agent-ui-exists.sh ontrack.travel.newTrip.open
./scripts/agent-ui-wait.sh --prefix ontrack.checklists.
./scripts/agent-ui-wait.sh --route /calendar

# Full dump only when discovering unknown ids (debt: retire same turn with id/map/flow)
./scripts/agent-ui-dump.sh
./scripts/agent-ui-dump.sh --prefix ontrack.today

# Screenshot triage
./scripts/agent-ui-source.sh travel.list.tripWeather.trip-agent-ui-demo
./scripts/agent-ui-hit.sh 180 420
./scripts/agent-ui-overlay.sh on
```

See also [`docs/agent-routes.md`](./agent-routes.md) for aliases, nested shortcuts, fixtures, and flows.

Deep links / file ops:

- `ontrack:///agent/ui?op=dump`
- `ontrack:///agent/ui?op=tap&id=<testID>`
- `ontrack:///agent/ui?op=exists&id=<testID>`
- `ontrack:///agent/ui?op=prefix&prefix=ontrack.travel.`
- `ontrack:///agent/ui?op=route`
- `ontrack:///agent/ui?op=goto&to=calendar`
- `ontrack:///agent/ui?op=reset`
- `ontrack:///agent/ui?op=hit&x=<points>&y=<points>`
- `ontrack:///agent/ui?op=overlay&to=on|off|toggle`
- File ops: `wait`, `seed`, `flow`, `batch` via `./scripts/agent-ui-*.sh`
- `login` is **daemon-body only** (never a deep link, so credentials cannot land in
  `simctl openurl` / adb logs): `./scripts/agent-ui.sh login [--guest|--status]`

(Use three slashes after `ontrack:` so the path is `/agent/ui`.)

Dump/status/command files live in the app Documents directory:

- `agent-ui-dump.json` (includes `route`; written on `dump` only by default)
- `agent-ui-status.json`
- `agent-ui-command.json` (host → app)

## Shared primitives

`DateField` and `TimeField` derive their picker ids from the field's own `testID`:

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `<field>`                  | Open the picker                          |
| `<field>.day.<YYYY-MM-DD>` | Select a day (`DateField`)                |
| `<field>.previousMonth`    | Show the previous month (`DateField`)     |
| `<field>.nextMonth`        | Show the next month (`DateField`)         |
| `<field>.done`             | Commit the selected date / time           |
| `<field>.close`            | Dismiss without changing the value        |

## Tabs

| testID                                                    | Label            | Notes                                                                                                 |
| --------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `ontrack.tabs.overview`                                   | Overview         | Optional pulse — not the default land or a forced first pin                                          |
| `ontrack.tabs.today`                                      | Today            |                                                                                                       |
| `ontrack.tabs.calendar`                                   | Calendar         |                                                                                                       |
| `ontrack.tabs.checklists`                                 | Checklists       | route `to-do`                                                                                         |
| `ontrack.tabs.social`                                     | Social           |                                                                                                       |
| `ontrack.tabs.insights`                                   | Insights         |                                                                                                       |
| `ontrack.tabs.profile`                                    | Profile          |                                                                                                       |
| `ontrack.tabs.workouts`                                   | Workout          | addon                                                                                                 |
| `ontrack.tabs.plants`                                     | Plants           | addon                                                                                                 |
| `ontrack.tabs.travel`                                     | Travel           | addon                                                                                                 |
| `ontrack.tabs.visionBoard`                                | Vision Board     | addon                                                                                                 |
| `ontrack.tabs.games`                                      | Games            | addon                                                                                                 |
| `ontrack.tabs.vehicles`                                   | Vehicles         | addon                                                                                                 |
| `ontrack.tabs.food`                                       | Food             | addon                                                                                                 |
| `ontrack.tabs.more`                                       | More             | Opens Trackers (`/(tabs)/trackers`) — pin/reorder hub                                                 |
| `ontrack.tabs.carousel.prev`                              | Previous tabs    | Legacy carousel arrow (unused after fixed 5-slot nav)                                               |
| `ontrack.tabs.carousel.next`                              | Next tabs        | Legacy carousel arrow (unused after fixed 5-slot nav)                                               |
| `ontrack.tabs.dock`                                       | Bottom nav       | Layout anchor — page-matching bottom nav fill (not tappable)                                          |
| `ontrack.overview.screen`                                 | Overview         | App-wide summary screen anchor                                                                        |
| `ontrack.overview.hero`                                   | Overview pulse   | Today's highest-level status                                                                          |
| `ontrack.overview.eventUpdates`                           | Event updates    | Previews the highlighted event's YouTube search in-app; users may choose YouTube's app handoff         |
| `ontrack.overview.attention.acknowledge.<key>`            | Acknowledge      | Hides the current version of an Overview attention item without changing its source record           |
| `ontrack.overview.section.all`                            | Across onTrack   | Live module summary list, ordered by this user's opens (frecency)                                     |
| `ontrack.overview.row.<route>`                            | Overview row     | Opens the matching section; the Today row resets the timeline to the current date                     |
| `ontrack.shell.swipeBack`                                 | Swipe back       | Left-edge swipe-back host on a tab root; drag right or tap to return to the previous tab              |
| `ontrack.shell.swipeForward`                              | Swipe forward    | Right-edge swipe-forward host after a tab swipe-back; drag left or tap to return to the page you left |
| `ontrack.sheet.plate`                                     | Any modal sheet  | Layout anchor — visible `SheetScaffold` plate bounds (not tappable)                                   |
| `ontrack.trackers.screen`                                 | Sections         | More hub — In nav / Others reorder                                                                  |
| `ontrack.trackers.row.<route>`                            | Trackers         | Open a tracker from the list (`(today)` → `_today_`)                                                |
| `ontrack.trackers.add.<route>`                            | Trackers         | Add tracker to nav (when under pin limit)                                                           |
| `ontrack.trackers.remove.<route>`                         | Trackers         | Retired — demote via drag into More                                                                 |
| `ontrack.trackers.drag.<route>`                           | Trackers         | Long-press drag handle to reorder                                                                   |
| `ontrack.trackers.manage`                                 | Manage           | Opens add-on toggles from Sections                                                                  |
| `ontrack.trackers.manage.sheet`                           | Manage sheet     | Backdrop for Manage Sections                                                                        |
| `ontrack.trackers.manage.close`                           | Close            | Dismiss Manage Sections                                                                             |
| `ontrack.trackers.addon.<id>`                             | Add-on toggle    | Enable or hide a module                                                                             |
| `ontrack.vehicles.list.add`                               | Vehicles         | Add a vehicle                                                                                         |
| `ontrack.vehicles.list.vehicle.<vehicleId>`               | Vehicles         | Open a vehicle (`vehicle-agent-ui-demo` via `vehicle-demo`)                                           |
| `ontrack.vehicles.detail.settings`                        | Vehicle detail   | Open vehicle settings                                                                                 |
| `ontrack.vehicles.detail.section.<section>`               | Vehicle detail   | Switch detail section (`overview`, `maintenance`, `mileage`, `expenses`, `parts`, `docs`, `activity`) |
| `ontrack.vehicles.detail.saveOdometer`                    | Vehicle detail   | Save the current odometer value                                                                       |
| `ontrack.vehicles.detail.overviewSettingsTip.<vehicleId>` | Vehicle detail   | Open settings from the overview tip                                                                   |
| `ontrack.vehicles.expenses.title`                         | Vehicle expenses | Expense description field                                                                             |
| `ontrack.vehicles.expenses.amount`                        | Vehicle expenses | Expense amount field                                                                                  |
| `ontrack.vehicles.expenses.date`                          | Vehicle expenses | Expense date field                                                                                    |
| `ontrack.vehicles.expenses.category.<category>`           | Vehicle expenses | Select expense category                                                                               |
| `ontrack.vehicles.expenses.notes`                         | Vehicle expenses | Optional notes field                                                                                  |
| `ontrack.vehicles.expenses.add`                           | Vehicle expenses | Add expense                                                                                           |
| `ontrack.vehicles.expenses.delete.<expenseId>`            | Vehicle expenses | Delete expense                                                                                        |
| `ontrack.vehicles.expenses.confirmDelete`                 | Vehicle expenses | Confirm expense deletion prompt                                                                       |
| `ontrack.vehicles.new.nickname` / `.year` / `.make` / `.model` / `.vin` / `.odometer` | New vehicle | Create form fields |
| `ontrack.vehicles.new.save` / `.cancel`                   | New vehicle      | Save / Cancel                                                                                         |

## Food tab (`/(tabs)/food`)

### Food Home (`/(tabs)/food`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.home.section.suggestions`           | Home suggestions layout anchor (not tappable; `food-demo` waits here) |
| `ontrack.food.home.search`                        | Search affordance → Recipes with search focus                        |
| `ontrack.food.home.hero.<recipeId>`               | Suggestion hero carousel page → recipe detail                        |
| `ontrack.food.home.suggestions.askAi`             | Empty-suggestions CTA → AI ideas                                     |
| `ontrack.food.home.quick.<action>`                | Quick action tile (`scan`, `askAi`, `recipes`, `track`, `plan`, `community`) |
| `ontrack.food.home.preferences`                   | Header shortcut → Diet & Preferences                                 |
| `ontrack.food.home.section.today`                 | Today's meals layout anchor (not tappable)                           |
| `ontrack.food.home.today.<activityId>`            | Today meal row → existing food detail                                |
| `ontrack.food.home.today.add`                     | Add meal → existing activity form (Food category)                    |
| `ontrack.food.home.section.pantry`                | Pantry "use soon" layout anchor (not tappable)                       |
| `ontrack.food.home.pantry.scan`                   | Empty-pantry CTA → scanner                                           |
| `ontrack.food.home.leftover`                      | Leftover Rescue card → AI ideas                                      |
| `ontrack.food.home.section.nutrition`             | Nutrition snapshot layout anchor (not tappable)                      |
| `ontrack.food.home.section.community`             | Friends activity layout anchor (not tappable)                        |
| `ontrack.food.home.more`                          | Collapse pantry, leftovers, nutrition, and friends                   |

### Recipes (`/(tabs)/food/recipes`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.recipes.search`                     | Recipe search field                                                  |
| `ontrack.food.recipes.filter.<filterId>`          | Filter chip (`all`, `quick`, `healthy`, `halal`, `kosher`, `vegetarian`, `vegan`, `high-protein`, `saved`) |
| `ontrack.food.recipes.featured`                   | Featured recipe hero → recipe detail                                 |
| `ontrack.food.recipes.category.<key>`             | Cuisine category chip (slugged cuisine)                              |
| `ontrack.food.recipes.section.list`               | Recipe list/grid layout anchor (not tappable)                        |
| `ontrack.food.recipes.card.<recipeId>`            | Open recipe (`RecipeCard`, list + grid)                              |
| `ontrack.food.recipes.card.<recipeId>.favorite`   | Toggle recipe favorite heart                                         |
| `ontrack.food.recipes.empty.action`               | Empty-state action (ask AI / clear filters)                          |

### Recipe detail (`/(tabs)/food/recipes/<id>`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.recipeDetail.back`                  | Back over the hero image                                             |
| `ontrack.food.recipeDetail.favorite`              | Save (favorite) toggle                                               |
| `ontrack.food.recipeDetail.share`                 | Open Share Recipe sheet (community post or system share)             |
| `ontrack.food.recipeDetail.share.external`        | Share sheet alt action → system share (title/link only)              |
| `ontrack.food.recipeDetail.section.<name>`        | Content segment (`overview`, `ingredients`, `steps`, `nutrition`)    |
| `ontrack.food.recipeDetail.addToPlan`             | Open Add to Meal Plan sheet                                          |
| `ontrack.food.recipeDetail.startCooking`          | Open step-by-step cooking sheet                                      |
| `ontrack.food.recipeDetail.plan.day.<YYYY-MM-DD>` | Plan sheet day chip                                                  |
| `ontrack.food.recipeDetail.plan.mealType.<type>`  | Plan sheet meal-type segment                                         |
| `ontrack.food.recipeDetail.plan.servings.minus` / `.plus` | Plan sheet servings stepper                                  |
| `ontrack.food.recipeDetail.cook.prev`             | Cooking sheet: back one step (advance/finish = `sheet.cooking.done`) |

### Meal tracker (`/(tabs)/food/tracker`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.tracker.prevDay` / `.nextDay`       | Step the tracked day                                                 |
| `ontrack.food.tracker.today`                      | Jump back to today (shown only when off today)                       |
| `ontrack.food.tracker.section.meals`              | Meals region anchor — renders on empty days too (not tappable)       |
| `ontrack.food.tracker.section.<mealSection>`      | Meal section anchor (`breakfast`, `lunch`, `dinner`, `snacks`; only when the day has meals; not tappable) |
| `ontrack.food.tracker.add.<mealSection>`          | Per-section add-meal → existing activity form (Food category)        |
| `ontrack.food.tracker.row.<activityId>`           | Scheduled meal row → existing food detail                            |
| `ontrack.food.tracker.section.nutrition`          | Nutrition summary layout anchor (not tappable)                       |
| `ontrack.food.tracker.empty.add`                  | Empty-day CTA → existing activity form (Food category)               |

### Diet & Preferences (`/food/preferences`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.preferences.section.diet`           | Dietary-preference chip grid anchor (not tappable)                   |
| `ontrack.food.preferences.diet.<preference>`      | Dietary preference toggle chip (`halal`, `vegan`, …)                 |
| `ontrack.food.preferences.section.allergies`      | Allergy list anchor (not tappable)                                   |
| `ontrack.food.preferences.allergy.add`            | Add allergy → Allergy Editor sheet                                   |
| `ontrack.food.preferences.allergy.<id>`           | Allergy row → Allergy Editor sheet                                   |
| `ontrack.food.preferences.allergy.name` / `.notes`| Allergy Editor fields                                                |
| `ontrack.food.preferences.allergy.severity.<level>` | Editor severity segment (`mild`, `moderate`, `severe`)             |
| `ontrack.food.preferences.allergy.remove`         | Editor remove (severe → destructive confirm)                         |
| `ontrack.food.preferences.allergy.removeConfirm`  | Destructive confirm button for a severe allergy                      |
| `ontrack.food.preferences.section.<section>`      | Editable list anchor (`intolerances`, `avoided`, `priorities`, `cuisineLikes`, `cuisineDislikes`) |
| `ontrack.food.preferences.<section>.input` / `.add` | Editable list composer field + add                                 |
| `ontrack.food.preferences.<section>.item.<slug>`  | Removable chip (tap removes the value)                               |
| `ontrack.food.preferences.section.privacy`        | Privacy toggles anchor (not tappable)                                |
| `ontrack.food.preferences.privacy.<key>`          | Privacy toggle (`shareAllergies`, `shareDietaryPreferences`, `shareMeals`; default off) |
| `ontrack.food.preferences.clinical`               | Nutrition row → `/(tabs)/food/nutrition-profile`                     |

### Plan & Shopping (`/food/plan`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.plan.section.week`                  | Week meal-plan panel anchor (not tappable)                           |
| `ontrack.food.plan.day.<YYYY-MM-DD>.add`          | Per-day add → Plan a Meal sheet                                      |
| `ontrack.food.plan.entry.<id>`                    | Plan entry row → recipe detail (when the entry has a recipe)         |
| `ontrack.food.plan.entry.<id>.remove`             | Remove a plan entry                                                  |
| `ontrack.food.plan.add.mealType.<type>`           | Plan sheet meal segment                                              |
| `ontrack.food.plan.add.recipe.<recipeId>`         | Plan sheet saved-recipe chip                                         |
| `ontrack.food.plan.add.customTitle`               | Plan sheet freeform title field                                      |
| `ontrack.food.plan.add.servings.minus` / `.plus`  | Plan sheet servings stepper                                          |
| `ontrack.food.plan.section.shopping`              | Shopping-list panel anchor (not tappable)                            |
| `ontrack.food.plan.list.<listId>`                 | Grocery list picker chip (todos list id)                             |
| `ontrack.food.plan.createList`                    | Empty-state CTA → create a todos grocery list                        |
| `ontrack.food.plan.openList`                      | Open the full grocery list in Checklists                             |
| `ontrack.food.plan.generate`                      | Generate from meal plan → `useChecklists.addRecipe` per planned recipe    |
| `ontrack.food.plan.addItem`                       | Add item → Grocery Item Editor sheet                                 |
| `ontrack.food.plan.item.<canonicalKey>`           | Combined ingredient row toggle (`setTasksCompletion`)                |
| `ontrack.food.plan.other.<taskId>`                | Standalone item checkbox toggle                                      |
| `ontrack.food.plan.other.<taskId>.edit`           | Standalone item copy → Grocery Item Editor sheet                     |
| `ontrack.food.plan.editor.name` / `.quantity` / `.unit` | Grocery Item Editor fields                                     |
| `ontrack.food.plan.editor.delete`                 | Grocery Item Editor delete (`deleteTask`)                            |

### Community (`/food/community`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.community.tab.<tab>`                | Feed tab (`forYou`, `following`)                                     |
| `ontrack.food.community.section.feed`             | Feed anchor (not tappable)                                           |
| `ontrack.food.community.compose`                  | Header + → Post Composer sheet                                       |
| `ontrack.food.community.post.<id>`                | Post card anchor (not tappable)                                      |
| `ontrack.food.community.post.<id>.like` / `.save` / `.share` | Post actions                                              |
| `ontrack.food.community.post.<id>.options`        | Post options → Report Content sheet                                  |
| `ontrack.food.community.post.<id>.recipe`         | View Recipe → recipe detail                                          |
| `ontrack.food.community.follow.<authorId>`        | Suggested-creator follow toggle (Following empty state)              |
| `ontrack.food.community.composer.caption`         | Composer caption field                                               |
| `ontrack.food.community.composer.recipe.<recipeId>` | Composer attach-recipe chip                                        |
| `ontrack.food.community.composer.section.privacy` | Composer privacy note anchor (not tappable)                          |
| `ontrack.food.community.report.<key>`             | Report reason chip (`spam`, `unsafe`, `inappropriate`, `other`)      |
| `ontrack.food.community.report.note`              | Report sheet optional details field                                  |

### Shared food surfaces

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.ingredients.row.<key>`              | Ingredient safety row (key = canonical key / slugged name)           |
| `ontrack.food.ingredients.country.<countryCode>`  | Country restriction row (lowercase ISO code)                         |
| `ontrack.food.sheet.<name>.close`                 | Close any Food sheet (`FoodSheet` preset stamps automatically)       |
| `ontrack.food.sheet.<name>.done`                  | Food sheet primary action (`doneLabel`/`onDone` or custom footer)    |

Demo: flow `food-demo` seeds the food profile / pantry / recipes / meal plan
(`src/features/food/fixtures.ts`) plus the meal activity, then lands here.

### AI recipe ideas (`/food/ai-ideas`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.aiIdeas.input`                      | Multiline "what ingredients do you have" prompt                      |
| `ontrack.food.aiIdeas.chip.<key>`                 | Pantry/recent ingredient toggle chip (canonical key)                 |
| `ontrack.food.aiIdeas.mealType.<type>`            | Meal-type chip (`breakfast`, `lunch`, `dinner`, `snack`)             |
| `ontrack.food.aiIdeas.time.<key>`                 | Time/complexity chip (`quick`, `standard`, `relaxed`)                |
| `ontrack.food.aiIdeas.generate`                   | Generate ideas (disabled until any ingredient input)                 |
| `ontrack.food.aiIdeas.section.exclusions`         | Visible active-exclusions line anchor (not tappable)                 |
| `ontrack.food.aiIdeas.section.results`            | Results list layout anchor (not tappable)                            |
| `ontrack.food.aiIdeas.result.<id>`                | Suggestion card layout anchor                                        |
| `ontrack.food.aiIdeas.result.<id>.save`           | Save suggestion → `useRecipes.saveGeneratedRecipe`                   |
| `ontrack.food.aiIdeas.retry`                      | Retry after an error                                                 |

### Ingredient scanner (`/food/scan`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.scan.section.frame`                 | Viewfinder frame / photo preview anchor (not tappable)               |
| `ontrack.food.scan.capture`                       | Take a label photo (system camera) / reset for another scan          |
| `ontrack.food.scan.gallery`                       | Pick a label photo from the library                                  |
| `ontrack.food.scan.section.result`                | Result sheet analysis anchor (not tappable)                          |
| `ontrack.food.scan.section.review`                | Low-confidence correction step anchor (not tappable)                 |
| `ontrack.food.scan.review.item.<index>`           | Editable detected-ingredient field                                   |
| `ontrack.food.scan.review.remove.<index>`         | Remove a detected ingredient                                         |
| `ontrack.food.scan.review.add`                    | Add a missed ingredient row                                          |
| `ontrack.food.scan.retake`                        | Scan another label (result sheet footer alt action)                  |
| `ontrack.food.scan.retry`                         | Retry analysis after an error (photo kept)                           |
| `ontrack.food.scan.reopen`                        | Reopen the dismissed analysis sheet                                  |
| `ontrack.food.sheet.scan.close` / `.done`         | Result/review sheet chrome (`FoodSheet` preset)                      |

### Ingredient info (`/food/ingredients`, `/food/ingredients/<key>`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.ingredients.search`                 | Knowledge search field (names, E-numbers, aliases)                   |
| `ontrack.food.ingredients.section.list`           | Knowledge list layout anchor (not tappable)                          |
| `ontrack.food.ingredients.row.<key>`              | Knowledge row → ingredient detail                                    |
| `ontrack.food.ingredients.detail.back`            | Detail back button                                                   |
| `ontrack.food.ingredients.detail.section`         | Detail body layout anchor (not tappable)                             |
| `ontrack.food.ingredients.detail.source.<index>`  | Evidence source link (opens https source)                            |

## Food detail (`/detail/food/<id>`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.food.detail.analyze`       | Add meal nutrition CTA  |
| `ontrack.food.detail.link`          | Meal link field         |
| `ontrack.food.detail.findMeal`      | Resolve link            |
| `ontrack.food.detail.candidate.<id>`| Choose link candidate   |
| `ontrack.food.detail.confirmSave`   | Confirm and save        |
| `ontrack.food.detail.analyzeAnother`| Analyze another source  |
| `ontrack.food.detail.edit`          | Edit meal manually      |
| `ontrack.food.detail.close`         | Close                   |

Demo: `activity-agent-ui-demo-meal` via `food-detail-demo`.

## Social

Named flow: `social-friends-invite-tools` (signed-in session) opens Friends, then the Add Friends bottom sheet.

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.social.header.addFriend`                   | Open add-friend flow                    |
| `ontrack.social.header.messages`                    | Open Social messages                    |
| `ontrack.social.friends.close`                      | Close friend-management modal           |
| `ontrack.social.friendInvite.signIn`                | Sign in from a public friend invite     |
| `ontrack.social.friendInvite.accept`                | Accept a resolved friend invite         |
| `ontrack.social.friendInvite.notNow`                | Leave a resolved invite for later       |
| `ontrack.social.friendInvite.openSocial`            | Leave an unavailable invite for Social  |
| `ontrack.social.friendInvite.section.card`          | Friend invite composition anchor         |
| `ontrack.social.friends.signIn`                     | Sign in from friend-management modal    |
| `ontrack.social.friends.seeAll`                     | Open complete friends list              |
| `ontrack.social.friends.add`                        | Open add-friend flow from Friends card  |
| `ontrack.social.friends.openInviteTools`            | Open Add Friends bottom sheet           |
| `ontrack.social.friends.inviteTools.close`          | Close Add Friends bottom sheet          |
| `ontrack.social.friends.empty.add`                  | Add the first friend from empty state   |
| `ontrack.social.friends.section.list`               | Primary friends-list section            |
| `ontrack.social.friends.friend.<friendId>`          | Open a friend’s Social profile          |
| `ontrack.social.quickAction.<actionId>`             | Open a Social quick action              |
| `ontrack.social.upcoming.seeAll`                    | Open all trips                          |
| `ontrack.social.upcoming.empty`                     | Create the first shared trip            |
| `ontrack.social.upcoming.trip.<tripId>`             | Open an upcoming shared trip            |
| `ontrack.social.feed.filter.<all\|friends\|groups>` | Filter Social activity                  |
| `ontrack.social.feed.item.<itemId>`                 | Open a Social feed item                 |
| `ontrack.social.feed.poll.<itemId>.<choiceId>`      | Vote in a Social poll                   |
| `ontrack.social.feed.loadMore`                      | Load more local Social activity         |
| `ontrack.social.actionModal.close`                  | Close a Social empty-state flow         |
| `ontrack.social.actionModal.primary`                | Continue from a Social empty-state flow |
| `ontrack.social.invite.slug`                        | Invite link name input                  |
| `ontrack.social.invite.save`                        | Save invite link name                   |
| `ontrack.social.invite.copy`                        | Copy invite link                        |
| `ontrack.social.invite.share`                       | Share invite link                       |
| `ontrack.social.friend.email`                       | Friend email input                      |
| `ontrack.social.friend.send`                        | Send friend request                     |
| `ontrack.social.request.accept.<requestId>`         | Accept incoming request                 |
| `ontrack.social.request.decline.<requestId>`        | Decline incoming request                |
| `ontrack.social.request.cancel.<requestId>`         | Cancel outgoing request                 |
| `ontrack.social.friend.addToTrip.<friendId>`        | Add a friend to a trip                  |
| `ontrack.social.friend.remove.<friendId>`           | Remove a friend                         |

## Games

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.games.hub.challengeFriend`     | Challenge a Friend         |
| `ontrack.games.hub.balloonPop`          | Open Balloon Pop card      |
| `ontrack.games.balloonPop.play`         | Start Balloon Pop          |
| `ontrack.games.balloonPop.retry`        | Retry after loss           |
| `ontrack.games.balloonPop.back`         | Back to Games after loss   |
| `ontrack.games.balloonPop.close`        | Close in-game HUD          |
| `ontrack.games.balloonPop.balloon.<id>` | Pop a balloon              |

## People picker (shared sheet)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.peoplePicker.close`            | Close sheet          |
| `ontrack.peoplePicker.dropdown`          | Open friend dropdown |
| `ontrack.peoplePicker.search`           | Search field         |
| `ontrack.peoplePicker.friend.<friendId>`| Select friend row    |
| `ontrack.peoplePicker.confirm`          | Confirm selection    |

Deep link example: `ontrack://travel` / Expo route `/(tabs)/travel`

## Today (`/(tabs)/` index)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.today.prevDay`             | Previous day             |
| `ontrack.today.nextDay`             | Next day                 |
| `ontrack.today.openCalendar`        | Date title (weekday + long date) → Calendar tab |
| `ontrack.today.weather`             | Home weather tile (full width when home≡current; else left half). Tap → Profile `?reveal=homeLocation` |
| `ontrack.today.currentLocation`     | Current weather tile only when place ≠ home (right half). Tap → Profile `?reveal=currentLocation` |
| `ontrack.today.holiday.<id>`        | Static all-day holiday rail (not a timeline activity) |
| `ontrack.today.allDay.<id>`         | Static all-day user event (birthday / all-day) — opens detail, not a timeline card |
| `ontrack.today.progress`            | Day completion ring (hidden at 0%) |
| `ontrack.today.addActivity`         | Open Today add sheet     |
| `ontrack.today.emptyAddActivity`    | Empty-state add          |
| `ontrack.today.addEvent`            | Add sheet → Event        |
| `ontrack.today.addMeal`             | Add sheet → Meal         |
| `ontrack.today.addChecklist`        | Add sheet → Checklist    |
| `ontrack.today.addJournal`          | Add sheet → Journal      |
| `ontrack.today.addSheet`            | Add sheet backdrop       |
| `ontrack.today.addSheet.close`      | Dismiss add sheet        |
| `ontrack.today.addSheet.field`      | Checklist / journal field |
| `ontrack.today.addSheet.submit`     | Save checklist / journal |
| `ontrack.today.activity.<id>`       | Activity card            |
| `ontrack.today.activityToggle.<id>` | Activity complete toggle |
| `ontrack.today.detail.<kind>.close` | Dismiss a calendar-card detail sheet from its grabber |
| `ontrack.today.detail.<kind>.backdrop` | Dismiss a calendar-card detail sheet from its backdrop |

## Calendar (`/(tabs)/calendar`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.calendar.jumpToday`        | Jump to Today       |
| `ontrack.calendar.prevMonth`        | Previous month      |
| `ontrack.calendar.nextMonth`        | Next month          |
| `ontrack.calendar.openDay`          | Open selected day (date + chevron) |
| `ontrack.calendar.day.<YYYY-MM-DD>` | Month grid day cell |
| `ontrack.calendar.holiday.<id>`     | Static selected-day holiday rail (not an event row) |
| `ontrack.calendar.allDay.<id>`      | Static selected-day all-day / birthday rail (not a timed event row) |
| `ontrack.calendar.activity.<id>`    | Open a selected-day event detail sheet |

## Event detail (`/detail/generic/<activityId>`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.eventDetail.edit`        | Open the event in the form    |
| `ontrack.eventDetail.toggleComplete` | Mark complete / incomplete |
| `ontrack.eventDetail.close`       | Dismiss the event sheet from its grabber |
| `ontrack.eventDetail.backdrop`    | Dismiss the event sheet from its backdrop |
| `ontrack.eventDetail.section.fightCard` | Broadcast-style headliner and opposing-corner fight card |
| `ontrack.eventDetail.fightCard.tab.<main|prelims|early-prelims>` | Show one fight-card section |
| `ontrack.eventDetail.fightCard.bout.<boutId>` | Open a fight-card bout’s matchup modal |
| `ontrack.eventDetail.fightCard.modal` | Visible full-name matchup modal |
| `ontrack.eventDetail.section.metadata` | Imported venue details |
| `ontrack.eventDetail.ticket`      | Open the provider ticket page     |

## Event form (`/activity-form`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.activityForm.category.<id>`    | Pick an event type (new event)         |
| `ontrack.activityForm.guidedTitle`      | Guided title field (new event)         |
| `ontrack.activityForm.title`            | Title field (editing)                  |
| `ontrack.activityForm.section.schedule` | Schedule glass section                 |
| `ontrack.activityForm.date`             | Date field                             |
| `ontrack.activityForm.duration.hours`   | Duration hours field                   |
| `ontrack.activityForm.duration.mins`    | Duration minutes field                 |
| `ontrack.activityForm.startTime`        | Start time                             |
| `ontrack.activityForm.notes`            | Notes                                  |
| `ontrack.activityForm.attendeeEmails`   | Guest email invitation field           |
| `ontrack.activityForm.pickPhoto`        | Choose / replace photo                 |
| `ontrack.activityForm.analyzePhoto`     | Re-run meal photo analysis             |
| `ontrack.activityForm.removePhoto`      | Remove photo                           |
| `ontrack.activityForm.save`             | Save the event                         |
| `ontrack.activityForm.saveThisOccurrence` | Apply changes to only this occurrence |
| `ontrack.activityForm.saveSeries`       | Apply changes to the recurring series  |
| `ontrack.activityForm.grabber`          | Swipe-down dismiss grabber             |
| `ontrack.activityForm.backdrop`         | Dismiss by tapping outside the sheet   |
| `ontrack.activityForm.cancel`           | Cancel / dismiss                       |
| `ontrack.activityForm.delete`           | Delete the event                       |
| `ontrack.activityForm.choice.<group>.<value>` | Editor choice chips (meal type, workout type, …) |
| `ontrack.activityForm.event.tabs` | Sports / Music / Following discovery tabs |
| `ontrack.activityForm.event.search` | Search the selected event source |
| `ontrack.activityForm.event.sportFilter` | Choose a broad sport category |
| `ontrack.activityForm.event.sportFilter.<sport>` | Select All sports, Basketball, Football, Baseball, Hockey, Soccer, Combat sports, or Motorsports |
| `ontrack.activityForm.event.section.upcoming` | Upcoming suggestions for the selected broad sport or Music tab |
| `ontrack.activityForm.event.section.followTargets` | Suggested teams, promotions, or artists to follow |
| `ontrack.activityForm.event.result.<provider>.<id>` | Select an external event |
| `ontrack.activityForm.event.followTarget.<provider>.<id>` | Follow a team, promotion, or artist |
| `ontrack.activityForm.event.followMode.review` | Follow with review-first mode |
| `ontrack.activityForm.event.followMode.auto` | Follow with automatic adds |
| `ontrack.activityForm.event.loadMore` | Load another concert result page |
| `ontrack.activityForm.event.refresh` | Refresh all followed schedules |
| `ontrack.activityForm.event.unfollow.<id>` | Unfollow a target |
| `ontrack.activityForm.event.suggestion.<id>` | Review suggestion row |
| `ontrack.activityForm.event.suggestion.<id>.accept` | Add a reviewed event |
| `ontrack.activityForm.event.suggestion.<id>.dismiss` | Suppress a reviewed event |
| `ontrack.activityForm.event.section.selected` | Selected external event summary |
| `ontrack.activityForm.event.changeSelection` | Return from the selected-event summary to discovery results |
| `ontrack.activityForm.event.section.following` | Followed targets section |
| `ontrack.activityForm.event.section.suggestions` | Pending review section |

## Checklists (`/(tabs)/to-do`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.checklists.editMode`             | Edit / Done lists                     |
| `ontrack.checklists.collaborators`        | (unused) former hub add-collaborator  |
| `ontrack.checklists.newListName`          | New list name field                   |
| `ontrack.checklists.listName.<listId>`    | Editable checklist name               |
| `ontrack.checklists.newListKind.<kind>`   | (unused) former hub create-kind chips |
| `ontrack.checklists.createList`           | Create list                           |
| `ontrack.checklists.list.<listId>`        | Open list card                        |
| `ontrack.checklists.detail.back`          | Back to Checklists (chevron + label)  |
| `ontrack.checklists.detail.title`         | Edit checklist title (Edit mode)      |
| `ontrack.checklists.detail.filter`        | Toggle open / closed tasks            |
| `ontrack.checklists.detail.newTask`       | New task field                        |
| `ontrack.checklists.detail.addTask`       | Add task                              |
| `ontrack.checklists.detail.sort`          | Sort choices live in List Actions     |
| `ontrack.checklists.detail.sort.<id>`     | Pick a sort in List Actions           |
| `ontrack.checklists.detail.assigneeFilter` | Assigned-to choices live in List Actions |
| `ontrack.checklists.detail.assigneeOption.<id>` | Select all assignees or a member |
| `ontrack.checklists.detail.actions`       | Open list actions sheet               |
| `ontrack.checklists.detail.actionsClose`  | Close list actions sheet              |
| `ontrack.checklists.detail.action.<action>` | Select a list action                |
| `ontrack.checklists.detail.categoryTabs`  | Category tab rail                     |
| `ontrack.checklists.detail.category.<id>` | Filter items by category              |
| `ontrack.checklists.detail.editMode`      | Edit / Done tasks                     |
| `ontrack.checklists.detail.linkedTrip`    | Open the trip linked to this packing list |
| `ontrack.checklists.detail.task.<taskId>` | Open item details sheet               |
| `ontrack.checklists.itemDetails.close` | Close item details sheet             |
| `ontrack.checklists.itemDetails.title` | Edit checklist item title            |
| `ontrack.checklists.itemDetails.saveTitle` | Save checklist item title         |
| `ontrack.checklists.itemDetails.assignee` | Open assignee dropdown              |
| `ontrack.checklists.itemDetails.assigneeOption.<id>` | Choose assignee (`anyone` or user id) |
| `ontrack.checklists.itemDetails.category` | Open category dropdown              |
| `ontrack.checklists.itemDetails.categoryOption.<id>` | Choose category (`uncategorized` or category id) |
| `ontrack.checklists.itemDetails.newCategoryName` | Search or create a category in item details |
| `ontrack.checklists.itemDetails.createCategory` | Create and assign a category      |

Demo fixture: `list-agent-ui-demo-checklist` / `task-agent-ui-demo-plan` via `./scripts/agent-ui-seed.sh checklist-demo` or flow `checklist-demo`.

## Grocery (`/(tabs)/to-do/<groceryListId>`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.grocery.detail.back`                  | Back to lists (chevron + eyebrow) |
| `ontrack.grocery.detail.addRecipe`             | Add Recipe                       |
| `ontrack.grocery.detail.settings`              | List settings                    |
| `ontrack.grocery.detail.share`                 | Share list                       |
| `ontrack.grocery.detail.copy`                  | Copy combined shopping list      |
| `ontrack.grocery.detail.view.meal`             | By meal tab                      |
| `ontrack.grocery.detail.view.combined`         | Combined tab                     |
| `ontrack.grocery.detail.recipe.<recipeId>`     | Expand / collapse meal card      |
| `ontrack.grocery.detail.task.<taskId>`         | Toggle ingredient checkbox       |
| `ontrack.grocery.detail.combined.<groupId>`    | Toggle combined ingredient group |

Demo fixture: `list-agent-ui-demo-grocery` / `recipe-agent-ui-demo-pasta` via `./scripts/agent-ui-seed.sh grocery-demo` or flow `grocery-demo`. Settings: `grocery-demo-settings` → `ontrack.listSettings.name`.

## List settings (`/todos/<listId>/settings` — bottom sheet)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.listSettings.close`   | Grabber / dismiss |
| `ontrack.listSettings.name`    | List name    |
| `ontrack.listSettings.saveName`| Save name (trailing check) |
| `ontrack.listSettings.addEditors` | Open editor multi-select dropdown |
| `ontrack.listSettings.editor.<userId>` | Select an editor in the dropdown |
| `ontrack.listSettings.confirmEditors` | Add selected editors |
| `ontrack.listSettings.makeEditor.<userId>` | Promote member to editor |
| `ontrack.listSettings.makeMember.<userId>` | Demote editor to member |

## Recipe import (`/todos/<listId>/recipe-import`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.recipeImport.cancel`                       | Cancel / discard       |
| `ontrack.recipeImport.stop`                         | Stop analysis          |
| `ontrack.recipeImport.url`                          | Recipe URL field       |
| `ontrack.recipeImport.analyze`                      | Analyze URL            |
| `ontrack.recipeImport.camera`                       | Camera capture         |
| `ontrack.recipeImport.library`                      | Photo / screenshot     |
| `ontrack.recipeImport.mealName`                     | Review meal name       |
| `ontrack.recipeImport.sourceUrl`                    | Review source URL      |
| `ontrack.recipeImport.sourceServings`               | Source servings        |
| `ontrack.recipeImport.targetServings`               | Target servings        |
| `ontrack.recipeImport.ingredient.add`               | Add ingredient row     |
| `ontrack.recipeImport.ingredient.<id>.name`         | Ingredient name field  |
| `ontrack.recipeImport.ingredient.<id>.remove`       | Remove ingredient row  |
| `ontrack.recipeImport.save`                         | Save recipe to list    |

Flow: `grocery-demo-recipe-import`.

## Plants (`/(tabs)/plants`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.plants.list.add`                | Add plant                  |
| `ontrack.plants.list.plant.<plantId>`    | Open plant card            |
| `ontrack.plants.detail.edit`             | Edit plant                 |
| `ontrack.plants.detail.amount`           | Optional watering amount   |
| `ontrack.plants.detail.logWatering`      | Log watering now           |
| `ontrack.plants.detail.adjustSchedule`   | Adjust schedule            |
| `ontrack.plants.detail.undoWatering`     | Undo last watering         |
| `ontrack.plants.detail.checkIn`          | Health photo check-in      |
| `ontrack.plants.detail.delete`           | Delete plant               |
| `ontrack.plants.calendarSheet.openDetails` | Open the full plant detail page from a calendar sheet |
| `ontrack.plants.new.camera`              | New plant — camera         |
| `ontrack.plants.new.library`             | New plant — library        |
| `ontrack.plants.new.analyze`             | Identify and assess        |
| `ontrack.plants.new.confirmIdentity`     | Confirm identification     |
| `ontrack.plants.new.nickname`            | Plant nickname             |
| `ontrack.plants.new.buildCarePlan`       | Build care plan            |
| `ontrack.plants.new.save`                | Confirm and schedule       |

Demo fixture: `plant-sample-monstera` via `./scripts/agent-ui-seed.sh plants-demo` or flow `plants-demo`.

## Workouts (`/(tabs)/workouts`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.workouts.header.customPlanner`             | Custom planner header control   |
| `ontrack.workouts.exploreMuscles`                   | Expand Muscle Explorer on Fitness |
| `ontrack.workouts.selectedDay.section`              | Selected-day workout section    |
| `ontrack.workouts.selectedDay.previous` / `.next`   | Change the selected day         |
| `ontrack.workouts.selectedDay.editWorkout.<activityId>` | Edit a workout in the Fitness sheet |
| `ontrack.workouts.selectedDay.plan`                 | Plan the selected day           |
| `ontrack.workouts.dayPlanner.section`               | Selected-day workout bottom sheet |
| `ontrack.workouts.dayPlanner.close` / `.backdrop` / `.save` | Dismiss or save the workout sheet |
| `ontrack.workouts.dayPlanner.title` / `.startTime`  | Session name and gym start time |
| `ontrack.workouts.dayPlanner.durationHours` / `.durationMinutes` | Time-at-gym fields |
| `ontrack.workouts.dayPlanner.type.<type>`           | Workout type choice             |
| `ontrack.workouts.dayPlanner.exercise.<exerciseId>.name` / `.rest` | Exercise name and rest time |
| `ontrack.workouts.dayPlanner.exercise.<exerciseId>.addSet` / `.remove` | Add a set or remove an exercise |
| `ontrack.workouts.dayPlanner.set.<setId>.reps` / `.weight` / `.remove` | Set details and removal |
| `ontrack.workouts.dayPlanner.addExercise`           | Add another exercise            |
| `ontrack.workouts.builder.clear`                    | Clear session builder           |
| `ontrack.workouts.builder.addToDay`                 | Add workout to selected day     |
| `ontrack.workouts.exercise.<exerciseId>.add`        | Add/remove catalog exercise     |
| `ontrack.workouts.exercise.<exerciseId>.preview`    | Preview anatomy animation       |
| `ontrack.workouts.explorer.anatomySex.male\|female` | Male / Female anatomy toggle    |
| `ontrack.workouts.explorer.bodyView.front\|side\|back` | Body plate tabs              |
| `ontrack.workouts.explorer.muscle.<muscleKey>`         | Muscle group chip             |
| `ontrack.workouts.gym.edit` / `.start` / `.close`      | Gym detail                    |
| `ontrack.workouts.gymActive.completeSet` / `.finish`   | Active workout                |

Demo fixture: `activity-agent-ui-demo-workout` via `workouts-demo`; explorer wait target `incline-curl`. Flows: `workouts-plan-day`, `workouts-change-day`, `workouts-demo-anatomy`, `workouts-demo-gym-detail`, `workouts-demo-gym-active`.

## Vision board (`/(tabs)/vision-board`)

| testID                                              | Control                      |
| --------------------------------------------------- | ---------------------------- |
| `ontrack.vision.dashboard.filter`                   | Show populated / all filter  |
| `ontrack.vision.dashboard.add`                      | Add category                 |
| `ontrack.vision.dashboard.viewAll`                  | Open consolidated board      |
| `ontrack.vision.dashboard.edit`                     | Edit categories              |
| `ontrack.vision.dashboard.category.<categoryId>`    | Open category card           |
| `ontrack.vision.consolidated.search`                | Search toggle                |
| `ontrack.vision.consolidated.more`                  | Options menu                 |
| `ontrack.vision.consolidated.category.<categoryId>` | Category filter chip         |
| `ontrack.vision.category.mode`                      | Edit Board / Gallery toggle  |
| `ontrack.vision.category.addImage`                  | Add image                    |
| `ontrack.vision.category.addAffirmation`            | Add affirmation              |
| `ontrack.vision.category.addGoal`                   | Add goal                     |
| `ontrack.vision.category.canvasItem.<itemId>`       | Select canvas item           |
| `ontrack.vision.category.selection.deselect`        | Deselect selected item       |
| `ontrack.vision.category.selection.edit`            | Edit selected item           |
| `ontrack.vision.category.selection.layerBack`       | Send selected backward       |
| `ontrack.vision.category.selection.layerForward`    | Bring selected forward       |
| `ontrack.vision.category.selection.delete`          | Delete selected item         |
| `ontrack.vision.itemEditor.primary`                 | Affirmation / goal / caption |
| `ontrack.vision.itemEditor.secondary`               | Optional note / attribution  |
| `ontrack.vision.itemEditor.save`                    | Save item                    |
| `ontrack.vision.itemEditor.close`                   | Close editor                 |

Demo fixture: `vision-mindset` / `vision-sample-forest` via `vision-board-demo` / `vision-board-demo-edit` / `vision-board-demo-item-editor`.

## Profile (`/(tabs)/profile`)

| testID                                                           | Control                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `ontrack.profile.avatar`                                         | Customize avatar                                               |
| `ontrack.profile.displayName`                                    | Hero name — opens identity editor                              |
| `ontrack.profile.blurb`                                          | Hero blurb — opens identity editor                             |
| `ontrack.profile.avatar.close`                                   | Avatar editor close                                            |
| `ontrack.profile.avatar.save`                                    | Avatar editor save                                             |
| `ontrack.profile.avatar.mode.<initials\|icon\|photo>`            | Avatar editor mode segment                                     |
| `ontrack.profile.avatar.takePhoto`                               | Avatar editor take photo                                       |
| `ontrack.profile.avatar.chooseLibrary`                           | Avatar editor choose from library                              |
| `ontrack.profile.avatar.searchIcons`                             | Avatar editor icon search                                      |
| `ontrack.profile.identity.close`                                 | Name & blurb editor close                                      |
| `ontrack.profile.identity.save`                                  | Name & blurb editor save                                       |
| `ontrack.profile.identity.name`                                  | Name field in identity editor                                  |
| `ontrack.profile.identity.goal`                                  | Blurb field in identity editor                                 |
| `ontrack.profile.guestStatus`                                    | (legacy) Guest caption — unused; Account card covers guest CTA |
| `ontrack.profile.section.account`                                | Account section (sign-in + connections)                        |
| `ontrack.profile.section.accountSyncing`                         | Calendar Sync row under Account                                |
| `ontrack.profile.section.appearance`                             | Appearance section anchor                                      |
| `ontrack.profile.section.developer`                              | Developer section anchor (gated)                               |
| `ontrack.profile.section.preferences`                            | Preferences section (places + experience toggles)              |
| `ontrack.profile.section.features`                               | Agents section                                                 |
| `ontrack.profile.section.about`                                  | About section (legal + version)                                |
| `ontrack.profile.section.legal`                                  | Privacy + Terms rows inside About                              |
| `ontrack.profile.section.dangerZone`                             | Danger Zone (reset / delete) — last                            |
| `ontrack.profile.section.disclaimers`                            | (unused) former TMDB attribution                               |
| `ontrack.profile.section.appInformation`                         | Version row inside About                                       |
| `ontrack.profile.version`                                        | App version row in About                                       |
| `ontrack.profile.theme.system` / `.light` / `.dark`              | Theme segment                                                  |
| `ontrack.profile.homeLocation`                                   | Home location inline field (Open-Meteo city autocomplete)      |
| `ontrack.profile.currentLocation`                                | Current location override field (never writes Home)            |
| `ontrack.profile.currentLocationLocate`                          | Far-right locate — clear override + fill from device GPS       |
| `ontrack.profile.*.suggestion.<n>`                               | City suggestion row                                            |
| `ontrack.profile.*.suggestionsDismiss`                           | Dismiss city suggestions                                       |
| `ontrack.profile.agents`                                         | Manage Agents                                                  |
| `ontrack.profile.calendarSync`                                   | Google Calendar sync settings                                  |
| `ontrack.profile.backup`                                         | Download or Google Drive backup                                |
| `ontrack.backup.screen`                                          | Your Backup screen                                             |
| `ontrack.backup.status`                                          | Backup success/error notice                                    |
| `ontrack.backup.section.device`                                  | On This Device backup card                                     |
| `ontrack.backup.section.drive`                                   | Google Drive backup card                                       |
| `ontrack.backup.download`                                        | Download Backup                                                |
| `ontrack.backup.connectDrive`                                    | Connect Google Drive                                           |
| `ontrack.backup.saveDrive`                                       | Save Backup to Google Drive                                    |
| `ontrack.backup.disconnectDrive`                                 | Disconnect Google Drive                                        |
| `ontrack.backup.confirmDisconnect`                               | Confirm Google Drive disconnect                                |
| `ontrack.backup.restoreFile`                                     | Restore from File                                              |
| `ontrack.backup.restoreDrive`                                    | Restore from Google Drive                                      |
| `ontrack.backup.confirmRestore`                                  | Confirm restore                                                |
| `ontrack.backup.saveOverwrite`                                   | Overwrite Previous Drive backup                                |
| `ontrack.backup.saveNew`                                         | Save as New Drive backup                                       |
| `ontrack.profile.straiaway`                                      | StraiAway connect screen (hidden from Profile for now)         |
| `ontrack.straiaway.connect`                                      | Connect StraiAway                                              |
| `ontrack.straiaway.disconnect`                                   | Disconnect StraiAway                                           |
| `ontrack.straiaway.open`                                         | Open StraiAway                                                 |
| `ontrack.straiaway.landing`                                      | Partner connect landing                                        |
| `ontrack.straiaway.openOntrack`                                  | Open partner link in onTrack                                   |
| `ontrack.calendarSync.connect`                                   | Connect Google Calendar                                        |
| `ontrack.calendarSync.section.inviteReview`                      | Saved event and guest list awaiting Google Calendar review     |
| `ontrack.calendarSync.reconnect`                                 | Renew Google Calendar permissions                              |
| `ontrack.calendarSync.sync`                                      | Preview Google Calendar sync                                   |
| `ontrack.calendarSync.confirmSync`                               | Confirm previewed calendar changes                             |
| `ontrack.calendarSync.disconnectKeep`                            | Disconnect and keep synced copies                              |
| `ontrack.calendarSync.disconnectRemove`                          | Disconnect and remove synced copies                            |
| `ontrack.calendarSync.confirmDisconnectRemove`                   | Confirm removal of synced copies                               |
| `ontrack.calendarSync.direction.twoWay`                          | Select two-way calendar sync                                   |
| `ontrack.calendarSync.direction.toGoogle`                        | Select one-way sync to Google                                  |
| `ontrack.calendarSync.direction.fromGoogle`                      | Select one-way sync from Google                                |
| `ontrack.profile.privacy`                                        | Privacy Policy                                                 |
| `ontrack.profile.terms`                                          | Terms of Use                                                   |
| `ontrack.legal.document`                                         | Privacy / Terms document body                                  |
| `ontrack.profile.tmdb`                                           | (unused) former TMDB attribution link                          |
| `ontrack.profile.signOut`                                        | Sign Out (signed-in)                                           |
| `ontrack.profile.biometricUnlock`                                | Unlock With Face ID / fingerprint (signed-in, hardware only)   |
| `ontrack.profile.accountProviders`                               | Active SSO line (Apple or Google)                              |
| `ontrack.profile.createOrSignIn`                                 | Create or Sign In (guest)                                      |
| `ontrack.profile.deleteAccount`                                  | Delete Account (signed-in)                                     |
| `ontrack.profile.resetData`                                      | Reset All Data                                                 |
| `ontrack.nutritionProfile.addDependent`                          | Create and immediately edit a dependent profile                |
| `ontrack.nutritionProfile.profile.<id>`                          | Select a nutrition profile                                     |
| `ontrack.nutritionProfile.name`                                  | Nutrition profile name                                         |
| `ontrack.nutritionProfile.dateOfBirth`                           | Nutrition profile birth date                                   |
| `ontrack.nutritionProfile.heightCm` / `.weightKg`                | Nutrition body measurements                                    |
| `ontrack.nutritionProfile.preferences` / `.allergies`            | Nutrition preference fields                                    |
| `ontrack.nutritionProfile.<equationSex\|activity\|goal>.<value>` | Nutrition choice chip                                          |
| `ontrack.nutritionProfile.guardianAcknowledgment`                | Toggle guardian acknowledgment                                 |
| `ontrack.nutritionProfile.calculate`                             | Calculate starting targets                                     |
| `ontrack.nutritionProfile.target.<name>`                         | Edit a calculated nutrition target                             |
| `ontrack.nutritionProfile.saveTargets`                           | Save the current target version                                |

## Welcome / first-run (`/welcome`)

Single celestial first-run (constellation + name/goal + Get Started). Legacy
`/onboarding` redirects here. Profile upgrade SSO is root `/account` (no tab
dock); legacy `/(tabs)/profile/account` redirects there.

| testID                                  | Control                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `ontrack.auth.section.hero`             | Hero anchor (brand row + constellation)                        |
| `ontrack.auth.section.constellation`    | Orbit canvas + welcome copy                                    |
| `ontrack.onboarding.name`               | Display name field                                             |
| `ontrack.onboarding.goal`               | Primary goal field                                             |
| `ontrack.onboarding.getStarted`         | Get Started (guest + complete onboarding)                      |
| `ontrack.onboarding.skip`               | I want to try the app out first (defaults + guest + complete)  |
| `ontrack.auth.guest`                    | First-run try-first / Skip alias (not on SSO `/welcome` shell) |
| `ontrack.onboarding.signIn`             | Reveal Apple / Google on welcome                               |
| `ontrack.auth.section.providers`        | Apple / Google (welcome expand + Profile upgrade)              |
| `ontrack.auth.apple`                    | Continue with Apple                                            |
| `ontrack.auth.google`                   | Continue with Google                                           |
| `ontrack.auth.switchAccount`            | Use a different account (locked gate only)                     |
| `ontrack.auth.unlockBiometric`          | Remember Me toggle below Google (Face ID / fingerprint; welcome / upgrade / locked when enrolled) |
| `ontrack.auth.dismissError`             | Dismiss sign-in error                                          |
| `ontrack.auth.privacy`                  | Privacy Policy link (upgrade / locked)                         |
| `ontrack.auth.terms`                  | Terms of Use link (upgrade / locked)       |
| `ontrack.auth.themeMode`              | Light/dark toggle (welcome)                |
| `ontrack.auth.dataChoice.merge`       | Merge device into cloud (existing account) |
| `ontrack.auth.dataChoice.discardDevice` | Use cloud only / discard device          |
| `ontrack.auth.dataChoice.keepDevice`  | Keep guest data upload (new account)       |
| `ontrack.auth.dataChoice.startFresh`  | Start fresh without guest data             |
| `ontrack.auth.dataChoice.cancel`      | Cancel sign-in, keep guest                 |
| `ontrack.prompt.close`                | Prompt / alert dismiss (X)                 |
| `ontrack.prompt.messageScroll`        | Scrollable prompt message list             |
| `ontrack.prompt.action.<index>`       | Prompt action by visible position          |

`ensurePastLaunchGates` auto-taps `ontrack.onboarding.skip` (or `auth.guest`)
before **`seed` / `flow`** ops only — one tap enters guest and completes
onboarding. `--route /welcome --exists …` without `--flow` asserts the first-run
canvas (device must be signed out / not yet onboarded).

Killing the app on a **physical device** re-arms the sign-in gate (`locked` phase →
`/welcome` with re-authentication copy). Enrolled devices show `ontrack.auth.unlockBiometric`
as a Remember Me toggle under Google on welcome, upgrade, and the lock gate. Auto-prompt once
only when that account already enabled Face ID / fingerprint on this device. Simulators and emulators are exempt
(`Device.isDevice === false`), so agent flows never see it; to inspect the gate on a
sim, tap `ontrack.developer.lockSession`.

## Travel Home (`/(tabs)/travel`, flow `travel-home`)

Trip launcher home. Wire testIDs stay under historical `ontrack.travel.list.*` (not `travel.home.*`). Assert with `travel.list.section.yourTrips` or colloquial `travel.home.section.yourTrips` (host rewrites `home` → `list`). JS: prefer `AgentUiIds.travel.home.*`. Utility actions (calendar, flights/stays, weather, currency, expenses, chat) live at the **top of plan detail** (`/travel/<id>`). Legacy `/travel/<id>/hub` redirects there.

**Verify (H18):** empty guest has no Your Trips section — use `--route /travel --flow travel-home --exists travel.list.section.yourTrips` (optional `travel.newTrip.open`) for seeded cards, or `--flow travel-home-empty --exists travel.list.empty.create` for the zero-trip welcome. Bare goto alone is not a smoke. Bench: `docs/agent-ui-verify-benchmark.md`.

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.chrome.flightPath`               | Layout anchor — flight-path flourish on itinerary hero only |
| `ontrack.travel.chrome.skyDecor`                 | Layout anchor — weather sky + location ground (stars/moon, sun/clouds, town/trees) behind titles |
| `ontrack.travel.list.section.yourTrips`          | Layout anchor — Your Trips section (`travel.home.section.yourTrips` alias) |
| `ontrack.travel.list.section.empty`              | Layout anchor — zero-trip welcome                         |
| `ontrack.travel.list.section.atmosphereLocation` | Layout anchor — atmosphere photo place caption            |
| `ontrack.travel.list.search`                     | Your Trips search — always-open full-width field          |
| `ontrack.travel.list.searchClear`                | Clear trip list search                                    |
| `ontrack.travel.list.empty.create`               | Empty-state Add Your First Trip                           |
| `ontrack.travel.list.empty.search`               | No trips match the current search                         |
| `ontrack.travel.list.openHub.<tripId>`           | Open trip (plan detail) from the card body                |
| `ontrack.travel.list.editTrip.<tripId>`          | Edit trip details (hero control)                          |
| `ontrack.travel.list.itinerary.<tripId>`         | View Itinerary → plan detail                              |
| `ontrack.travel.list.dates.<tripId>`             | Layout anchor — trip-card date range + weekdays           |
| `ontrack.travel.list.coTravelers.<tripId>`       | Open Co-Travelers from avatar stack / plan tools          |
| `ontrack.travel.list.cover.<tripId>`             | Expand a trip cover photo (legacy)                        |
| `ontrack.travel.list.collapse.<tripId>`          | Legacy collapse control (unused on launcher cards)        |
| `ontrack.travel.list.editDates.<tripId>`         | Legacy dates control (edit trip / plan detail)            |
| `ontrack.travel.list.calendar.<tripId>`          | Add trip to Calendar (**plan detail tools**)              |
| `ontrack.travel.list.searchFlights.<tripId>`     | Search Flights (**plan detail tools**)                    |
| `ontrack.travel.list.searchStays.<tripId>`       | Search Stays (**plan detail tools**)                      |
| `ontrack.travel.list.straiaway.<tripId>`         | Send / import / open stays in StraiAway                   |
| `ontrack.travel.list.tripWeather.<tripId>`       | Trip Weather (**plan detail tools**)                      |
| `ontrack.travel.list.currency.<tripId>`          | Open Currency Calculator (**plan detail tools**)          |
| `ontrack.travel.list.translator.<tripId>`        | Open Destination Translator (**plan detail tools**)       |
| `ontrack.travel.list.expenses.<tripId>`          | Open Expenses (**plan detail tools**)                     |
| `ontrack.travel.list.packingList.<tripId>`       | Open existing trip checklist, or create one (**plan detail tools**) |
| `ontrack.travel.list.groupChat.<tripId>`         | Open Group Chat (**plan detail tools**)                   |
| `ontrack.travel.list.notesSection.<tripId>`      | Legacy notes section (unused on launcher cards)           |

### Interactive Travel Atlas (`/travel-map`, flow `travel-map-demo`)

The atlas is a root full-screen route. The named flow seeds Iceland and Antigua
pins, opens the world view, and verification cleanup returns devices to a
portrait Travel screen.

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.map.open` / `.close` | Travel Home globe entry / close atlas from the world view |
| `ontrack.travel.map.section.world` / `.country` | World and drilled country canvas anchors |
| `ontrack.travel.map.section.globe` | Interactive orthographic world globe anchor |
| `ontrack.travel.map.section.flatWorld` | Landscape edge-to-edge flat world map anchor |
| `ontrack.travel.map.layout.portrait` / `.landscape` | Orientation-specific layout anchors |
| `ontrack.travel.map.countryPicker.open` | Searchable country picker |
| `ontrack.travel.map.country.<ISO>` | Country picker option |
| `ontrack.travel.map.citySearch.open` | Open city search inside the selected country |
| `ontrack.travel.map.citySearch.input` | Offline city search field scoped to the selected country |
| `ontrack.travel.map.citySearch.result.<index>` | Highlight a city; Pin a Place then opens prefilled with it |
| `ontrack.travel.map.cluster.<ISO>` | Visited-country aggregate marker |
| `ontrack.travel.map.backToWorld` | Country-view top-left back chevron; return to the world map |
| `ontrack.travel.map.pinPlace.open` / `.close` | Start / dismiss Pin a Place |
| `ontrack.travel.map.pinPlace.trip` / `.trip.none` | Optional trip picker / explicit no-trip option |
| `ontrack.travel.map.pinPlace.search` | Country-filtered online place search |
| `ontrack.travel.map.pinPlace.searchResult.<index>` | Place search result |
| `ontrack.travel.map.pinPlace.onMap` | Enter offline-capable map placement |
| `ontrack.travel.map.pinPlace.mapTarget` | Country-map tap target; opens Pin a Place with that coordinate |
| `ontrack.travel.map.pinPlace.label` / `.save` | Manual place name / save pin |
| `ontrack.travel.map.place.<pinId>` | Place pin that opens its preview |
| `ontrack.travel.map.preview` | Portrait bottom card / landscape right rail |
| `ontrack.travel.map.preview.openTrip` / `.close` | Authorized full-trip action / close preview |
| `ontrack.travel.map.preview.unpin` / `.unpin.confirm` | Owner-only unpin action / destructive confirmation |
| `ontrack.travel.map.people.open` | Open friend overlay picker |
| `ontrack.travel.map.person.<userId>` | Colored avatar-ring layer control |
| `ontrack.travel.map.share.toggle` | Owner friend-sharing opt-in inside the friend-overlay sheet |
| `ontrack.travel.map.suggestion.confirm` / `.skip` | Review or dismiss an inferred existing-trip pin |

### Travel trip hub (`/travel/<id>/hub`) — redirects to Trip Tools

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.hub.close`                  | Close trip tools (empty state)   |
| `ontrack.travel.hub.backToTravel`           | Empty-state back to Travel       |
| `ontrack.travel.hub.section.<tripId>`       | Legacy hub anchor (unused)       |

### Trip Tools (`/travel/<id>/tools`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.tripTools.back`             | Return to the trip itinerary                 |
| `ontrack.travel.tripTools.backToTravel`     | Missing-trip fallback to Travel              |
| `ontrack.travel.tripTools.section.<tripId>` | Trip Tools glass action-grid page anchor     |
| `ontrack.travel.planDetail.section.tools`   | Compatibility anchor on the Trip Tools page  |
| `ontrack.travel.dates.close`                     | Close the trip date-range calendar                        |
| `ontrack.travel.dates.start`                     | Select the trip start-date endpoint                       |
| `ontrack.travel.dates.end`                       | Select the trip end-date endpoint                         |
| `ontrack.travel.dates.calendar.previousMonth`    | Show the previous month in the trip calendar              |
| `ontrack.travel.dates.calendar.nextMonth`        | Show the next month in the trip calendar                  |
| `ontrack.travel.dates.calendar.day.<YYYY-MM-DD>` | Select a day in the trip calendar                         |
| `ontrack.travel.dates.save`                      | Save the selected trip date range                         |
| `ontrack.travel.planNotes.close`                 | Close the trip notes editor                               |
| `ontrack.travel.planNotes.field`                 | Trip notes text field                                     |
| `ontrack.travel.planNotes.save`                  | Save trip notes                                           |
| `ontrack.travel.photoViewer.dismiss.<viewerKey>` | Dismiss the expanded trip/moment photo                    |
| `ontrack.travel.photoViewer.close.<viewerKey>`   | Close the expanded trip/moment photo                      |
| `ontrack.travel.timelineItem.<itemId>.photo.<n>` | Open a moment/itinerary photo in the lightbox             |
| `ontrack.travel.itineraryAdd.photo.<n>`          | Preview an attached photo in the add/edit sheet           |
| `ontrack.travel.itineraryAdd.removePhoto.<n>`    | Remove an attached photo (control above the thumb)        |

### Travel canonical actions

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.newTrip.open`                     | Open the new-trip bottom sheet                     |
| `ontrack.travel.newTrip.cancel`                   | Close the new-trip bottom sheet                    |
| `ontrack.travel.newTrip.title`                    | New-trip title field                               |
| `ontrack.travel.newTrip.destination`              | New-trip destination (address autocomplete)        |
| `ontrack.travel.newTrip.destination.suggestionsDismiss` | Tap-outside dismiss for destination suggestions |
| `ontrack.travel.newTrip.destination.suggestion.<i>` | Pick a destination address suggestion row        |
| `ontrack.travel.newTrip.dates`                    | New-trip Dates field (opens range calendar)        |
| `ontrack.travel.newTrip.datesClose`               | Close the new-trip dates calendar modal            |
| `ontrack.travel.newTrip.datesSave`                | Save the new-trip date range                       |
| `ontrack.travel.newTrip.calendar`                 | New-trip range calendar                            |
| `ontrack.travel.newTrip.calendar.previousMonth`   | Previous month on the new-trip calendar            |
| `ontrack.travel.newTrip.calendar.nextMonth`       | Next month on the new-trip calendar                |
| `ontrack.travel.newTrip.calendar.day.<YYYY-MM-DD>` | Select a day on the new-trip calendar             |
| `ontrack.travel.newTrip.notes`                    | New-trip notes field                               |
| `ontrack.travel.newTrip.create`                   | Create the trip                                    |
| `ontrack.travel.editTrip.title`                   | Edit-trip title field                              |
| `ontrack.travel.editTrip.cover`                   | Open add cover photos sheet                        |
| `ontrack.travel.editTrip.addCover`                | Add cover photos (up to 3)                         |
| `ontrack.travel.editTrip.removeCover.<index>`     | Remove a cover photo by index                      |
| `ontrack.travel.editTrip.destination`             | Edit-trip destination (address autocomplete)       |
| `ontrack.travel.editTrip.startDate`               | Edit-trip departure date                           |
| `ontrack.travel.editTrip.endDate`                 | Edit-trip return date                              |
| `ontrack.travel.editTrip.notes`                   | Edit-trip notes field                              |
| `ontrack.travel.detailsEditor.save.<itemId>`      | Save itinerary details                             |
| `ontrack.travel.detailsEditor.cancel.<itemId>`    | Cancel itinerary detail editing                    |
| `ontrack.travel.detailsEditor.remove.<itemId>`    | Remove an itinerary item                           |
| `ontrack.travel.flight.layoverDuration`           | Set a flight-leg layover as hours and minutes      |
| `ontrack.travel.flight.connectionAirport`         | Set the connection / layover airport code          |
| `ontrack.travel.flight.departureAirport`          | Departure airport code (From)                      |
| `ontrack.travel.flight.arrivalAirport`            | Arrival airport code (To)                          |
| `ontrack.travel.flight.departureTerminal`         | Set the departure airport terminal                 |
| `ontrack.travel.flight.arrivalTerminal`           | Set the arrival airport terminal                   |
| `ontrack.travel.flight.departureGate`             | Set the departure airport gate                     |
| `ontrack.travel.flight.arrivalGate`               | Set the arrival airport gate                       |
| `ontrack.travel.flight.status.<itemId>.<i>`       | Sync / check status for a flight leg beside its carrier line |
| `ontrack.travel.flight.legStatus.<itemId>.<i>`    | Per-leg operational status chip beside the carrier line |
| `ontrack.travel.flight.passenger.<itemId>`        | Passenger / traveler count on the flight booking panel |
| `ontrack.travel.flight.openConfirmation.<itemId>` | Open the uploaded flight confirmation document     |
| `ontrack.travel.confirmation.importAction.flight` | Import flight details from a confirmation          |
| `ontrack.travel.confirmation.importAction.rental` | Import rental details from a confirmation          |
| `ontrack.travel.confirmation.importAction.stay`   | Import stay details from a confirmation            |
| `ontrack.travel.timelineItem.<itemId>.editFlight` | Edit a flight itinerary leg                        |
| `ontrack.travel.timelineItem.<itemId>.edit` | Edit a moment/activity from the itinerary timeline toolbar |
| `ontrack.travel.timelineItem.<itemId>.openAddress` | Stay address → in-app maps chooser (Apple / Google / Copy) |
| `ontrack.travel.addPhotos.confirmRemovePhoto`     | Confirm photo removal                              |
| `ontrack.travel.importResult.close`               | Close an import result and return to the itinerary |
| `ontrack.travel.importResult.reviewExpense`       | Review the expense related to an import            |
| `ontrack.travel.friends.close`                    | Close the Co-Travelers sheet                       |
| `ontrack.travel.friends.openInvite`               | Open the friend invitation form                    |
| `ontrack.travel.friends.cancelInvite`             | Close the friend invitation form                   |
| `ontrack.travel.friends.inviteName`               | Friend invitation name                             |
| `ontrack.travel.friends.inviteEmail`              | Friend invitation account email                    |
| `ontrack.travel.friends.createInvite`             | Create a friend invitation                         |
| `ontrack.travel.friends.leaveTrip`                | Leave a shared trip (non-host members)             |
| `ontrack.travel.friends.copyJoinLink`             | Copy the open join link                            |
| `ontrack.travel.friends.shareJoinLink`            | Share the open join link                           |
| `ontrack.travel.currency.close`                   | Close the currency calculator                      |
| `ontrack.travel.currency.done`                    | Done on the currency calculator                    |
| `ontrack.travel.weather.close`                    | Close destination weather                          |
| `ontrack.travel.weather.done`                     | Done on destination weather                        |
| `ontrack.travel.weather.current`                  | Live conditions at the trip destination            |
| `ontrack.travel.friendRow.<target>.<action>`      | Manage, rename, or remove a trip friend            |
| `ontrack.travel.confirmation.open.<kind>`         | Open uploaded confirmation images                  |
| `ontrack.travel.confirmation.close`               | Close the confirmation viewer                      |
| `ontrack.travel.notes.open.<itemId>`              | Open itinerary notes                               |
| `ontrack.travel.notes.close`                      | Close itinerary notes                              |
| `ontrack.travel.notes.composer`                   | Add or edit a note                                 |
| `ontrack.travel.notes.submit`                     | Save or post a note                                |
| `ontrack.travel.notes.cancelEdit`                 | Cancel note editing                                |
| `ontrack.travel.notes.edit.<noteId>`              | Edit a note                                        |
| `ontrack.travel.notes.delete.<noteId>`            | Request note deletion                              |
| `ontrack.travel.notes.confirmDelete`              | Confirm note deletion                              |

## Design-system gallery

Deep link example: `ontrack://design-system` / Expo route `/design-system`

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.profile.designSystem`     | Open the development gallery from Profile (also via Developer Tools) |
| `ontrack.profile.apiUsage`         | Open Integrations (also via Developer Tools) |
| `ontrack.profile.developer`        | Open Developer Tools hub |
| `ontrack.profile.usageAnalytics`   | Toggle first-party usage analytics |
| `ontrack.profile.showHolidays`     | Toggle public holidays on Calendar and Today |
| `ontrack.profile.appearance.open` | Open App Appearance from Profile |
| `ontrack.profile.appearance.back` | Return to Profile |
| `ontrack.profile.appearance.preview` | Live app-theme preview |
| `ontrack.profile.appearance.preset.<presetId>` | Apply a complete theme preset |
| `ontrack.profile.appearance.color.<token>` | Open the custom picker for a theme token |
| `ontrack.profile.appearance.color.close` | Close the custom color picker |
| `ontrack.profile.appearance.color.hex` | Enter an exact custom hex color |
| `ontrack.profile.appearance.color.save` | Apply the selected custom color |
| `ontrack.profile.appearance.reset` | Restore the Classic theme |

### Route error boundary (recoverable crash shell)

| ID | Control |
|----|---------|
| `ontrack.errorBoundary.root` | Crash / failed-route shell |
| `ontrack.errorBoundary.retry` | Try again |
| `ontrack.errorBoundary.sendReport` | Send crash report directly to support |
| `ontrack.errorBoundary.reportStatus` | Crash report sent / failed status |

### Developer Tools (`/developer`, `account_flags.developer_tools`)

| ID | Control |
|----|---------|
| `ontrack.developer.back` | Back to profile |
| `ontrack.developer.section.appUpdates` | Expand/collapse App Updates (collapsed by default) |
| `ontrack.developer.section.navigate` | Expand/collapse Navigate (collapsed by default) |
| `ontrack.developer.section.insights` | Expand/collapse Product insights (closed by default) |
| `ontrack.developer.section.runtime` | Expand/collapse Runtime (closed by default) |
| `ontrack.developer.section.diagnostics` | Expand/collapse Diagnostics (closed by default) |
| `ontrack.developer.section.tools` | Expand/collapse Tools (closed by default) |
| `ontrack.developer.insights` | Product insights body |
| `ontrack.developer.insights.local` | This-device usage card |
| `ontrack.developer.insights.product` | All-users usage card |
| `ontrack.developer.insights.refresh` | Refresh insights (header action) |
| `ontrack.developer.releaseNotes` | App Updates body (Release Notes / Changelogs) |
| `ontrack.developer.releaseNotes.tabs` | Release Notes / Changelogs segmented control |
| `ontrack.developer.releaseNotes.tab.releaseNotes` | Release Notes tab |
| `ontrack.developer.releaseNotes.tab.changelog` | Changelogs tab |
| `ontrack.developer.releaseNotes.date` | Current ship-day date (MM/DD/YYYY) between arrows |
| `ontrack.developer.releaseNotes.currentVersion` | Current Version: X.Y.Z under the date |
| `ontrack.developer.releaseNotes.prev` | Older ship day |
| `ontrack.developer.releaseNotes.next` | Newer ship day |
| `ontrack.developer.releaseNotes.list` | Versions for the selected day (latest on top) |
| `ontrack.developer.releaseNotes.day.<YYYY-MM-DD>` | Card for the selected ship day |
| `ontrack.developer.releaseNotes.version.<semver>` | Notes block for one version |
| `ontrack.developer.devMode` | Toggle Dev Mode sandbox |
| `ontrack.developer.staySignedIn` | Keep this device signed in across app kills |
| `ontrack.developer.lockSession` | Show the sign-in gate without signing out |
| `ontrack.developer.designSystem` | Open Design System |
| `ontrack.developer.apiUsage` | Open Integrations |
| `ontrack.developer.performance` | Open Performance Monitor |
| `ontrack.developer.env` | Runtime env card |
| `ontrack.developer.overlay` | Agent-ui overlay toggle |
| `ontrack.developer.sync` | Cloud sync status |
| `ontrack.developer.seeds` | Demo seed list (under Navigate, only while Dev Mode is on) |
| `ontrack.developer.seed.<name>` | Seed fixture button |
| `ontrack.developer.routeInput` | Route alias field |
| `ontrack.developer.routeGo` | Open route |
| `ontrack.developer.storage` | Local storage sizes |
| `ontrack.developer.storageRefresh` | Refresh storage sizes |
| `ontrack.developer.rateLimitReset` | Reset app rate limits |

### Performance Monitor (`/(tabs)/profile/performance`, `developer_tools` only)

| testID | Purpose |
| --- | --- |
| `ontrack.performance.back` | Return to Developer Tools |
| `ontrack.performance.section.live` | Live process metrics and memory breakdown |
| `ontrack.performance.processDetails` | Process, pressure, and heap detail card |
| `ontrack.performance.section.warnings` | Active drain-indicator warnings |
| `ontrack.performance.section.activities` | Logical runtime work list |
| `ontrack.performance.filter.<category>` | Runtime category filter |
| `ontrack.performance.activity.<id>` | Runtime activity row |
| `ontrack.performance.section.history` | Device-local hourly rollups |
| `ontrack.performance.copy` | Copy local diagnostics report |
| `ontrack.performance.settings` | Open operating-system app settings |
| `ontrack.performance.clear` | Open clear-history confirmation |
| `ontrack.performance.clear.confirm` | Confirm clearing session and stored history |

### Integrations (`/integrations`, `__DEV__` only)

| ID | Control |
|----|---------|
| `ontrack.apiUsage.screen` | Screen anchor |
| `ontrack.apiUsage.back` | Back to profile |
| `ontrack.apiUsage.sync` | Sync / reload snapshot (section header trailing action) |
| `ontrack.apiUsage.retry` | Retry after error |
| `ontrack.apiUsage.healthSummary` | Status overview card |
| `ontrack.apiUsage.sort` | Sort dropdown trigger (Unhealthy / Healthy / A–Z / Usage) |
| `ontrack.apiUsage.sort.status-worst` / `.status-healthy` / `.name` / `.usage` | Sort dropdown options |
| `ontrack.apiUsage.service.<id>` | Service row (e.g. `openai-nutrition`) |
| `ontrack.designSystem.back`        | Leave the gallery (back to Developer)     |
| `ontrack.designSystem.info`        | How to use this gallery (sheet)           |
| `ontrack.designSystem.mode.<mode>` | Gallery tab (`elements` / `demos` / `colors` / `fonts`→Type / `icons`) |
| `ontrack.designSystem.catalogGroup.<group>` | Elements group toggle (`layout` / `actions` / …) |
| `ontrack.designSystem.catalogElement.<id>` | Element row (opens Demos / foundation tab) |
| `ontrack.designSystem.demo.<name>` | Live control inside Demos |
| `ontrack.designSystem.primary`     | Primary action example                    |
| `ontrack.designSystem.secondary`   | Secondary action example                  |
| `ontrack.designSystem.ghost`       | Ghost action example                      |
| `ontrack.designSystem.delete`      | Destructive action example                |
| `ontrack.designSystem.input`       | Form field example                        |
| `ontrack.designSystem.sheet.close` | Close the canonical sheet                 |
| `ontrack.designSystem.section.<scope>` | Colors editor section (`default` / `travel` / `plants` / `vehicles`) |
| `ontrack.designSystem.token.<scope>.<key>` | Hex input for an editable theme token |
| `ontrack.designSystem.swatch.<scope>.<key>` | Live swatch for an editable token |
| `ontrack.designSystem.resetToken.<scope>.<key>` | Reset one token to the shipped default |
| `ontrack.designSystem.preset.<scope>.<key>.<hex>` | Preset chip (hex without `#`) |
| `ontrack.designSystem.resetAll`    | Restore all theme defaults (top Colors card) |
| `ontrack.designSystem.resetAll.footer` | Restore defaults (footer, when overrides active) |
| `ontrack.designSystem.confirmRestoreDefaults` | Confirm restore-defaults prompt     |
| `ontrack.designSystem.history`     | Collapsible theme change-history toggle |
| `ontrack.designSystem.history.entry.<id>` | One history row (scroll list, ~3 visible) |
| `ontrack.designSystem.history.clear` | Clear history (visible while expanded)  |
| `ontrack.designSystem.fontRole.<role>` | Font preset dropdown trigger (`ui` / `mono`) |
| `ontrack.designSystem.fontPreset.<role>.<id>` | Font preset menu option              |
| `ontrack.designSystem.fontScale`   | Type-scale preview block                  |
| `ontrack.designSystem.resetFonts`  | Restore default UI + mono fonts           |
| `ontrack.designSystem.confirmRestoreFonts` | Confirm restore-fonts prompt         |
| `ontrack.designSystem.iconSection.<id>` | Icons gallery section (`categories` / `travel` / `navigation` / `status` / `exercises`) |
| `ontrack.designSystem.icon.<name>` | Individual semantic icon cell             |

## Activity form

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.activityForm.choice.<group>.<value>` | Select a meal, workout, or priority option |

## Health

Deep link: `ontrack://health` / Expo route `/(tabs)/health`

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.tabs.health`                                  | Open Health tab                     |
| `ontrack.health.section.body` / `.mind`                | Switch Health section               |
| `ontrack.health.body.connect`                          | Request Apple Health access         |
| `ontrack.health.body.refresh`                          | Refresh 90-day Health summary       |
| `ontrack.health.body.sleepHandoff`                     | Open Health from a sleep detail     |
| `ontrack.health.mind.checkIn`                          | Start a mood check-in               |
| `ontrack.health.mind.entry.<id>`                       | Edit a check-in; long-press deletes |
| `ontrack.health.checkIn.emotion.<id>`                  | Select or remove a feeling          |
| `ontrack.health.checkIn.intensity.<id>.<1-5>`          | Set feeling intensity               |
| `ontrack.health.checkIn.save`                          | Save the private check-in           |
| `ontrack.health.mind.addFactor`                        | Add something that affects a mood   |
| `ontrack.health.mind.factor.<id>.edit`                 | Edit or delete a mood factor        |
| `ontrack.health.mind.addPlaybook`                      | Create a private action playbook    |
| `ontrack.health.playbook.<id>.start`                   | Start a playbook                    |
| `ontrack.health.playbook.<id>.edit`                    | Edit or delete a playbook           |
| `ontrack.health.playbookRun.<id>.complete` / `.cancel` | Finish or stop a playbook run       |
| `ontrack.health.settings`                              | Open Health settings                |
| `ontrack.health.settings.stateSync.<off                | on>`                                | Configure State of Mind sync |
| `ontrack.trackers.addon.health`                        | Toggle the iPhone Health add-on     |

Demo fixture: `factor-agent-ui-demo-work` / `mood-agent-ui-demo-calm` via `./scripts/agent-ui-seed.sh health-demo` or flow `health-demo`.

## Journal

Deep link: `ontrack://journal` / Expo route `/(tabs)/journal` · flows `journal`, `journal-demo`, `journal-open-today`, `journal-prev-day`, `journal-next-day`

| testID | Control |
| --- | --- |
| `ontrack.tabs.journal` | Open Journal tab |
| `ontrack.journal.hub` | Journal landing (list or empty invite) |
| `ontrack.journal.hub.empty` | Empty landing invitation |
| `ontrack.journal.hub.pages` | Written pages list |
| `ontrack.journal.openToday` | Start or open today’s page (empty CTA, write-today +, or today’s card) |
| `ontrack.journal.page.<YYYY-MM-DD>` | Open a past page from the landing |
| `ontrack.journal.today` | Today’s page canvas |
| `ontrack.journal.screen` | Past-day page canvas |
| `ontrack.journal.back` | Back from a dated page to the landing |
| `ontrack.journal.prevDay` / `ontrack.journal.nextDay` | Day chevrons on the Journal line (far right); next disabled on today |
| `ontrack.journal.empty` | Empty dated page |
| `ontrack.journal.undo` / `ontrack.journal.redo` | Undo/redo text-block edits (left of Edit) |
| `ontrack.journal.editMode` | Header Edit (left of plus); shows delete on blocks |
| `ontrack.journal.dismissEdit` | Tap-out target that closes the inline editor |
| `ontrack.journal.block.<id>` | Text, voice, or link block (tap text to edit) |
| `ontrack.journal.block.<id>.edit` / `.save` | Inline text edit + save |
| `ontrack.journal.block.<id>.delete` / `.remove` | Delete control + confirm |
| `ontrack.journal.block.<id>.play` | Play a voice note |
| `ontrack.journal.link.<id>` | Open a linked section |
| `ontrack.journal.composer.menu` / `.dictate` / `.voiceNote` / `.link` | Header plus menu (dictate, voice note, link) |
| `ontrack.journal.composer.input` / `.send` / `.stop` | Docked page composer (send in the field) |
| `ontrack.journal.composer.wave` / `.transcribing` | Live recording wave + Transcribing status (anchors, mic-driven) |
| `ontrack.journal.sections.sheet` / `.close` / `.<section>` | Link-a-section sheet |

Demo fixture: `journal-agent-ui-demo-page` / `jtext-agent-ui-demo` via `./scripts/agent-ui-seed.sh journal-demo` or flow `journal-demo`.

## Finance

Deep link: `ontrack://finance` / Expo route `/(tabs)/finance` · flows `finance`, `finance-transactions`, `finance-transaction-filter-sort`, `finance-transaction-categorize`, `finance-rewards`, `finance-subscriptions` (combined recurring expenses), `finance-ezpass`, `finance-ezpass-import`, `finance-ezpass-add-friend`, `finance-ezpass-saved-statements`

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.tabs.finance` | Open Finance tab |
| `ontrack.finance.hub` | Finance hub |
| `ontrack.finance.more` | Collapse assets, credit, coach, buckets, and tools |
| `ontrack.finance.back` | Eyebrow back on Finance nested screens |
| `ontrack.finance.hub.transactions` / `.bills` / `.buckets` / `.entities` / `.accounts` / `.rewards` / `.tax` | Hub navigation |
| `ontrack.finance.hub.billPaid.<id>` | Mark bill paid from hub |
| `ontrack.finance.coach.<id>` | Money coach insight card |
| `ontrack.finance.expense.*` | Expense form (`form` + fields / save / cancel) |
| `ontrack.finance.transactions.*` | Transactions list |
| `ontrack.finance.transactions.section.activity` | Activity ledger heading and visible result count |
| `ontrack.finance.transactions.date.<YYYY-MM-DD>` | Date-group heading in the transaction ledger |
| `ontrack.finance.transactions.search` | Search transactions by merchant, category, date, source, activity, or amount |
| `ontrack.finance.transactions.filter.categories` / `.filter.category.<categoryId>` | Filter the transaction list by one or more categories |
| `ontrack.finance.transactions.sort` / `.sort.<sortId>` | Sort by date, amount, merchant, or category |
| `ontrack.finance.transactions.row.<id>` | Open transaction categorization sheet |
| `ontrack.finance.transactions.category.sheet` / `.close` / `.backdrop` / `.selector` / `.<categoryId>` / `.newName` / `.create` / `.save` | Search, choose, create, and save a transaction category |
| `ontrack.finance.hub.ezpass`                                                                                 | Open the E-ZPass area from Finance                                                                        |
| `ontrack.finance.ezpass.home` / `.summary` / `.monthChart` / `.monthDetail` / `.month.<YYYY-MM>` / `.share` / `.upload` | E-ZPass dashboard, road-spend summary, tappable six-month graph, selected-month totals, share action, and upload action |
| `ontrack.finance.ezpass.statements` / `.statements.toggle` / `.statement.<id>`                              | Bottom collapsible uploaded-statement list and reopenable saved source file                               |
| `ontrack.finance.ezpass.roadActivity` / `.replenishments` / `.day.<YYYY-MM-DD>` / `.activity.<id>`           | Combined toll/refund activity, separate replenishments, newest-first day groups, and imported activity    |
| `ontrack.finance.ezpass.driver.<all-or-mine-or-friend:id>` / `.friendTag.<transactionId>` / `.assignSelf`  | Filter E-ZPass activity by driver, assign/change an added friend, or explicitly assign the owner           |
| `ontrack.finance.ezpass.memberManagement` / `.memberRole.<userId>` / `.memberRemove.<userId>` / `.memberConfirmRemove.<userId>` | Manage E-ZPass members, co-host access, and removal                                                         |
| `ontrack.finance.ezpass.ledger.<id>`                                                                         | Owned/shared ledger selection                                                                               |
| `ontrack.finance.ezpass.officialSite` / `.file` / `.screenshots` / `.ai` / `.row.<id>` / `.confirm`          | Official E-ZPass NY handoff, source picker, review rows, optional AI fallback, and import confirmation    |
| `ontrack.finance.bills.*` | Recurring bills |
| `ontrack.finance.hub.recurring` / `ontrack.finance.recurring.*` | Combined Bills & Subscriptions summary, manual-add sheet, and saved-item editing (`.categorize.<id>` → `.categorize.sheet`, editable name, Bill/Subscription choices, category, save, and confirmed delete below Save) |
| `ontrack.finance.subscriptions.*` | Financial-data refresh, detected bill/subscription review, tracked recurring-expense rows, and removal from the edit sheet |
| `ontrack.finance.subscriptions.refreshStatus` / `.refreshStatus.dismiss` | Latest refresh result and its dismiss action |
| `ontrack.finance.buckets.*` | Savings buckets |
| `ontrack.finance.entities.*` | Personal / business / property |
| `ontrack.finance.accounts.*`                                                                                 | Manual accounts, Plaid bank/investment Link, provider sync/disconnect, HYSA APR                           |
| `ontrack.finance.accounts.rewardProfile.<accountId>` | Link a card account to a saved rewards profile |
| `ontrack.finance.rewards` / `.section.hero` / `.section.profiles` / `.section.transactions` / `.section.compare` | Rewards Optimizer screen and major analysis sections |
| `ontrack.finance.rewards.transaction.<id>` | Purchase-level actual-versus-best-card reward explanation |
| `ontrack.finance.rewards.addManual` / `.createFromLink` / `.importCsv` | Add a manual profile, analyze a public card link, or locally import a statement CSV |
| `ontrack.finance.rewards.range.<range>` / `.customFrom` / `.customTo` | Change the rewards analysis window |
| `ontrack.finance.rewards.profile.<id>` / `.profile.sheet` / `.profile.close` / `.profile.save` / `.profile.*` | Open, review, edit, and save a reward profile and its assumptions |
| `ontrack.finance.rewards.rule.*` / `.benefit.*` / `.welcomeOffer` | Edit bonus rules, caps, annual benefit values, and welcome-offer callout |
| `ontrack.finance.rewards.compare.left` / `.compare.right` | Compare any two saved reward profiles |
| `ontrack.finance.rewards.link.*` | Public HTTPS card-page analysis and editable-draft handoff |
| `ontrack.finance.rewards.csv.*` | Local CSV picker, guided column mapping, account selection, and import |
| `ontrack.finance.credit.*` | Credit score card, edit sheet, free-provider links |
| `ontrack.finance.tax.*` | Tax prep, doc vault, entity scope, export, File elsewhere |

## Travel plan detail

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| ~~`ontrack.travel.planDetail.weather`~~        | **Unused** — use `list.tripWeather.<tripId>` on the travel list          |
| ~~`ontrack.travel.planDetail.currency`~~       | **Unused** — use `list.currency.<tripId>` on the travel list             |
| `ontrack.travel.planDetail.addToTimeline`      | Add to Timeline                                                          |
| `ontrack.travel.planDetail.tripTools`          | Open Trip Tools (below Add to Timeline)                                   |
| `ontrack.travel.planDetail.groupChat`          | Group Chat — itinerary header top-right, left of Add (+)                 |
| `ontrack.travel.planDetail.section.transport`  | Expand/collapse transport group                                          |
| `ontrack.travel.planDetail.section.timeline`   | Expand/collapse timeline                                                 |
| `ontrack.travel.planDetail.section.loading`    | Glass skeleton under hero while itinerary cards settle                   |
| `ontrack.travel.planDetail.section.notes`      | Expand/collapse trip notes                                               |
| `ontrack.travel.planDetail.editNotes`          | Open the trip notes editor from the notes card body                      |
| `ontrack.travel.planDetail.section.ground`     | Expand/collapse Transit items                                            |
| `ontrack.travel.planDetail.section.events`     | Expand/collapse Events items                                             |
| `ontrack.travel.planDetail.addFlight`          | Empty-state CTA to add a flight                                          |
| `ontrack.travel.planDetail.addTransport`       | Empty-state CTA to add ground/transit                                    |
| `ontrack.travel.planDetail.addStay`            | Empty-state CTA to add a stay                                            |
| `ontrack.travel.planDetail.addRental`          | Empty-state CTA to add a rental                                          |
| `ontrack.travel.planDetail.addEvent`           | Empty-state CTA to add an event                                          |
| `ontrack.travel.planDetail.backToTravel`       | Empty-state back to Travel when plan is missing                          |

### Destination translator

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.translator.sheet` | Destination translator glass sheet |
| `ontrack.travel.translator.close` | Close translator and stop active audio/network work |
| `ontrack.travel.translator.language.home` / `.destination` | Choose either conversation language |
| `ontrack.travel.translator.language.swap` | Swap the selected languages |
| `ontrack.travel.translator.direction.home` / `.destination` | Choose typed translation direction |
| `ontrack.travel.translator.input` / `.translate` | Enter and translate typed text |
| `ontrack.travel.translator.microphone.home` / `.destination` | Record one short turn in the selected language |
| `ontrack.travel.translator.microphone.stop` | Stop the current recording and translate it |
| `ontrack.travel.translator.quickPhrase.<index>` | Translate a common traveler phrase |
| `ontrack.travel.translator.turn.<turnId>.copy` / `.replay` / `.retry` | Turn actions |
| `ontrack.travel.translator.preferences` | Open Profile preferences when AI is disabled |

| `ontrack.travel.timelineAdd.close`             | Kind picker close                                                        |
| `ontrack.travel.timelineAdd.kind.<kind>`       | Timeline kind choice                                                     |
| `ontrack.travel.timelineDay.<date>`            | Expand/collapse a timeline day group                                     |
| `ontrack.travel.timeline.progress`             | Timeline journey progress strip                                          |
| `ontrack.travel.timeline.progressBadge`        | Timeline progress status badge                                           |
| `ontrack.travel.timeline.progressMeta`         | Timeline progress “X/Y Days Done” meta                                   |
| `ontrack.travel.timeline.traveler`             | Tiny traveler chip on the progress track (beat icon)                     |
| `ontrack.travel.timeline.now`                  | Current-time marker on the active day                                    |
| `ontrack.travel.timelineItem.<itemId>.<phase>` | Expand/collapse an itinerary marker or structured card                   |
| `ontrack.travel.itineraryAdd.title`            | Itinerary item name                                                      |
| `ontrack.travel.itineraryAdd.importScreenshots`| Import a confirmation from photo screenshots                             |
| `ontrack.travel.itineraryAdd.importDocument`   | Import a confirmation from a document or email                           |
| `ontrack.travel.itineraryAdd.tripType.one-way` | Add Flight: one-way trip type                                            |
| `ontrack.travel.itineraryAdd.tripType.round-trip` | Add Flight: roundtrip trip type                                       |
| `ontrack.travel.itineraryAdd.date`             | Itinerary departure/start date                                           |
| `ontrack.travel.itineraryAdd.time`             | Itinerary departure/start time (activity: From)                          |
| `ontrack.travel.itineraryAdd.endDate`          | Itinerary end/arrival date                                               |
| `ontrack.travel.itineraryAdd.endTime`          | Itinerary end/arrival time (activity: To)                                |
| `ontrack.travel.itineraryAdd.returnDate`       | Roundtrip returning departure date                                       |
| `ontrack.travel.itineraryAdd.returnTime`       | Roundtrip returning departure time                                       |
| `ontrack.travel.itineraryAdd.returnEndDate`    | Roundtrip returning arrival date                                         |
| `ontrack.travel.itineraryAdd.returnEndTime`    | Roundtrip returning arrival time                                         |
| `ontrack.travel.itineraryAdd.returnTitle`      | Roundtrip returning name                                                 |
| `ontrack.travel.itineraryAdd.returnAirline`    | Roundtrip returning airline                                              |
| `ontrack.travel.itineraryAdd.returnFlightNumber` | Roundtrip returning flight number                                      |
| `ontrack.travel.itineraryAdd.returnFrom`       | Roundtrip returning from airport                                         |
| `ontrack.travel.itineraryAdd.returnTo`         | Roundtrip returning to airport                                           |
| `ontrack.travel.itineraryAdd.returnLayoverDuration` | Roundtrip returning layover duration                                |
| `ontrack.travel.itineraryAdd.returnConnectionAirport` | Roundtrip returning connection airport                            |
| `ontrack.travel.itineraryAdd.submit`           | Save the itinerary item                                                  |
| `ontrack.travel.list.addTransport.<tripId>`    | Add transport from a non-flight trip card                                |
| `ontrack.travel.transport.mode.<mode>`         | Choose driving, rail, transit, rideshare, taxi, ferry, shuttle, or other |
| `ontrack.travel.transport.origin`              | Transport origin or pick-up                                              |
| `ontrack.travel.transport.destination`         | Transport destination or drop-off                                        |
| `ontrack.travel.transport.arrivalDate`         | Transport arrival date                                                   |
| `ontrack.travel.transport.arrivalTime`         | Transport arrival time                                                   |
| `ontrack.travel.transport.addStop`             | Add a road-trip route stop                                               |
| `ontrack.travel.transport.stop.<id>.*`         | Edit or remove a route stop                                              |
| `ontrack.travel.transport.attachDocument`      | Attach a ticket document                                                 |
| `ontrack.travel.transport.attachScreenshots`   | Attach ticket screenshots                                                |
| `ontrack.travel.transport.<id>.openMaps`       | Open a driving route in Maps                                             |
| `ontrack.travel.transport.<id>.edit`           | Edit structured transport details                                        |

Deep link: `ontrack://travel/<planId>` → `/travel/[id]`

## Flight search (`/travel/[id]/flights`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.flightSearch.back`          | Back to trip                       |
| `ontrack.travel.flightSearch.from`          | From                               |
| `ontrack.travel.flightSearch.to`            | To                                 |
| `ontrack.travel.flightSearch.departure`     | Departure date                     |
| `ontrack.travel.flightSearch.return`        | Return date                        |
| `ontrack.travel.flightSearch.travelers`     | Travelers                          |
| `ontrack.travel.flightSearch.currency`      | Currency                           |
| `ontrack.travel.flightSearch.searchLive`    | Live Search Flights (when flag on) |
| `ontrack.travel.flightSearch.compareGoogle` | Compare on Google Flights          |

## Stay search (`/travel/[id]/stays`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.staySearch.back`                 | Back to trip |
| `ontrack.travel.staySearch.provider.booking`     | Booking.com  |
| `ontrack.travel.staySearch.provider.airbnb`      | Airbnb       |
| `ontrack.travel.staySearch.provider.hostelworld` | Hostelworld  |

## Modals / sheets

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.addPhotos.close`               | Dismiss grabber                                       |
| `ontrack.travel.addPhotos.takePhoto`           | Take Photo                                            |
| `ontrack.travel.addPhotos.chooseFromPhotos`    | Choose from Photos                                    |
| `ontrack.travel.addPhotos.removePhoto`         | Remove Photo (optional)                               |
| `ontrack.travel.editTrip.save`                 | Save edited trip details                              |
| `ontrack.travel.editTrip.cancel`               | Cancel editing a trip                                 |
| `ontrack.travel.editTrip.dangerZone`           | Edit-trip danger zone (delete trip)                   |
| `ontrack.travel.calendarUpdated.dismiss`       | Dismiss grabber and return to Travel                  |
| `ontrack.travel.calendarUpdated.goToCalendar`  | Go to Calendar                                        |
| `ontrack.travel.itineraryAdd.close`            | Close add-to-timeline sheet                           |
| `ontrack.travel.expenses.paidBy.<personId>`    | Paid By person avatar (`self`, `host`, `member:…`, …) |
| `ontrack.travel.expenses.splitWith.<personId>` | Split With person avatar                              |
| `ontrack.travel.expenses.list`                 | Expenses list sheet body (wait target)                |
| `ontrack.travel.expenses.addExpense`           | Add Expense (list footer)                             |
| `ontrack.travel.expenses.submitExpense`        | Add Expense submit (editor)                           |
| `ontrack.travel.expenses.saveExpense`          | Save Expense submit (editor)                          |
| `ontrack.travel.expenses.deleteExpense`        | Delete expense (legacy editor button)                 |
| `ontrack.travel.expenses.deleteExpenseFooter`  | Delete expense (editor footer)                        |
| `ontrack.travel.expenses.confirmDelete`        | Confirm expense deletion prompt                       |
| `ontrack.travel.expenses.close`                | Close Expenses sheet                                  |
| `ontrack.travel.expenses.row.<expenseId>`      | Expense list row (edit)                               |

## Group chat (`/travel/[id]/chat`)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.travel.chat.close`               | Close Group Chat      |
| `ontrack.travel.chat.enableNotifications` | Turn On notifications |
| `ontrack.travel.chat.dismissNotifications`| Dismiss alerts banner |
| `ontrack.travel.chat.menu`                | Header chat settings    |
| `ontrack.travel.chat.settingsClose`       | Close chat settings sheet |
| `ontrack.travel.chat.settingsEnableNotifications` | Turn on alerts (settings sheet) |
| `ontrack.travel.chat.composer`            | Message composer      |
| `ontrack.travel.chat.send`                | Send message          |
| `ontrack.travel.chat.replyCancel`         | Cancel reply quote    |
| `ontrack.travel.chat.messageActions`      | Long-press message bubble |
| `ontrack.travel.chat.menuReply`           | Popover Reply         |
| `ontrack.travel.chat.menuCopy`            | Popover Copy          |
| `ontrack.travel.chat.menuEdit`            | Popover Edit          |
| `ontrack.travel.chat.menuDelete`          | Popover Delete        |
| `ontrack.travel.chat.reaction.<emoji>`    | Reaction chip / tray emoji |

Deep link: `ontrack://travel/<planId>/chat` → `/travel/[id]/chat`

## Chrome

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.chrome.back`       | `BackButton` default       |
| `ontrack.chrome.headerBack` | `HeaderBackButton` default |

## Agent UI (DEV)

| testID                            | Control                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `ontrack.agentUi.overlay.root`    | Overlay host (`./scripts/agent-ui-overlay.sh on` paints framed testIDs) |
| `ontrack.agentUi.overlay.toggle` | White circular FAB (Travel `+` style; default bottom-right) — tap toggles overlay; drag to move; long-press hides. On = target count. Restore: page long-press (Dev Mode + developer account) or Diagnostics → Overlay (**DEV**) |
| `ontrack.dev.themeToggle`        | White circular FAB (Travel `+` style; default bottom-right, left of overlay) — tap flips Light ↔ Dark (moon/sun). Hidden by default; triple-tap the page to show/hide (**DEV**)                                                  |

## Source of truth

IDs are defined in [`src/utils/agent-ui/ids.ts`](../src/utils/agent-ui/ids.ts). **When creating or editing an interactive control, always add an ID there, stamp `testID` on the control, and update this map in the same change.** An ID should never be “missing” for a tappable control — that is a defect, not a reason to use coordinates.

Major layout sections that show up in bug screenshots should also get a non-tappable `AgentTestId` anchor. After adding/renaming many ids, refresh the file index:

```bash
npm run agent-ui:sources
# or: ./scripts/agent-ui-sources.sh
```
