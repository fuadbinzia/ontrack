import type { TextStyle } from 'react-native';

import { travelHomeFontFamily } from '@/features/travel/travel-home-tokens';

/**
 * Design-system overlines force uppercase. Travel chrome uses Title Case instead.
 */
export const travelOverlineStyle: TextStyle = { textTransform: 'none' };

/**
 * Travel editorial face — same as trip-card / plan-hero destination titles
 * (Times New Roman on iOS). Use for itinerary chrome so the whole page matches.
 */
export const travelEditorialTextStyle: TextStyle = {
  fontFamily: travelHomeFontFamily,
};

/**
 * Horizontal gap between a leading icon/logo and its title — matches the
 * itinerary mock (backpack / plane flush-but-breathing next to the label).
 * Scale with `s()` / `useResponsive().spacing.sm` at call sites.
 */
export const TRAVEL_TITLE_ICON_GAP = 8;

export function titleCaseTravelKind(kind: string): string {
  if (!kind) return kind;
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}
