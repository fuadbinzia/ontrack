---
name: food
description: >-
  onTrack Food module: food tab shell, food theme scope, recipes, pantry, food profile
  (diet/allergies), ingredient knowledge, meal plan, community feed, scanner, and AI recipe
  ideas. Use when editing src/features/food/, src/store/food-*.ts, src/services/food/, or
  routes under src/app/(tabs)/food/.
---

# Food (onTrack)

Built from the `Food_For_Me_Cursor_Implementation_Package` hand-off. The package is extracted
(gitignored) at `.design/food-package/` — read it for exact spec values; this file is the
authoritative repo mapping.

## Start here

| Surface | Entry |
|---------|-------|
| Tab shell / scope | `src/app/(tabs)/food/_layout.tsx` (`FeatureThemeProvider scope="food"`) |
| Screen wrapper | `src/features/food/food-screen.tsx` (`FoodScreen` over `Screen` + gutters) |
| Home | `src/app/(tabs)/food/index.tsx` |
| Recipes / detail | `src/app/(tabs)/food/recipes/index.tsx`, `recipes/[id].tsx` |
| Meal tracker | `src/app/(tabs)/food/tracker.tsx` (reads schedule meals) |
| AI ideas | `src/app/(tabs)/food/ai-ideas.tsx` |
| Scanner | `src/app/(tabs)/food/scan.tsx` |
| Diet & allergies | `src/app/(tabs)/food/preferences.tsx` |
| Nutrition profiles | `src/app/(tabs)/food/nutrition-profile.tsx` (legacy `/nutrition-profile` + Profile path redirect here) |
| Ingredient info | `src/app/(tabs)/food/ingredients/index.tsx`, `ingredients/[id].tsx` |
| Community | `src/app/(tabs)/food/community.tsx` |
| Plan / shopping | `src/app/(tabs)/food/plan.tsx` |
| Types | `src/types/food.ts` |
| Stores | `src/store/food-profile.ts`, `food-pantry.ts`, `food-recipes.ts`, `food-meal-plan.ts` |
| Demo seed | `features/food/food-seed.ts` (`plantFoodLibrary` / `seedFoodIfNeeded`); agent hydrate `utils/agent-ui/fixtures-food.ts` |
| Fixtures | `features/food/fixtures.ts` (+ `fixture-ai-fallbacks`, `fixture-ingredient-knowledge`) |
| Services | `src/services/food/` (`safety.ts`, `labels.ts` meal/diet labels) + `src/app/food/*+api.ts` |

## Reuse, do not rebuild

- **Meals** live in `src/store/schedule.ts` as a `Meal` side-table keyed by `activityId`
  (`upsertMeal`, `setProcessedMealPhoto`). The Food tracker reads through selectors — it does
  not fork meal storage.
- **Meal AI** is `src/services/nutrition/` + `meal-analysis/photo|link|confirm+api.ts` over
  `@/services/ai/vision-transport`. New food endpoints reuse that transport, `api-gate`, and
  `guardedFetch`.
- **Grocery ingredients** are `ChecklistRecipe` + `ChecklistTask` rows in `src/store/checklists*.ts`.
  `plan.tsx` bridges to them via `buildCombinedIngredients` / `scaleIngredients` in
  `src/features/checklists/grocery-utils.ts` — the shopping list is not forked.
- **Clinical nutrition** (`src/store/nutrition.ts`, `NutritionProfile`) is intentionally
  memory-only. `food-profile.ts` is the separate persisted, product-facing profile. Do not
  merge them.

## Non-negotiables

- **Glass UI:** Food chrome is glass — `GlassPlate` / `Card` / `GlassTonePill` / `GlassIconWell`
  / `GlassMetaChip` / `StatusBadge`. No opaque paper fills. See `.cursor/rules/glass-ui.mdc`.
- **Sheets:** every Food sheet uses `FoodSheet` (`src/features/food/food-sheet.tsx`), a thin
  `SheetScaffold surface="glass"` preset. Zero per-screen sheet geometry.
- **Back:** stack screens use `FoodHeaderBackButton` (`food-header-back-button.tsx`) —
  compact + `fallback="/(tabs)/food"`. Never bare `HeaderBackButton` (defaults to `/`).
- **Tokens:** onTrack `radii` / `typography` / `spacing` win on geometry; the package palette
  is carried by the `food` theme scope in `src/design-system/themes.ts`. Never hard-code a hex
  or a `fontSize` in a Food screen.
- **Safety (hard requirement):**
  - Severe allergens are injected as exclusions into every AI request **and** filtered from
    results before render — `filterUnsafeSuggestions` in `src/services/food/safety.ts`, unit tested.
  - Low-confidence OCR always routes through a user correction step before analysis.
  - A jurisdiction/regulatory status renders only with `sourceUrl` + `lastReviewedAt`, never
    from model output alone. "Banned" is never presented as "dangerous".
  - Allergy and health data is private by default in Community; never in a share payload
    unless explicitly opted in.
- **No color-only meaning:** allergy severity and country status always carry text + icon.
- **IDs:** `@/utils/id`. **Dates:** `YYYY-MM-DD` via `@/utils/date`. **Prompts:** `appPrompt`.
- **Images:** the shared `FoodImage` primitive (`src/components/primitives/food-image.tsx`) —
  never `expo-image` directly in a Food screen, and never persist picker cache URIs
  (`@/utils/image-persist`).

## Token mapping (package spec to onTrack)

| Package | onTrack |
|---------|---------|
| canvas `#F7F4EE` / dark `#11110F` | `theme.backgroundPrimary` in the `food` scope |
| textPrimary `#25231F` / `#F6F2EA` | `theme.textPrimary` |
| action `#292722` / `#EEE9E0` | `theme.accentPrimary` |
| success/warning/danger `#3E8D68` `#B9852F` `#B95750` | `theme.success` / `warning` / `danger` |
| glassBase / glassStrong | `GlassPlate` default / `airy`; `mist` for nested chips |
| radius 8/12/16/20/24/28/32 | `radii.sm 8` / `md 14` / `lg 20` / `xl 28` / `pill` |
| displayXL/h1/h2/cardTitle/body/bodyS/caption | `display` / `title` / `heading` / `subheading` / `body` / `callout` / `caption` |
| Times New Roman | `font-presets.ts` `times` preset; default stays the system serif |

## Responsive

Phone width classes only: `widthClass()` and `contentGutter()` in `src/design-system/responsive.ts`
(compact ≤359 → 14, regular 360–479 → 16, large ≥480 → 20), surfaced via `useResponsive()` as
`widthClass` / `gutter`. Chrome uses `useResponsive()` + `AppText fit`.

**Deferred, not built:** the package's 600–1280dp tablet/foldable/landscape rules
(`.design/food-package/05_RESPONSIVE/`). `app.json` remains `orientation: "portrait"`,
`ios.supportsTablet: false`. Revisit only if the whole app adopts tablet.

## Other intentional deviations

- No `FoodBottomNav` — the module integrates with the app's bottom nav rail (the package itself
  requires this).
- No bundled font binary; the package ships none and licensing is unresolved.

## Verify

Runtime routes drop the `(tabs)` group: assert on `/food`, `/food/recipes`, `/food/tracker` —
**not** `/(tabs)/food` (that fails the route wait even though the screen renders).

```bash
./scripts/agent-ui-verify-both.sh --route /food --flow food-demo \
  --exists ontrack.food.home.section.suggestions
```

Seed flow `food-demo` fills profile, pantry, recipes, and meals so every screen renders with no
backend. Assert then stop — see `.cursor/skills/agent-ui/SKILL.md`.

`seedFoodIfNeeded` (`features/food/food-seed.ts`) plants the same recipes/pantry/plan for **every**
user once per install (`seeded` on `store/food-recipes`) while Food has no backend — the fixture
diet/allergy profile is excluded on purpose. Fixture dishes get their photo from
`features/food/food-image-source.ts` (`assets/images/seed/food/`), so `FoodImage` placeholders only
appear for user-created recipes.
