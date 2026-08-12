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
    expect(sheetScaffold).toContain("bodyScrollMode === 'external'");
  });
});
