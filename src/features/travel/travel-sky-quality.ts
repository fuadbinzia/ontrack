import type { PerformanceTier } from '@/utils/device-capability';
import {
  degradePerformanceTier,
  minPerformanceTier,
  resolvePerformanceTier,
} from '@/utils/device-capability';

/**
 * Itinerary sky fidelity ladder (alias of the app-wide performance tier).
 * Non-`full` devices keep the same live SVG plate, frozen (minimal FX) — never
 * a destination photo still.
 */
export type TravelSkyQuality = PerformanceTier;

/** Paint plan for the itinerary SVG plate (`full` animated vs frozen `minimal`). */
export function paintTravelSkyQuality(
  quality: TravelSkyQuality,
): TravelSkyQuality {
  return quality === 'full' ? 'full' : 'minimal';
}

export type TravelSkyFxPlan = {
  quality: TravelSkyQuality;
  /** Mount loop drivers after settle (false for minimal). */
  liveFx: boolean;
  tilt: boolean;
  twinkle: boolean;
  /** Cap independently twinkling bright stars (rest stay static SVG). */
  twinkleMax: number;
  birds: boolean;
  meteors: boolean;
  satellites: boolean;
  weatherFx: boolean;
  rainDropMax: number;
  auroraMotion: boolean;
  cloudDrift: boolean;
  sunRays: boolean;
  heatFog: boolean;
  ground: boolean;
  /** 0…1 multiplier for dim field star count. */
  dimStarScale: number;
};

export const degradeTravelSkyQuality = degradePerformanceTier;
export const minTravelSkyQuality = minPerformanceTier;
export const resolveTravelSkyCapability = resolvePerformanceTier;

const FULL_FX: TravelSkyFxPlan = {
  quality: 'full',
  liveFx: true,
  tilt: true,
  twinkle: true,
  twinkleMax: 48,
  birds: true,
  meteors: true,
  satellites: true,
  weatherFx: true,
  rainDropMax: 17,
  auroraMotion: true,
  cloudDrift: true,
  sunRays: true,
  heatFog: true,
  ground: true,
  dimStarScale: 1,
};

const MINIMAL_FX: TravelSkyFxPlan = {
  quality: 'minimal',
  liveFx: false,
  tilt: false,
  twinkle: false,
  twinkleMax: 0,
  birds: false,
  meteors: false,
  satellites: false,
  weatherFx: false,
  rainDropMax: 0,
  auroraMotion: false,
  cloudDrift: false,
  sunRays: false,
  heatFog: false,
  ground: true,
  dimStarScale: 0.55,
};

/** Map a quality tier to itinerary sky FX (`full` or frozen `minimal` only). */
export function planTravelSkyFx(quality: TravelSkyQuality): TravelSkyFxPlan {
  return paintTravelSkyQuality(quality) === 'full'
    ? { ...FULL_FX }
    : { ...MINIMAL_FX };
}
