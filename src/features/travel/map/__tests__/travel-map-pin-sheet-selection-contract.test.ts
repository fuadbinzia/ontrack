import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map pin sheet selection', () => {
  it('collapses search results after choosing a place so Save Pin is reachable', () => {
    const sheet = read('src/features/travel/map/travel-map-pin-sheet.tsx');

    expect(sheet).toContain('setCoordinate({ latitude: result.latitude, longitude: result.longitude })');
    expect(sheet).toContain('setLabel(result.label)');
    expect(sheet).toContain('setQuery(result.label)');
    expect(sheet).toContain('setResults([])');
    expect(sheet).toContain('Keyboard.dismiss()');
  });

  it('does not carry an old search or coordinate into a newly opened sheet', () => {
    const sheet = read('src/features/travel/map/travel-map-pin-sheet.tsx');

    expect(sheet).toContain("setQuery('')");
    expect(sheet).toContain('setResults([])');
    expect(sheet).toContain('setCoordinate(undefined)');
    expect(sheet).toContain("setLabel('')");
  });
});
