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

  it('keeps populated-place feature codes', () => {
    expect(isCityLikeFeatureCode('PPL')).toBe(true);
    expect(isCityLikeFeatureCode('PPLA')).toBe(true);
    expect(isCityLikeFeatureCode('AIRP')).toBe(false);
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
});
