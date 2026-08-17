import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map pin faces', () => {
  it('uses the owner avatar instead of a generic pin glyph', () => {
    const pin = read('src/features/travel/map/travel-map-pin-button.tsx');
    expect(pin).toContain('<ProfileAvatar');
    expect(pin).toContain('avatar={primary.avatar}');
    expect(pin).toContain('isSelf={primary.isSelf}');
    expect(pin).toContain('borderColor={primary.color}');
    expect(pin).not.toContain('map-pin');
    expect(pin).not.toContain('colors:');
  });

  it('passes each person onto world and country pins', () => {
    const globe = read('src/features/travel/map/travel-map-world-globe.tsx');
    const flat = read('src/features/travel/map/travel-map-world-flat.tsx');
    const country = read('src/features/travel/map/travel-map-country-view.tsx');
    expect(globe).toContain('people={cluster.people}');
    expect(flat).toContain('people={cluster.people}');
    expect(country).toContain('people={[rendered.person]}');
    expect(globe).not.toContain('colors={cluster.colors}');
    expect(flat).not.toContain('colors={cluster.colors}');
  });
});
