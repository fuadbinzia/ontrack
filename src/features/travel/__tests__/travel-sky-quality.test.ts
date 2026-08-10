import {
  degradeTravelSkyQuality,
  minTravelSkyQuality,
  paintTravelSkyQuality,
  planTravelSkyFx,
  resolveTravelSkyCapability,
} from '@/features/travel/travel-sky-quality';

describe('resolveTravelSkyCapability', () => {
  it('keeps simulators on full so agent-ui can exercise the live plate', () => {
    expect(
      resolveTravelSkyCapability({
        isDevice: false,
        deviceYearClass: 2015,
        totalMemory: 1 * 1024 ** 3,
      }),
    ).toBe('full');
  });

  it('honors Reduce Motion with a static SVG (no loops) tier', () => {
    expect(
      resolveTravelSkyCapability({
        isDevice: true,
        reduceMotion: true,
        deviceYearClass: 2024,
        totalMemory: 8 * 1024 ** 3,
      }),
    ).toBe('minimal');
  });

  it('maps low RAM / old year-class down to static (frozen SVG paint)', () => {
    expect(
      resolveTravelSkyCapability({
        isDevice: true,
        deviceYearClass: 2015,
        totalMemory: 2 * 1024 ** 3,
      }),
    ).toBe('static');
  });

  it('paints frozen minimal SVG for every non-full tier', () => {
    expect(paintTravelSkyQuality('full')).toBe('full');
    expect(paintTravelSkyQuality('reduced')).toBe('minimal');
    expect(paintTravelSkyQuality('minimal')).toBe('minimal');
    expect(paintTravelSkyQuality('static')).toBe('minimal');
  });

  it('maps mid devices to reduced motion budgets', () => {
    expect(
      resolveTravelSkyCapability({
        isDevice: true,
        deviceYearClass: 2020,
        totalMemory: 4 * 1024 ** 3,
        platformOs: 'ios',
      }),
    ).toBe('reduced');
  });
});

describe('planTravelSkyFx', () => {
  it('collapses every non-full tier onto frozen minimal SVG', () => {
    for (const tier of ['reduced', 'minimal', 'static'] as const) {
      const plan = planTravelSkyFx(tier);
      expect(plan).toEqual(planTravelSkyFx('minimal'));
      expect(plan.liveFx).toBe(false);
      expect(plan.ground).toBe(true);
      expect(plan.birds).toBe(false);
    }
  });

  it('keeps the full live budget only on full', () => {
    const plan = planTravelSkyFx('full');
    expect(plan.liveFx).toBe(true);
    expect(plan.twinkleMax).toBe(48);
    expect(plan.birds).toBe(true);
    expect(plan.meteors).toBe(true);
  });
});

describe('degrade helpers', () => {
  it('steps full → reduced → minimal → static', () => {
    expect(degradeTravelSkyQuality('full')).toBe('reduced');
    expect(degradeTravelSkyQuality('reduced')).toBe('minimal');
    expect(degradeTravelSkyQuality('minimal')).toBe('static');
    expect(degradeTravelSkyQuality('static')).toBe('static');
  });

  it('picks the weaker of two tiers', () => {
    expect(minTravelSkyQuality('full', 'minimal')).toBe('minimal');
    expect(minTravelSkyQuality('static', 'reduced')).toBe('static');
  });
});
