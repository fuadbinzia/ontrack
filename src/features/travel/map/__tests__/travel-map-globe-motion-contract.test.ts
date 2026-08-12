import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map globe motion contract', () => {
  it('pauses for the country picker and resumes from the existing auto-rotate state', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');
    const canvas = read('src/features/travel/map/travel-map-canvas.tsx');

    expect(screen).toContain('worldMotionPaused={countryPickerOpen}');
    expect(canvas).toContain(
      'autoRotate={worldAutoRotate && !worldMotionPaused}',
    );
  });
});
