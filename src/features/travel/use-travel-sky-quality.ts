import {
  useLiveFxReady,
  usePerformanceTier,
} from '@/hooks/use-performance-tier';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import {
  planTravelSkyFx,
  type TravelSkyFxPlan,
} from '@/features/travel/travel-sky-quality';
import { useEffect } from 'react';
import {
  removeRuntimeActivity,
  setRuntimeActivity,
} from '@/features/performance/runtime-activity';

/**
 * Itinerary sky FX plan from the app-wide performance tier.
 * Non-`full` devices paint the same SVG plate with frozen (minimal) FX.
 * Live loop drivers wait for the route settle gate and only run on `full`.
 */
export function useTravelSkyQuality(): TravelSkyFxPlan {
  const active = useRouteIsActive();
  const { tier, allowsSensors, allowsLoopMotion } = usePerformanceTier();
  const base = planTravelSkyFx(tier);
  const liveReady = useLiveFxReady(active && allowsLoopMotion && base.liveFx);
  const live = (on: boolean) => on && liveReady;
  const tilt = active && base.tilt && allowsSensors;
  const liveFx = live(base.liveFx);
  useEffect(() => {
    if (!active) return;
    setRuntimeActivity(
      {
        id: 'visual.travelSky',
        label: 'Travel sky effects',
        category: 'visual',
      },
      {
        status: liveFx || tilt ? 'running' : 'paused',
        detail: tilt
          ? 'Motion sensor and animation'
          : liveFx
            ? 'Animation'
            : 'Static plate',
      },
    );
    return () => removeRuntimeActivity('visual.travelSky');
  }, [active, liveFx, tilt]);
  return {
    ...base,
    tilt,
    liveFx,
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
