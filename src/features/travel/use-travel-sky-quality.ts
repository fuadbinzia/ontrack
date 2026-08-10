import {
  useLiveFxReady,
  usePerformanceTier,
} from '@/hooks/use-performance-tier';
import {
  planTravelSkyFx,
  type TravelSkyFxPlan,
} from '@/features/travel/travel-sky-quality';

/**
 * Itinerary sky FX plan from the app-wide performance tier.
 * Non-`full` devices paint the same SVG plate with frozen (minimal) FX.
 * Live loop drivers wait for the route settle gate and only run on `full`.
 */
export function useTravelSkyQuality(): TravelSkyFxPlan {
  const { tier, allowsSensors, allowsLoopMotion } = usePerformanceTier();
  const base = planTravelSkyFx(tier);
  const liveReady = useLiveFxReady(allowsLoopMotion && base.liveFx);
  const live = (on: boolean) => on && liveReady;
  return {
    ...base,
    tilt: base.tilt && allowsSensors,
    liveFx: live(base.liveFx),
    auroraMotion: live(base.auroraMotion),
    cloudDrift: live(base.cloudDrift),
    twinkle: live(base.twinkle),
    birds: live(base.birds),
    meteors: live(base.meteors),
    satellites: live(base.satellites),
    weatherFx: live(base.weatherFx),
    heatFog: live(base.heatFog),
    sunRays: live(base.sunRays),
  };
}
