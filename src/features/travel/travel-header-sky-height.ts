import { StyleSheet, type ViewStyle } from 'react-native';

/**
 * Content-space height of the itinerary sky band (below the status-bar inset).
 * Chrome height = insets.top + this + fade tail — title sits in sky, then a
 * short dissolve ends just below the dates card into theme paper.
 */
export const TRAVEL_HEADER_SKY_CONTENT_BAND = 152;

/**
 * Extra chrome-overlay height below the content band — only enough for the
 * dates card to sit on sky and the wash to finish just underneath it.
 */
export const TRAVEL_HEADER_SKY_FADE_TAIL = 40;

/**
 * Pull the dates glass up into the lower sky so the hero reads as one.
 * 0 = dates sit just below the title band (notes / tools follow).
 */
export const TRAVEL_HEADER_DATES_SKY_OVERLAP = 0;

/**
 * Hero flex gap between the sky title band and the dates card.
 * Page wash must start here (not at the band) so the artwork floor
 * meets the date card instead of leaving a peach strip.
 */
export const TRAVEL_HEADER_DATES_TOP_GAP = 12;

/**
 * Page layer under the sky band. Sky chrome eases into `paper` by `fadeTail`;
 * callers may pass transparent when handing the hero off to scenic artwork.
 */
export function travelPlanSkyPageWashStyle(options: {
  skyContentBand: number;
  washTop: string;
  paper: string;
  fadeTail?: number;
  /** Extra offset below the content band (dates gap − overlap). */
  washOffset?: number;
}): ViewStyle {
  const fadeTail = options.fadeTail ?? TRAVEL_HEADER_SKY_FADE_TAIL;
  const washOffset = Math.max(0, options.washOffset ?? 0);
  return {
    ...StyleSheet.absoluteFill,
    top: options.skyContentBand + washOffset,
    backgroundColor: options.paper,
    experimental_backgroundImage: `linear-gradient(to bottom, ${options.washTop} 0%, ${options.paper} ${fadeTail}px, ${options.paper} 100%)`,
  };
}
