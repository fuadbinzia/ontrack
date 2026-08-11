import { usePageSurfaceBackground } from '@/components/primitives';

export const TRAVEL_HOME_ATMOSPHERE = require('../../../assets/images/travel/header-atmosphere-v2.png');
/** Dark-mode header wash — Iceland northern lights (not trip-card hero imagery). */
export const TRAVEL_HOME_ATMOSPHERE_NIGHT = require('../../../assets/images/travel/header-atmosphere-iceland-aurora.png');
/** Fixed Travel landing atmosphere — playful illustrated atlas, not trip imagery. */
export const TRAVEL_HOME_MAP_BACKGROUND = require('../../../assets/images/travel/travel-home-map-full-v2.png');
export const TRAVEL_HOME_MAP_SKY_COLOR = '#8ED4E8';
export const TRAVEL_HOME_MAP_AVERAGE_COLOR = '#55B7D8';

type TravelHomeBackgroundProps = {
  enabled: boolean;
  /** Retained for the shared empty/populated landing composition. */
  empty?: boolean;
};

/**
 * Full window-space height for the landing map, including the status bar.
 */
export function travelHomeAtmosphereHeight(
  windowHeight: number,
  _topInset: number,
  _options?: { empty?: boolean },
): number {
  return Math.round(windowHeight);
}

/** Day mountain wash or Iceland aurora — same geometry either theme. */
export function travelHomeAtmosphereSource(themeName: string) {
  return themeName === 'dark' ? TRAVEL_HOME_ATMOSPHERE_NIGHT : TRAVEL_HOME_ATMOSPHERE;
}

/**
 * Publishes the map's ocean color to shell chrome. The map itself is painted
 * once on AppSafeArea via `useSafeAreaChrome`, full-bleed behind this screen.
 */
export function TravelHomeBackground({
  enabled: _enabled,
  empty: _empty = false,
}: TravelHomeBackgroundProps) {
  usePageSurfaceBackground(TRAVEL_HOME_MAP_SKY_COLOR, { priority: 1 });
  return null;
}
