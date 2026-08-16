---
name: smooth-transitions
description: >-
  Make smooth, beautiful transitions a core UX principle — pages, sheets,
  add/remove, open/close. Use when building or polishing navigation, sheets,
  lists, menus, or when the user says transitions, make it smooth, pages snap,
  or motion.
---

# Smooth transitions

**Bar:** every open, close, add, remove, and page change should feel continuous. Users should never see chrome pop in or vanish.

Always-on contract: Development `.cursor/rules/smooth-transitions.mdc`. Ambition: `think-cool`.

## onTrack shared language

Prefer these over ad-hoc `FadeInDown.duration(n)`:

| Role | Use |
|---|---|
| List/card add/remove | `Presence` + `useListEnterIds` — enter only just-added ids |
| Item reflow | `useSettledListLayout` — never `LinearTransition` on first paint |
| Menu / suggestion popover | `popoverEntering` / `popoverExiting` |
| Crossfade | `fadeEntering` / `fadeExiting` |
| Sheet open/close | `useSheetDismissPan` (`held` through exit, `pointerEvents="none"` while settling) |
| Stack push/pop | `AppStack` + `motion.page` |
| Tokens | `durations` / `easings` / `springs` / `motion` in `@/design-system` |

## Checklist

- [ ] Open and close use the same eased language
- [ ] Page open stays at rest — no FadeInDown / focus replay on existing content
- [ ] Added rows enter; removed rows exit; neighbors reflow
- [ ] Gesture-linked progress when a finger is driving the change
- [ ] Exit hosts stay mounted with `pointerEvents="none"` — never trap the next tap
- [ ] Reduced motion skips travel and lands on the final state
- [ ] Motion does not steal hits, scroll, or keyboard

## Never

- Snap-unmount a visible sheet, menu, or row
- Invent a one-off fade when a presence preset fits
- Disable the primary action to play an entrance
- Remount-by-key or focus-replay FadeInDown when a page opens
- Remount-by-key or focus-replay FadeInDown when a page opens
