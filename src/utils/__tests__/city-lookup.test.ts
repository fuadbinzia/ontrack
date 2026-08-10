import {
  formatCitySuggestion,
  isCityLikeFeatureCode,
  normalizeCitySuggestions,
} from '@/utils/city-lookup';

describe('city lookup (Open-Meteo)', () => {
  it('formats city, state, country without street fields', () => {
    expect(
      formatCitySuggestion({
        id: 1,
        name: 'Austin',
        admin1: 'Texas',
        country: 'United States',
      }),
    ).toEqual({
      id: '1',
      label: 'Austin, Texas, United States',
    });
  });

  it('dedupes repeated locality parts', () => {
    expect(
      formatCitySuggestion({
        id: 2,
        name: 'Singapore',
        admin1: 'Singapore',
        country: 'Singapore',
      }),
    ).toEqual({
      id: '2',
      label: 'Singapore',
    });
  });

  it('keeps populated-place, country, and admin feature codes', () => {
    expect(isCityLikeFeatureCode('PPL')).toBe(true);
    expect(isCityLikeFeatureCode('PPLA')).toBe(true);
    expect(isCityLikeFeatureCode('PCLI')).toBe(true);
    expect(isCityLikeFeatureCode('PCLD')).toBe(true);
    expect(isCityLikeFeatureCode('TERR')).toBe(true);
    expect(isCityLikeFeatureCode('ADM1')).toBe(true);
    expect(isCityLikeFeatureCode('AIRP')).toBe(false);
    expect(isCityLikeFeatureCode('PRK')).toBe(false);
    expect(isCityLikeFeatureCode(undefined)).toBe(true);
  });

  it('normalizes results by population and dedupes labels', () => {
    const results = normalizeCitySuggestions({
      results: [
        {
          id: 1,
          name: 'Austin',
          admin1: 'Texas',
          country: 'United States',
          feature_code: 'PPLA2',
          population: 100,
        },
        {
          id: 2,
          name: 'Austin',
          admin1: 'Texas',
          country: 'United States',
          feature_code: 'PPL',
          population: 900_000,
        },
        {
          id: 3,
          name: 'Austin Airport',
          feature_code: 'AIRP',
          country: 'United States',
        },
      ],
    });
    expect(results).toEqual([
      { id: '2', label: 'Austin, Texas, United States' },
    ]);
  });

  it('keeps countries ahead of same-named towns with no population', () => {
    const results = normalizeCitySuggestions({
      results: [
        {
          id: 2629691,
          name: 'Iceland',
          country: 'Iceland',
          feature_code: 'PCLI',
          population: 353_574,
        },
        {
          id: 5041220,
          name: 'Perth',
          admin1: 'Minnesota',
          country: 'United States',
          feature_code: 'PPL',
        },
        {
          id: 5358873,
          name: 'Iceland',
          admin1: 'California',
          country: 'United States',
          feature_code: 'PPL',
        },
      ],
    });
    expect(results[0]).toEqual({ id: '2629691', label: 'Iceland' });
    expect(results.map((r) => r.label)).toContain('Iceland, California, United States');
  });

  it('ranks international cities by population', () => {
    const results = normalizeCitySuggestions({
      results: [
        {
          id: 10,
          name: 'Perth',
          admin1: 'North Dakota',
          country: 'United States',
          feature_code: 'PPL',
          population: 9,
        },
        {
          id: 2063523,
          name: 'Perth',
          admin1: 'Western Australia',
          country: 'Australia',
          feature_code: 'PPLA',
          population: 2_309_338,
        },
        {
          id: 2640358,
          name: 'Perth',
          admin1: 'Scotland',
          country: 'United Kingdom',
          feature_code: 'PPLA2',
          population: 47_350,
        },
      ],
    });
    expect(results.map((r) => r.label)).toEqual([
      'Perth, Western Australia, Australia',
      'Perth, Scotland, United Kingdom',
      'Perth, North Dakota, United States',
    ]);
  });
});
