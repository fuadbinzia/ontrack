import { haystackMatchesQuery, normalizeSearchText, searchQueryTerms } from '../search-text';

describe('search text', () => {
  it('strips punctuation and diacritics', () => {
    expect(normalizeSearchText('E-ZPass NY')).toBe('e zpass ny');
    expect(normalizeSearchText('Café')).toBe('cafe');
  });

  it('requires every query term to match the haystack', () => {
    expect(haystackMatchesQuery(['E-ZPass NY Payment'], 'e zpass')).toBe(true);
    expect(haystackMatchesQuery(['E-ZPass NY Payment'], 'groceries')).toBe(false);
    expect(searchQueryTerms('  Milk  Bread ')).toEqual(['milk', 'bread']);
  });

  it('treats an empty query as a match', () => {
    expect(haystackMatchesQuery(['anything'], '   ')).toBe(true);
  });
});
