import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map globe motion contract', () => {
  it('centers the initial globe on device location without overriding interaction', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(screen).toContain('getCurrentDeviceCoordinate()');
    expect(screen).toContain('initialGlobeCoordinate={initialGlobeCoordinate}');
    expect(canvas).toContain('if (!initialGlobeCoordinate || !worldAutoRotate) return;');
    expect(canvas).toContain('travelGlobeRotationForCoordinate(');
  });

  it('keeps the current globe rotation when a country view replaces the globe', () => {
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(canvas).toContain(
      'const [worldRotation, setWorldRotation] = useState<TravelGlobeRotation>',
    );
    expect(canvas).toContain('rotation={worldRotation}');
    expect(canvas).toContain('onRotationChange={setWorldRotation}');
    expect(globe).toContain('rotation: TravelGlobeRotation;');
    expect(globe).not.toContain('useState<TravelGlobeRotation>');
  });

  it('persists normalized drag and idle rotation updates before the globe remounts', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(globe).toContain('rotationRef.current = normalized;');
    expect(globe).toContain('onRotationChange(normalized);');
    expect(globe).toContain('rotationRef.current = rotation;');
  });

  it('pauses for the country picker and the parked world behind a country dive', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(screen).toContain('worldMotionPaused={countryPickerOpen}');
    expect(canvas).toContain(
      'worldAutoRotate && !worldMotionPaused && !selectedCountry && !landscape',
    );
  });

  it('skips rotation commits for zero-translation taps so country dives stay cheap', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(globe).toContain('if (translationX !== 0 || translationY !== 0) {');
  });

  it('keeps the projection off the open critical path', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    // The pre-layout 1×1 frame must not project every visible country.
    expect(globe).toContain('layout.width > 1 && layout.height > 1');
    expect(globe).toContain('EMPTY_TRAVEL_GLOBE_SNAPSHOT');
    // First paint ships coarse motion geometry; the fine rest pass defers
    // until after the open transition (idle spin re-renders coarse anyway).
    expect(globe).toContain(
      "dragging || spinning || !warmedUp ? 'motion' : 'rest'",
    );
    expect(globe).toContain(
      'deferAfterPageTransition(() => setWarmedUp(true))',
    );
  });

  it('drives idle spin from frame deltas, never stepped timers', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(globe).not.toContain('setInterval(');
    expect(globe).toContain('requestAnimationFrame(tick)');
    expect(globe).toContain('IDLE_SPIN_DEGREES_PER_SECOND');
  });

  it('batches drag updates to one rotation commit per frame without dropping the release', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(globe).toContain('pendingDragRef');
    expect(globe).toContain('requestAnimationFrame(flushPendingDrag)');
    expect(globe).not.toContain('Date.now() - lastGestureFrameRef');
    // Final gesture position always lands, even mid-frame.
    expect(globe).toContain(
      'commitRotation(rotationForDrag(translationX, translationY));',
    );
  });

  it('renders coarser paths while moving or before the first-paint warm-up', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(globe).toContain(
      "dragging || spinning || !warmedUp ? 'motion' : 'rest'",
    );
  });
});
