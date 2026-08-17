import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('travel map placement interaction', () => {
  it('opens coordinate-aware pinning from a normal country-map tap', () => {
    const countryView = readFileSync(
      join(process.cwd(), 'src/features/travel/map/travel-map-country-view.tsx'),
      'utf8',
    );
    const screen = readFileSync(
      join(process.cwd(), 'src/features/travel/map/travel-map-screen.tsx'),
      'utf8',
    );

    expect(countryView).toContain('onPress={(event) =>');
    expect(countryView).toContain('pinMapTarget');
    expect(countryView).not.toContain('onLongPress=');
    expect(screen).not.toContain('if (!placingTripId || !countryCode) return;');
    expect(screen).toContain('nearestAtlasCity(');
    expect(screen).toContain('setDraftCoordinate(pinCoordinate)');
    expect(screen).not.toContain('reverseGeocodeAddress');
    expect(screen).toContain('setPinSheetOpen(true)');
    expect(screen).toContain('Tap inside {selectedCountry?.name} to place the pin');
  });
});
