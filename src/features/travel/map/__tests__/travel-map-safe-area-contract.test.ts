import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map safe-area chrome', () => {
  it('continues the active map ocean behind the status bar', () => {
    const mapScreen = read('src/features/travel/map/travel-map-screen.tsx');
    const mapCanvas = read('src/features/travel/map/travel-map-canvas.tsx');
    const worldGlobe = read('src/features/travel/map/travel-map-world-globe.tsx');

    expect(mapScreen).toContain('useSafeAreaChrome(');
    expect(mapScreen).toContain('TRAVEL_MAP_COUNTRY_OCEAN_TOP');
    expect(mapScreen).toContain('TRAVEL_MAP_WORLD_BACKDROP_TOP');
    expect(mapCanvas).toContain('stopColor={TRAVEL_MAP_COUNTRY_OCEAN_TOP}');
    expect(worldGlobe).toContain('stopColor={TRAVEL_MAP_WORLD_BACKDROP_TOP}');
  });
});
