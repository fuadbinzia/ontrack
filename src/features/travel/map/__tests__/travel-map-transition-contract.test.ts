import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map smooth transition contract', () => {
  it('dives between world and country with an eased crossfade, not a hard swap', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(canvas).toContain('withTiming(1, STAGE_TIMING');
    expect(canvas).toContain('withTiming(0, STAGE_TIMING');
    expect(canvas).toContain('duration: motion.page');
    expect(canvas).toContain('reduceMotion: ReduceMotion.System');
  });

  it('holds the exiting map layer pointer-blind until the dive settles', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(canvas).toContain("pointerEvents={selectedCountry ? 'none' : 'auto'}");
    expect(canvas).toContain("pointerEvents={selectedCountry ? 'auto' : 'none'}");
    // Country content clears only after the exit animation reports finished.
    expect(canvas).toContain('if (finished) runOnJS(setStageCountry)(undefined);');
  });

  it('never mounts or unmounts a stage shell to run the dive (RNGH v3 abort)', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    // Mounting/unmounting GestureDetector-bearing stages mid-transition trips
    // RNGH v3's "more than one child view" native assert (SIGABRT / freeze).
    // Both stages render unconditionally; only inner content swaps.
    expect(canvas).not.toContain('worldMounted');
    expect(canvas).not.toMatch(/\{stageCountry \? \(\s*<Animated\.View/);
    expect(canvas).toContain('country={stageCountry}');
    expect(canvas).toContain('active={Boolean(selectedCountry)}');
    // The parked world layer is display-culled instead of unmounted.
    expect(canvas).toContain("display: countryTransition.value >= 1 ? ('none' as const) : ('flex' as const)");
  });

  it('crossfades portrait globe ↔ landscape flat map instead of a hard swap', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    // Rotation eases between permanently mounted variants. A conditional
    // `landscape ? <Flat /> : <Globe />` swap pops visually and churns the
    // globe's GestureDetector mid-rotation (RNGH v3 abort).
    expect(canvas).not.toMatch(/landscape \? \(\s*<TravelMapWorldFlat/);
    expect(canvas).toContain(
      'orientation.value = withTiming(landscape ? 1 : 0, STAGE_TIMING)',
    );
    expect(canvas).toContain(
      "display: orientation.value >= 1 ? ('none' as const) : ('flex' as const)",
    );
    expect(canvas).toContain(
      "display: orientation.value <= 0 ? ('none' as const) : ('flex' as const)",
    );
    // Only the visible variant takes touches; the fading one is pointer-blind.
    expect(canvas).toContain("pointerEvents={landscape ? 'none' : 'auto'}");
    expect(canvas).toContain("pointerEvents={landscape ? 'auto' : 'none'}");
    // The hidden flat world mounts after the open transition (or instantly on
    // rotation) so it never slows the map open — and it never unmounts after.
    expect(canvas).toContain('deferAfterPageTransition(() => setFlatStagePrepared(true))');
    expect(canvas).toContain('flatStagePrepared || landscape');
  });

  it('veils the stretching relayout while the device rotates', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const settle = read('src/features/travel/map/use-orientation-settle.ts');

    // The OS rotation animation stretches every full-bleed layer; a sky veil
    // with a spinner covers it until dimensions rest (useOrientationSettle).
    expect(screen).toContain(
      'useOrientationSettle(width, height, routeIsActive)',
    );
    expect(screen).toContain('{rotationSettling ? (');
    expect(screen).toContain('<LoadingSpinner');
    // Continuity: the veil is the map's own sky, not a foreign scrim.
    expect(screen).toContain(
      'colors={[TRAVEL_MAP_WORLD_BACKDROP_TOP, TRAVEL_MAP_OCEAN_BOTTOM]}',
    );

    // The veil snaps on (an enter fade would let the stretch show through) and
    // only the reveal eases; it can never trap a tap.
    const veilTag =
      screen.match(/<Animated\.View[^>]*style=\{styles\.rotationVeil\}/)?.[0] ??
      '';
    expect(veilTag).toContain('pointerEvents="none"');
    expect(veilTag).toContain('exiting={fadeExiting()}');
    expect(veilTag).not.toContain('entering=');

    // Raised earliest by physical tilt (gravity axis flips before iOS commits
    // the rotation), then the native rotation event, then the dimension flip.
    expect(settle).toContain('gravityAxis(');
    expect(settle).toContain("'expoDidUpdateDimensions'");
    expect(settle).toContain('ROTATION_PREEMPT_HOLD_MS');
    // Same sensor safety rails as use-tilt-sky-motion: probe the native module
    // before importing, and never load the expo-sensors barrel.
    expect(settle).toContain("requireOptionalNativeModule('ExponentDeviceMotion')");
    expect(settle).toContain('expo-sensors/build/DeviceMotion.js');
    expect(settle).not.toMatch(/await import\(\s*['"]expo-sensors['"]\s*\)/);
  });

  it('fades orientation chrome swaps without replaying them on page open', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');

    // Portrait top chrome and landscape rail crossfade on rotation…
    expect(screen).toContain('entering={chromeSwapEntering}');
    // …but the enter fade only arms after first paint (page-open-rest).
    expect(screen).toContain('chromeSettledRef.current');
    expect(screen).toMatch(
      /chromeSettledRef\.current\s*\? fadeEntering\(\)\s*: undefined/,
    );
  });

  it('keeps the heavy canvas out of chrome re-renders', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');
    const screen = read('src/features/travel/map/travel-map-screen.tsx');

    expect(canvas).toContain('export const TravelMapCanvas = memo(');
    expect(screen).toContain('onCountryPress={openCountry}');
    expect(screen).toContain('onCoordinatePress={placePinAtCoordinate}');
  });

  it('reuses gesture objects instead of rebuilding them every render', () => {
    const countryView = read(
      'src/features/travel/map/travel-map-country-view.tsx',
    );
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(countryView).toMatch(/useMemo\(\s*\(\)\s*=>\s*Gesture\.Pan\(\)/);
    expect(countryView).toMatch(/useMemo\(\s*\(\)\s*=>\s*Gesture\.Pinch\(\)/);
    expect(globe).toMatch(/useMemo\(\s*\(\)\s*=>\s*Gesture\.Pan\(\)/);
    expect(globe).toMatch(/useMemo\(\s*\(\)\s*=>\s*Gesture\.Tap\(\)/);
  });

  it('never attaches SVG Path onPress (Android PathParser / responder abort)', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');
    const flat = read('src/features/travel/map/travel-map-world-flat.tsx');
    const country = read('src/features/travel/map/travel-map-country-view.tsx');
    const pathBlocks = (source: string) => source.match(/<Path[\s\S]*?\/>/g) ?? [];

    expect(globe).toContain('isDrawableSvgPath');
    expect(globe).toContain('travelGlobeCoordinateAtPoint');
    expect(flat).toContain('isDrawableSvgPath');
    expect(flat).toContain('invertTravelCoordinate');
    expect(country).toContain('isDrawableSvgPath(countryDetail.path)');
    for (const block of [
      ...pathBlocks(globe),
      ...pathBlocks(flat),
      ...pathBlocks(country),
    ]) {
      expect(block).not.toContain('onPress');
    }
  });

  it('gives the country map momentum and bounds instead of a free-floating pan', () => {
    const countryView = read(
      'src/features/travel/map/travel-map-country-view.tsx',
    );

    expect(countryView).toContain('withDecay({');
    expect(countryView).toContain('rubberBandEffect: true');
    expect(countryView).toContain('countryZoomTranslateBound(');
    expect(countryView).toContain('pinchFocalTranslate({');
  });

  it('keeps markers crisp on a UI-thread layer outside the zoom transform', () => {
    const countryView = read(
      'src/features/travel/map/travel-map-country-view.tsx',
    );

    expect(countryView).toContain('countryMarkerShift(');
    expect(countryView).toContain('useAnimatedStyle');
  });

  it('enters and exits map overlays with shared presence presets', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const chrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');

    expect(screen).toContain('entering={popoverEntering()}');
    expect(screen).toContain('exiting={fadeExiting()}');
    expect(chrome).toContain('entering={popoverEntering()}');
    expect(chrome).toContain('exiting={fadeExiting()}');
    // Shared tokens only — no ad-hoc one-off fades.
    expect(screen).not.toContain('FadeInDown.duration(');
    expect(chrome).not.toContain('FadeInDown.duration(');
  });

  it('acknowledges every glass icon button press instantly', () => {
    const chrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');

    expect(chrome).toContain(
      "style={({ pressed }) => (pressed ? styles.iconButtonPressed : undefined)}",
    );
  });
});
