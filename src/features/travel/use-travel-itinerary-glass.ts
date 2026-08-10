/**
 * Hooks that bind itinerary glass shells / ink to the live artwork tint.
 */

import { useTravelArtworkTint } from '@/features/travel/travel-artwork-tint-context';
import {
  travelItineraryInk,
  travelItineraryMistProps,
  travelItineraryShellProps,
  type TravelItineraryShellOptions,
} from '@/features/travel/travel-surface';
import { useTheme } from '@/hooks/use-theme';

export function useTravelItineraryShellProps(
  options?: TravelItineraryShellOptions,
) {
  const theme = useTheme();
  const { hex } = useTravelArtworkTint();
  return travelItineraryShellProps(theme, hex, options);
}

export function useTravelItineraryMistProps() {
  const { hex } = useTravelArtworkTint();
  return travelItineraryMistProps(hex);
}

export function useTravelItineraryInk(
  role: 'primary' | 'secondary' | 'tertiary' = 'primary',
): string {
  const theme = useTheme();
  const { darkGlass } = useTravelArtworkTint();
  return travelItineraryInk(theme, role, { darkGlass });
}

/** Dark artwork glass (or dark theme) — light glyphs on mist boards. */
export function useTravelItineraryOnGlass(): boolean {
  const theme = useTheme();
  const { darkGlass } = useTravelArtworkTint();
  return theme.name === 'dark' || darkGlass;
}
