import {
  formatAddressSuggestion,
  normalizeAddressSuggestions,
} from '../address-lookup';

describe('address lookup', () => {
  it('formats street addresses with locality secondary line', () => {
    expect(
      formatAddressSuggestion({
        osm_id: 1,
        osm_type: 'W',
        name: 'Centerhotel Midgardur',
        housenumber: '120',
        street: 'Laugavegur',
        postcode: '105',
        city: 'Reykjavik',
        country: 'Iceland',
        countrycode: 'is',
      }, [-21.9426, 64.1466]),
    ).toEqual({
      id: 'W:1:Centerhotel Midgardur, 120 Laugavegur',
      label: 'Centerhotel Midgardur, 120 Laugavegur',
      secondary: '105, Reykjavik, Iceland',
      countryName: 'Iceland',
      countryCode: 'IS',
      latitude: 64.1466,
      longitude: -21.9426,
    });
  });

  it('falls back to place name when street is missing', () => {
    expect(
      formatAddressSuggestion({
        osm_id: 2,
        osm_type: 'N',
        name: 'Reykjavik',
        country: 'Iceland',
      }),
    ).toEqual({
      id: 'N:2:Reykjavik',
      label: 'Reykjavik',
      secondary: 'Iceland',
      countryName: 'Iceland',
    });
  });

  it('normalizes Photon features and dedupes labels', () => {
    const results = normalizeAddressSuggestions({
      features: [
        {
          properties: {
            osm_id: 1,
            osm_type: 'W',
            street: 'Main Street',
            housenumber: '10',
            city: 'Boston',
            state: 'Massachusetts',
            country: 'United States',
          },
        },
        {
          properties: {
            osm_id: 2,
            osm_type: 'W',
            street: 'Main Street',
            housenumber: '10',
            city: 'Boston',
            state: 'Massachusetts',
            country: 'United States',
          },
        },
        { properties: {} },
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('10 Main Street');
    expect(results[0]?.secondary).toBe('Boston, Massachusetts, United States');
    expect(results[0]?.countryName).toBe('United States');
  });
});
