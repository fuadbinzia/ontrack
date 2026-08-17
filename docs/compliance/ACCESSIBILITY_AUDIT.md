# Accessibility audit

**Status:** DRAFT — REQUIRES MANUAL TESTING  
**As of:** 17 August 2026

## TECHNICALLY VERIFIED / FIXED

- Reduced motion is respected in chrome motion (`GlassSwitch`, presence presets, travel sky gating via `usePerformanceTier`).
- `AppText` allows font scaling. Body cap is **2.0×**; `fit` chrome cap is **1.35×** (`app-text.tsx`). Inputs / duration fields use 2.0×.
- Unjustified `allowFontScaling={false}` removed from app-prompt actions, workouts header, stay-provider title. Avatar initials remain fixed (product rule).
- `SettingsToggleRow` exposes `accessibilityRole="switch"` and `checked` / `disabled` (`settings-row.tsx`). Nested `GlassSwitch` is not a second a11y node.
- `ProgressRing` has an accessible name and percent value.
- Disabled `Button` / `IconButton` opacity is ≥ 0.5 so the control stays visible.
- Contract tests: `src/components/primitives/__tests__/a11y-contract.test.tsx`, `app-text-dynamic-type.test.ts`.

## PARTIALLY IMPLEMENTED

- Most feature `Pressable`s already ship `accessibilityLabel` / `ontrack.*` testIDs (prior audit ~97%). Not re-counted in this pass.
- Dynamic Type at 2× will still clip some dense travel boards — **REQUIRES MANUAL TESTING**.
- Android TalkBack on glass/blur plates — **REQUIRES MANUAL TESTING**.

## NOT a WCAG / ADA certification

No third-party audit. Do not claim conformance.
