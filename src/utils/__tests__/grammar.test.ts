import { formatCount, formatCountWithVerb } from '../grammar';

describe('English count grammar', () => {
  it.each([
    [0, '0 plants'],
    [1, '1 plant'],
    [2, '2 plants'],
  ])('formats %i with the matching regular noun', (count, expected) => {
    expect(formatCount(count, 'plant')).toBe(expected);
  });

  it('supports irregular plural nouns', () => {
    expect(formatCount(1, 'person', 'people')).toBe('1 person');
    expect(formatCount(2, 'person', 'people')).toBe('2 people');
  });

  it.each([
    [0, '0 things need attention'],
    [1, '1 thing needs attention'],
    [2, '2 things need attention'],
  ])('keeps the noun and verb in agreement for %i', (count, expected) => {
    expect(
      `${formatCountWithVerb(count, 'thing', 'needs', 'need')} attention`,
    ).toBe(expected);
  });
});
