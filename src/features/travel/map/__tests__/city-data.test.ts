import { atlasCitiesForCountry, nearestAtlasCity } from '../city-data';

describe('travel atlas city data', () => {
  it('bundles offline populated places by ISO country code', () => {
    expect(atlasCitiesForCountry('IS')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Reykjavík', capital: true }),
        expect.objectContaining({ name: 'Akureyri', capital: false }),
        expect.objectContaining({ name: 'Ísafjörður', capital: false }),
        expect.objectContaining({ name: 'Höfn', capital: false }),
      ]),
    );
    expect(atlasCitiesForCountry('IS').length).toBeGreaterThanOrEqual(8);
    expect(atlasCitiesForCountry('US').length).toBeGreaterThanOrEqual(20);
    expect(atlasCitiesForCountry('AQ')).toEqual([]);
    expect(atlasCitiesForCountry(undefined)).toEqual([]);
  });

  it('finds the closest offline city within the selected country', () => {
    expect(nearestAtlasCity('IS', 65.67, -18.09)?.name).toBe('Akureyri');
    expect(nearestAtlasCity('is', 64.14, -21.93)?.name).toBe('Reykjavík');
    expect(nearestAtlasCity(undefined, 64.14, -21.93)).toBeUndefined();
    expect(nearestAtlasCity('IS', Number.NaN, -21.93)).toBeUndefined();
  });
});
