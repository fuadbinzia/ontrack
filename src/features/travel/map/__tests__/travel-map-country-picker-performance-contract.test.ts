import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map country picker performance contract', () => {
  it('virtualizes country rows in a bounded sheet body', () => {
    const countryPicker = read(
      'src/features/travel/map/travel-map-country-picker.tsx',
    );
    const sheetScaffold = read(
      'src/components/primitives/sheet-scaffold.tsx',
    );

    expect(countryPicker).toContain("import { FlashList");
    expect(countryPicker).toContain('bodyScrollMode="external"');
    expect(countryPicker).not.toContain('countries.map(');
    expect(countryPicker).not.toContain('.slice(0, 80)');
    expect(sheetScaffold).toContain("bodyScrollMode === 'external'");
  });

  it('does not pass FlashList v1 estimatedItemSize on map lists', () => {
    const countryPicker = read(
      'src/features/travel/map/travel-map-country-picker.tsx',
    );
    const cityPicker = read('src/features/travel/map/travel-map-city-picker.tsx');
    const mapChrome = read(
      'src/features/travel/map/travel-map-screen-chrome.tsx',
    );

    expect(countryPicker).not.toContain('estimatedItemSize');
    expect(cityPicker).not.toContain('estimatedItemSize');
    expect(mapChrome).toContain("import { FlashList");
    expect(mapChrome).not.toContain('estimatedItemSize');
  });
});
