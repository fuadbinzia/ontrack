# onTrack design-system contract

Consistency wins over feature-specific control styling. Feature themes may change semantic accent colors,
imagery, category colors, and data visualizations; they do not redefine controls or interaction placement.

## Action hierarchy

| Intent | Component | Placement |
|---|---|---|
| Dismiss bottom sheet | `SheetGrabber` via `SheetHeader` / `SheetScaffold` | Centered top swipe pill (tap also dismisses) |
| Dismiss page / full-screen overlay | `IconButton` through `ScreenHeader` `onClose` | Neutral top-right X |
| Back | `HeaderBackButton compact` via `ScreenHeader` `leading` | Overline-sized on the eyebrow row; title + subtitle stay full-bleed left |
| Section rhythm | `SectionHeader flush` | Use inside `Screen`/`View` gaps so margins are not doubled |
| Settings panel | `SettingsGroup` | Frosted glass panel for stacked `SettingsRow` / toggle / action rows |
| Collapsible group | `CollapsibleSection` | Overline + chevron; optional expanded-only `detail` or trailing action |
| Save, create, confirm | `Button variant="primary"` (glass) | Main footer or final form action |
| Secondary action | `Button variant="secondary"` (glass) | After the primary action |
| Low-emphasis inline action | `Button variant="ghost"` | Inline only; never the sheet dismiss action |
| Delete or remove | `Button variant="danger"` / `DestructiveSection` | Separated destructive section |
| Irreversible account/data actions | `DangerZone` + `DestructiveSection flush` | Red-rimmed glass panel |
| Icon-only action | `IconButton` (glass disc) | At least 44pt with label and `testID` |
| Icon wells / meta chips | `GlassIconWell` / `GlassTonePill` / `GlassMetaChip` | Mist frost — never `accentFaint` / sunken paper |
| Settings toggles | `GlassSwitch` (via `SettingsToggleRow`) | Fill-only frost track + thumb |

Irreversible actions must call `confirmDestructiveAction`. Its Cancel action is represented by the prompt’s
top-right X; it is not rendered as a second full-width button.

## Intuitive path

- Every screen has one visually dominant next step. Equal-weight action walls are grouped by user intent.
- Primary actions use concise labels that describe the destination or result (`Trip Itinerary`, `Create Trip`, `Save`).
- Tappable cards include a directional affordance; icon-only controls are reserved for familiar chrome.
- Related actions stay together and use the same order across empty, populated, and editing states.
- The interface responds immediately with pressed state and haptics, then shows shared loading or error UI.
- Helpful defaults and nearby field errors replace instructions users would otherwise have to remember.
- Navigation preserves context. Back returns to the previous task; sheet grabber / page X dismisses without implying navigation.
- Color adds recognition and feature identity, but meaning never depends on color alone.

## Composition

- Routes start with `Screen`; standard titles use `ScreenHeader`.
- Modal sheets use `SheetScaffold`; do not create feature-specific sheet frames.
- Forms group related fields with `FormSection`, use `Input` / `DateField` / `TimeField`, and use
  `SegmentedControl` for compact exclusive choices.
- **Glass UI:** product chrome uses `GlassPlate` / `Card` (prefer `airy` on atmosphere), `SettingsGroup`,
  mist wells/chips, and glass fields. Do not paint cards/rows with `backgroundElevated` /
  `backgroundSunken` / `accentFaint`. See `.cursor/rules/glass-ui.mdc`.
- Surfaces use `Card` (glass default); loading, empty, and error states use `LoadingBlock`, `EmptyState`,
  and `ErrorMessage`.
- Status pills use `StatusBadge` → `GlassTonePill` (success / warning / danger / neutral). Diagnostic
  label/value rows use `MetaList`. Sort+action bands use `ToolbarRow`. Compact secondary actions use
  `ActionChip` / `ActionChipRow`. Overlay selects use `Dropdown` (never push layout).
- **Title Case:** field labels use `StackedFieldLabel` / `fieldTitleCase`; in-card panel titles use
  `PanelTitle`. `ScreenHeader`, `SectionHeader`, `FormSection`, `Button`, `GlassPrimaryAction`,
  `ActionChip`, and prompt actions title-case their labels automatically.
  Do not hand-capitalize chrome titles or button labels in feature code.
- UI text uses `AppText` on the UI face. Chrome is single-line with `fit`; body copy may wrap.
  Reserve `variant="mono"` for the design-system Type gallery — product screens do not use mono.
- Colors come from `useTheme()`. Spacing, control sizes, and type come from `useResponsive()` or primitives.
- Every interactive control has an `ontrack.*` `testID` registered in `AgentUiIds` and documented in the UI map.

## Exceptions

Custom drawing, maps, destination photography, workout anatomy, and game canvases may use domain-specific
visual values internally. Their headers, forms, buttons, prompts, sheets, loading states, and errors still use
the shared system.

## Gallery

Dev-only route `/design-system` (Developer Tools → Design System).

| Tab | What it’s for |
|---|---|
| **Elements** | Full list of shared building blocks, grouped by job. Tap a row → jump to its demo. |
| **Demos** | Live playground (layout, glass, buttons, forms, settings). |
| **Colors** | Theme accents and history |
| **Type** | Font presets and type scale |
| **Icons** | Semantic `appIcons` catalog |

Mental model: **browse → try → tune foundations**.

Source of truth for the element list: `src/features/design-system/design-system-catalog.ts`.
