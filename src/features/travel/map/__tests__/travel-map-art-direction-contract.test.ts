import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) => readFileSync(
  join(process.cwd(), 'src/features/travel/map', name),
  'utf8',
);

describe('travel map illustrated art direction', () => {
  it('shares the storybook palette and cut-paper treatment in every map mode', () => {
    const countryData = read('country-data.ts');
    const countryMap = read('travel-map-country-view.tsx');
    const flatMap = read('travel-map-world-flat.tsx');
    const globe = read('travel-map-world-globe.tsx');

    expect(countryData).toContain("TRAVEL_MAP_INK = '#164B66'");
    expect(countryData).toContain("'#F3AA9E'");
    expect(countryMap).toContain('countryDetail.path');
    expect(countryMap).toContain('strokeLinejoin="round"');
    expect(flatMap).toContain('key={`shadow-${country.code}`}');
    expect(flatMap).toContain('strokeLinejoin="round"');
    expect(globe).toContain('transform="translate(0 8)"');
    expect(globe).toContain('strokeLinejoin="round"');
    expect(globe).toContain('id="spaceNebula"');
    expect(globe).toContain('id="spaceStars"');
    expect(globe).toContain("TRAVEL_MAP_WORLD_BACKDROP_TOP = '#071426'");
  });
});
