import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('travel header sky décor', () => {
  const sky = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-header-sky-decor.tsx'),
    'utf8',
  );
  const night = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-sky-night.tsx'),
    'utf8',
  );
  const day = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-sky-day.tsx'),
    'utf8',
  );
  const weather = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-sky-weather-fx.tsx'),
    'utf8',
  );
  const flourish = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-flight-path-arc.tsx'),
    'utf8',
  );

  it('composes night/day layers from theme + weather condition', () => {
    expect(sky).toContain("theme.name === 'dark'");
    expect(sky).toContain('resolveHeaderSkyCondition');
    expect(sky).toContain('TravelSkyNight');
    expect(sky).toContain('TravelSkyDay');
    expect(sky).toContain('weatherCode');
    expect(sky).toContain('AgentUiIds.travel.chrome.skyDecor');
    expect(night).toContain('PhaseMoon');
    expect(night).toContain('projectStarsToPlate');
    expect(night).toContain('TravelSkyAurora');
    expect(night).toContain('travel-sky-aurora-destinations');
    expect(day).toContain('SoftCloud');
    expect(day).toContain('DaySun');
    expect(day).toContain('cloudCover');
    expect(day).toContain('driftAmp');
    expect(night).toContain('driftAmp');
  });

  it('keeps sun and moon round under plate stretch', () => {
    const plate = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-sky-plate.ts'),
      'utf8',
    );
    const phaseMoon = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-phase-moon.tsx'),
      'utf8',
    );
    expect(plate).toContain('celestialDiscHostStyle');
    expect(plate).toContain('aspectRatio: 1');
    expect(phaseMoon).toContain('celestialDiscHostStyle');
    expect(day).toContain('celestialDiscHostStyle');
  });

  it('renders an itinerary phase moon with always-visible disc and dark-side craters', () => {
    const phaseMoon = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-phase-moon.tsx'),
      'utf8',
    );
    const travelHome = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/travel/index.tsx'),
      'utf8',
    );
    expect(night).toContain('PhaseMoon');
    // Travel home must not paint its own moon — itinerary sky only.
    expect(travelHome).not.toContain('PhaseMoon');
    expect(travelHome).not.toContain('TravelHomePhaseMoon');
    expect(phaseMoon).toContain('moonPhaseShadowPath');
    expect(phaseMoon).toContain('MOON_CRATERS');
    expect(phaseMoon).toContain('MOON_MARIA');
    expect(phaseMoon).toContain('MOON_TYCHO');
    // Bright base under translucent shadow — new moon + dark craters stay visible.
    expect(phaseMoon).not.toContain('if (!litPath) return null');
    expect(phaseMoon).toContain('fillRule');
    // RN SVG ignores rgba alpha in stopColor — use stopOpacity for halos.
    expect(phaseMoon).toContain('stopOpacity');
  });

  it('shows rain streaks and lightning for wet weather', () => {
    expect(weather).toContain('TravelSkyWeatherFx');
    expect(weather).toContain('LightningBolt');
    expect(weather).toContain('RainDrop');
    expect(night).toContain('TravelSkyWeatherFx');
    expect(day).toContain('TravelSkyWeatherFx');
    expect(night).toContain('condition.rain');
    expect(day).toContain('condition.lightning');
  });

  it('animates birds, sun rays, meteors, and destination accents', () => {
    expect(day).toContain('FlyingBird');
    expect(day).toContain('SunRays');
    expect(day).toContain('HeatShimmer');
    expect(day).toContain('FogWisps');
    expect(day).toContain('accents.tropical');
    expect(night).toContain('ShootingStar');
    expect(night).toContain('accents.desert');
  });

  it('drives twinkle and ray shine from device tilt motion', () => {
    expect(sky).toContain('useTiltSkyMotion');
    expect(sky).toContain('useTravelSkyQuality');
    expect(sky).toContain('TravelSkyStaticDestination');
    expect(sky).toContain('onPlateAverageColor');
    const staticDestination = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-sky-static-destination.tsx'),
      'utf8',
    );
    expect(staticDestination).toContain('resolveTravelHomeAtmosphereImage');
    expect(staticDestination).toContain('TravelSkyStaticWash');
    expect(staticDestination).toContain('TravelSkyNight');
    expect(staticDestination).toContain('TravelSkyDay');
    expect(staticDestination).toContain('TravelSkyGround');
    expect(staticDestination).toContain("planTravelSkyFx('minimal')");
    expect(staticDestination).toContain('Ken Burns');
    expect(staticDestination).toContain('contentPosition');
    expect(staticDestination).toContain('topVeil');
    expect(staticDestination).toContain('bottomFade');
    expect(night).toContain('MotionLayer');
    expect(night).toContain('motion.energy');
    expect(night).toContain('TwinklingStar');
    expect(night).toContain('useStarTwinkleClock');
    expect(night).toContain('unitFlash');
    // Cool blue-white stellar fills (not warm cream).
    expect(night).toContain("STAR_FIELD = '#D8E4FF'");
    expect(night).toContain("STAR_BRIGHT = '#EAF1FF'");
    expect(night).not.toContain('#F7F3E8');
    expect(night).not.toContain('#FFF8E8');
    expect(night).not.toContain('PulsingStar');
    // Fabric-safe View twinkles + shared clock — not animated SVG props.
    expect(night).not.toContain('useAnimatedProps');
    expect(day).not.toContain('useAnimatedProps');
    expect(night).not.toContain('Animated.createAnimatedComponent');
    expect(day).not.toContain('Animated.createAnimatedComponent');
    expect(night).toContain('starSeedUnit');
    // Keep flash amplitude readable — do not regress to high rest floor
    // or the over-amped halo bloom pass.
    expect(night).not.toContain('0.78 + flash * peak');
    expect(night).not.toContain('baseOpacity * (0.78');
    expect(night).not.toContain('haloStyle');
    expect(night).not.toContain('haloSize');
    expect(night).toContain('duration: 5800');
    expect(night).toContain('const rest = 0.28');
    expect(night).toContain('staticDimStars');
    expect(night).not.toContain('r * (0.92');
    expect(day).toContain('MotionLayer');
    expect(day).toContain('motion.energy');
    const motion = readFileSync(
      join(process.cwd(), 'src/features/travel/use-tilt-sky-motion.ts'),
      'utf8',
    );
    // Probe native module before import — package barrel fatals on binaries
    // without ExponentPedometer (TestFlight crash on itinerary open).
    expect(motion).toContain('requireOptionalNativeModule');
    expect(motion).toContain('ExponentDeviceMotion');
    expect(motion).toContain('expo-sensors/build/DeviceMotion');
    expect(motion).toContain('DeviceMotion');
    expect(motion).toContain('useReducedMotion');
    expect(motion).not.toMatch(
      /await import\(\s*['"]expo-sensors['"]\s*\)/,
    );
  });

  it('keeps sun and moon below the status-bar band', () => {
    expect(sky).toContain('statusBandRatio');
    expect(night).toContain('SKY_CELESTIAL_CLEARANCE');
    expect(day).toContain('SKY_CELESTIAL_CLEARANCE');
    expect(night).toContain('statusBand + SKY_CELESTIAL_CLEARANCE');
    expect(day).toContain('statusBand + SKY_CELESTIAL_CLEARANCE');
  });

  it('paints one continuous sky on app-shell chrome (status bar + header)', () => {
    const hero = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-hero.tsx'),
      'utf8',
    );
    const body = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-detail-body.tsx'),
      'utf8',
    );
    const height = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-header-sky-height.ts'),
      'utf8',
    );
    const glass = readFileSync(
      join(process.cwd(), 'src/components/primitives/glass-plate.tsx'),
      'utf8',
    );
    // Single plate from window y=0 — aurora/day washes stay live behind the clock.
    expect(hero).toContain('TravelHeaderSkyDecor');
    expect(hero).toContain('useTravelAtmosphere');
    expect(hero).toContain('weatherCode');
    expect(hero).toContain('useSafeAreaChrome');
    expect(hero).toContain('useSafeAreaChromeOverlay');
    expect(hero).toContain('headerSkyChromeColor');
    expect(hero).toContain('resolveAtmosphereHeaderInk');
    expect(hero).toContain('atmosphereHeaderInkColors');
    expect(hero).toContain('statusBandRatio');
    expect(hero).toContain('TRAVEL_HEADER_SKY_FADE_TAIL');
    expect(hero).toContain('TRAVEL_HEADER_DATES_SKY_OVERLAP');
    expect(hero).toContain('priority: 1');
    expect(hero).not.toContain('skyOnHeader');
    expect(hero.match(/<TravelHeaderSkyDecor/g)).toHaveLength(1);
    expect(body).toContain('transparentScreen');
    expect(body).toContain('travelPlanSkyPageWashStyle');
    expect(body).toContain('resolveHeaderSkyWashTop');
    expect(height).toContain('travelPlanSkyPageWashStyle');
    // Flight-path flourish is itinerary-hero-only (no nested sky décor).
    expect(flourish).toContain('TravelFlightPathArc');
    expect(flourish).not.toContain('TravelHeaderSkyDecor');
    expect(flourish).not.toContain('skyBehind');
    expect(hero).toContain('TravelHeaderFlourish');
    expect(sky).toContain('StyleSheet.absoluteFill');
    // Soft horizon — sky art dissolves into theme paper just below the dates.
    expect(sky).toContain('LinearGradient');
    expect(sky).toContain('bottomFade');
    expect(sky).toContain('fadeTo');
    expect(hero).toContain('fadeTo={pageBase}');
    expect(hero).toContain('travelPageBg');
    // Location ground band (trees / town / city) under celestial art.
    expect(sky).toContain('TravelSkyGround');
    expect(sky).toContain('resolveTravelSkyGroundKind');
    // Constrained tiers only: destination still; capable devices keep live SVG.
    expect(sky).toContain('TravelSkyStaticDestination');
    expect(sky).toContain('preferDestinationStill');
    expect(sky).toContain("quality === 'static' || quality === 'minimal'");
    expect(sky).not.toContain('matchCuratedAtmosphereForPlace');
    expect(hero).toContain('onPlateAverageColor');
    expect(hero).toContain('plateAverageColor');
    expect(hero).toContain('curatedTone');
    // Sky chrome controls: airy frost + ink glyphs (not opaque clear discs).
    expect(hero).toContain('TravelHeroGlassIconButton');
    expect(hero).toContain('travelHomeTokens.colors.ink');
    expect(hero).toContain('circleFabShadow');
    expect(hero).toMatch(
      /TravelHeroGlassIconButton[\s\S]*?<TravelHomeGlass[\s\S]*?\bairy\b/,
    );
    expect(hero).not.toMatch(
      /TravelHeroGlassIconButton[\s\S]*?<TravelHomeGlass[\s\S]*?\bclear\b/,
    );
    expect(glass).toContain('airy?: boolean');
    expect(glass).toContain('androidTintLightAiry');
  });
});

describe('safe-area chrome overlay', () => {
  it('exposes an independent overlay layer for status-bar art', () => {
    const chrome = readFileSync(
      join(process.cwd(), 'src/components/primitives/safe-area-chrome.tsx'),
      'utf8',
    );
    const appSafe = readFileSync(
      join(process.cwd(), 'src/components/primitives/app-safe-area.tsx'),
      'utf8',
    );
    expect(chrome).toContain('useSafeAreaChromeOverlay');
    expect(appSafe).toContain('useSafeAreaChromeOverlayLayer');
    expect(appSafe).toContain('chromeOverlay');
    // Fabric: Image + overlay hosts stay mounted (opacity), never remount siblings.
    expect(appSafe).toContain('collapsable={false}');
    expect(appSafe).toContain('lastImageRef');
    expect(appSafe).not.toContain('{chromeImage ? (');
    expect(appSafe).not.toContain('{chromeOverlay ? (');
  });

  it('keeps entrance hero sky mounted so the plate fills during push', () => {
    const hero = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-hero.tsx'),
      'utf8',
    );
    const detail = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-detail.tsx'),
      'utf8',
    );
    expect(hero).toContain('enableSkyDecor');
    expect(hero).toContain('TravelHeaderSkyDecor');
    expect(detail).toContain('TravelPlanDetailEntrance');
    expect(detail).toContain('deferAfterPageTransition');
    // Solid chrome-only entrance left Android day washes empty.
    expect(detail).not.toContain('enableSkyDecor={false}');
    expect(hero).not.toContain('skyFxOpacity');
    expect(hero).not.toContain('deferUntilIdle');
  });
});
