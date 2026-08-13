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

  it('pauses for the country picker and resumes from the existing auto-rotate state', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(screen).toContain('worldMotionPaused={countryPickerOpen}');
    expect(canvas).toContain(
      'autoRotate={worldAutoRotate && !worldMotionPaused}',
    );
  });
});
