import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map orientation contract', () => {
  it('keeps every atlas modal in the atlas current orientation', () => {
    const mapScreen = read('src/features/travel/map/travel-map-screen.tsx');
    const mapChrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');
    const peoplePicker = read('src/features/social/people-picker.tsx');
    const countryPicker = read('src/features/travel/map/travel-map-country-picker.tsx');
    const cityPicker = read('src/features/travel/map/travel-map-city-picker.tsx');
    const pinSheet = read('src/features/travel/map/travel-map-pin-sheet.tsx');
    const travelSheet = read('src/features/travel/travel-sheet.tsx');
    const sheetScaffold = read('src/components/primitives/sheet-scaffold.tsx');
    const dropdown = read('src/components/primitives/dropdown.tsx');

    expect(mapScreen).toContain("? ['landscape-left', 'landscape-right']");
    expect(mapScreen.match(/supportedOrientations={atlasModalOrientations}/g)).toHaveLength(4);
    expect(mapChrome).toContain('supportedOrientations={supportedOrientations}');
    expect(peoplePicker).toContain('supportedOrientations={supportedOrientations}');
    expect(countryPicker).toContain('supportedOrientations={supportedOrientations}');
    expect(cityPicker).toContain('supportedOrientations={supportedOrientations}');
    expect(pinSheet.match(/supportedOrientations={supportedOrientations}/g)).toHaveLength(2);
    expect(travelSheet).toContain('supportedOrientations={supportedOrientations}');
    expect(sheetScaffold).toContain('supportedOrientations={supportedOrientations}');
    expect(dropdown).toContain('supportedOrientations={supportedOrientations}');
  });
});
