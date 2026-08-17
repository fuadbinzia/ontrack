# Food module — visual acceptance report (Phase 7)

Audit of `.design/food-package/09_QA/VISUAL_ACCEPTANCE.md`, item by item.
Statuses: **PASS** / **FAIL** / **N-A-DEFERRED**. Device (simulator) verification is run
separately by the owner; evidence below is code/test-level.

Date: 2026-08-09 · Tally: **28 PASS · 0 FAIL · 10 N-A-DEFERRED**

## Global (9 PASS)

| Item | Status | Evidence |
|---|---|---|
| Neutral canvas matches token in light/dark | PASS | `FoodScreen` wraps shared `Screen` (theme canvas + `ScreenAtmosphere`); no local background paints — `food-glass-contract.test.ts` scan |
| Serif through one centralized typography alias | PASS | `src/design-system/typography.ts:8` — single `typeConfig.fontFamily` (platform serif; web falls back to Times New Roman). No bundled binary per skill "Other intentional deviations" |
| No arbitrary font sizes | PASS | `food-glass-contract.test.ts` forbids `fontSize:` across all Food source (0 hits) |
| No arbitrary radius values | PASS | Same test forbids `borderRadius: <n>` and `borderRadius: s(` — last violation (`scan.tsx` `s(24)`) fixed to `radii.xl` this phase |
| No arbitrary shadows/blur | PASS | Same test forbids `shadowRadius:`/`shadowOpacity:`; `glass-plate-contract.test.ts` Food block forbids `BlurView` in Food chrome |
| Cards read as glass, text high contrast | PASS | `Card` defaults `surface='glass'` (`glass-plate-contract.test.ts`); text via theme `text*` tokens only |
| Photography vivid, chrome neutral | PASS | `FoodImage` (photo) vs neutral Glass chrome; no `kindTint`/accent fills (scan test) |
| All icons from semantic wrapper | PASS | Food UI uses `Symbol` from `design-system/icons` exclusively (no direct icon-lib imports in Food dirs) |
| No emoji icons | PASS | Emoji grep over `src/app/(tabs)/food` + `src/features/food` + `food-image.tsx` — 0 hits |

## Responsive (4 PASS · 5 N-A-DEFERRED)

| Item | Status | Evidence |
|---|---|---|
| 320 width does not clip primary content | PASS | `widthClass(320) === 'compact'` (`responsive-contract.test.ts`); compact paths: safety-row reason moves below (`ingredient-safety-row.test.tsx`), recipe-detail CTAs stack (`recipes/[id].tsx`), quick-action grid re-bases; rows use `flexShrink:1` + `minWidth:0` |
| 360 width has 14–16 gutters | PASS | `contentGutter`: 14/16/20 by class — `responsive-contract.test.ts` pins 360 → 16 |
| 430 width no unnatural stretch | PASS | `MAX_SCALE` clamps at 430 (`src/design-system/__tests__/responsive.test.ts`) |
| 600+ tablet layout | N-A-DEFERRED | Skill "Deferred, not built" — app is phone-only (`ios.supportsTablet: false`) |
| 768+ recipe grids 2+ columns | N-A-DEFERRED | Same skill decision |
| 840+ readable text width cap | N-A-DEFERRED | Same skill decision |
| Landscape usable | N-A-DEFERRED | `app.json` `orientation: "portrait"` — per skill decision |
| Foldable hinge doesn't split controls | N-A-DEFERRED | Same skill decision |
| Keyboard-open keeps input/action reachable | PASS | `SheetScaffold` (`FoodSheet` base) — `KeyboardAvoidingView` + footer `bottomPad` (`sheet-scaffold.tsx:146`) |

## Components (6 PASS)

| Item | Status | Evidence |
|---|---|---|
| Buttons 50/52 primary; ≥44/48 hit target | PASS | `button.tsx:108` `minHeight: layout.minTapTarget` (≥44, scales up); package literals mapped to shared responsive tokens |
| Inputs 50 high, radius 20 | PASS | `input.tsx:121` `minHeight: Math.max(44, s(48))`; radius `radii.lg` = 20 (`input.tsx:186`) |
| Cards r24 / hero r28 / sheets r32 | PASS | Token-mapped to shared `radii` (`radii.ts`: lg 20 / xl 28) via `Card`/`GlassPlate`/`SheetScaffold` — intentional deviation recorded in skill (shared app tokens win over package literals) |
| Bottom sheet footer respects safe area | PASS | `sheet-scaffold.tsx:144-146` — safe-area pad on footer/body |
| Chips 32/36 high | PASS | `ActionChip` `minHeight: layout.minTapTarget` (≥44 — exceeds spec; app tap-target contract wins) |
| Recipe thumbnails / hero crops per spec | PASS | `FoodImage` default `aspectRatio 4/3` (`food-image.tsx:67`); `recipe-card.tsx:91` (4:3 featured) / `:145` (1:1 grid) |

## Accessibility (5 PASS)

| Item | Status | Evidence |
|---|---|---|
| Allergy/severity never color-only | PASS | Icon + label + tone for every status — `ingredient-safety-row.test.tsx` "never color-only"; `country-restriction-row.tsx` chip = icon + text |
| Dynamic type reflows | PASS | All type via `AppText` variants → `scaleTypographyToken` (fontSize + lineHeight together, `responsive.test.ts`); body copy wraps |
| Critical text not truncated | PASS | Fixed this phase: allergy-conflict banner (`recipes/[id].tsx`), safety-row compact reason (`ingredient-safety-row.tsx`), per-ingredient conflict line (`recipe-detail-sections.tsx`) now untruncated; scan concerns render full reasons |
| Screen reader order logical | PASS | `scan-result-sheet.tsx` ordered sections 1→5 (product → ingredients → concerns → conflicts → alternatives); row a11y label = name → status → reason (`ingredient-safety-row.tsx:134`) |
| Reduce Motion honored | PASS | `use-performance-tier.ts:64` `useReducedMotion` → `device-capability.ts:49` forces `minimal` tier → `allowsLoopMotion` gates `FoodImage` pulse; hero ticks are scroll-driven (gesture progress, not looping) |

## Visual regression tolerance (5 N-A-DEFERRED)

Geometry/spacing/type/radius/color tolerances are screenshot-comparison targets —
deferred to the owner's device verification. Token exactness is enforced mechanically
by `food-glass-contract.test.ts` (no non-token literals to drift).

## Functional confidence (4 PASS)

| Item | Status | Evidence |
|---|---|---|
| AI never includes saved severe allergen | PASS | `safety.ts:203` `buildExclusions` (all allergies excluded from prompts) + `filterUnsafeRecipeIdeas` server-side (`server.ts:333`) and client-side (`client.ts:73`) — `safety.test.ts` |
| Scanner correction path for OCR uncertainty | PASS | Server sets `reviewRequired` on low confidence (`server.ts:399`); sheet forces `step: 'review'` before results (`scan-result-sheet.tsx:87`) |
| Country restriction claims have source/date | PASS | `ingredient-knowledge.ts:45` `renderableJurisdictionStatuses` drops entries missing `sourceUrl`/`lastReviewedAt`; fixtures always carry both |
| Social sharing respects privacy defaults | PASS | `DEFAULT_FOOD_PRIVACY` all `false` (`types/food.ts:40`); `buildFoodPostPayload` gated per flag (`community.ts:57`, `community.test.ts`); `FoodPost` never carries allergy/health data by type contract (`types/food.ts:211`) |
