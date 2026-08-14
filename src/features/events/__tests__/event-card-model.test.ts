import {
  fightCardBoutCountLabel,
  fightCardBoutBilling,
  fightCardBoutStatusLabel,
  fightCardSectionLabel,
  fightCardWeightClassLabel,
  fighterMetaOrder,
  splitFightCardMatchup,
} from '@/features/events/event-card-model';

describe('event fight-card model', () => {
  it('separates opposing corners for the official left-versus-right card layout', () => {
    expect(splitFightCardMatchup('Fighter Alpha vs Fighter Beta')).toEqual({
      redCorner: 'Fighter Alpha',
      blueCorner: 'Fighter Beta',
    });
  });

  it.each(['V', 'v.', 'VS.', 'versus'])(
    'accepts provider separator %s without shrinking names into one line',
    (separator) => {
      expect(splitFightCardMatchup(`Fighter Alpha ${separator} Fighter Beta`)).toEqual({
        redCorner: 'Fighter Alpha',
        blueCorner: 'Fighter Beta',
      });
    },
  );

  it('preserves an unsplittable or incomplete provider label', () => {
    expect(splitFightCardMatchup('Featured matchup')).toEqual({
      redCorner: 'Featured matchup',
    });
    expect(splitFightCardMatchup('Fighter Alpha vs ')).toEqual({
      redCorner: 'Fighter Alpha vs',
    });
  });

  it('anchors flags to the portrait-facing edge for both fighter corners', () => {
    expect(fighterMetaOrder('left')).toEqual(['flag', 'record']);
    expect(fighterMetaOrder('right')).toEqual(['record', 'flag']);
  });

  it.each([
    [1, '1 Bout'],
    [12, '12 Bouts'],
  ])('title-cases the %i-bout card count', (count, expected) => {
    expect(fightCardBoutCountLabel(count)).toBe(expected);
  });

  it.each([
    ['W Strawweight', "Women's Strawweight"],
    ['W Flyweight', "Women's Flyweight"],
    ["Women's Bantamweight", "Women's Bantamweight"],
    ['Welterweight', 'Welterweight'],
    [undefined, undefined],
  ])('expands persisted provider weight class %s', (label, expected) => {
    expect(fightCardWeightClassLabel(label)).toBe(expected);
  });

  it.each([
    ['main', 'Main'],
    ['prelims', 'Prelims'],
    ['early-prelims', 'Early Prelims'],
  ] as const)('uses compact tab label %s', (section, expected) => {
    expect(fightCardSectionLabel(section)).toBe(expected);
    expect(fightCardSectionLabel(section)).not.toContain('Card');
  });

  it.each([
    ['main', 0, 'Main Event'],
    ['main', 1, 'Co-Main'],
    ['main', 2, undefined],
    ['prelims', 0, undefined],
    ['early-prelims', 0, undefined],
  ] as const)('assigns %s bout %i the billing %s', (section, index, expected) => {
    expect(fightCardBoutBilling(section, index)).toBe(expected);
  });

  it.each([
    ['Scheduled', undefined, undefined, undefined],
    ['In Progress', 2, '3:04', 'Round 2 · 3:04'],
    ['Live', undefined, undefined, 'Live'],
    ['Final', 3, '5:00', 'Final · R3 · 5:00'],
  ] as const)('formats bout status %s without cluttering scheduled rows', (
    status,
    period,
    clock,
    expected,
  ) => {
    expect(fightCardBoutStatusLabel(status, period, clock)).toBe(expected);
  });
});
