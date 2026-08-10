import { sectionDefaultExpanded } from '@/features/travel/travel-plan-detail-sections';

describe('sectionDefaultExpanded', () => {
  const withItems = {
    flights: 2,
    ground: 1,
    stays: 1,
    rentals: 0,
    events: 1,
  };
  const empty = { flights: 0, ground: 0, stays: 0, rentals: 0, events: 0 };

  it('opens transport + timeline; keeps tools and nested kinds collapsed', () => {
    expect(sectionDefaultExpanded('tools', withItems)).toBe(false);
    expect(sectionDefaultExpanded('transport', withItems)).toBe(true);
    expect(sectionDefaultExpanded('timeline', withItems)).toBe(true);
    expect(sectionDefaultExpanded('flights', withItems)).toBe(false);
    expect(sectionDefaultExpanded('ground', withItems)).toBe(false);
    expect(sectionDefaultExpanded('stays', withItems)).toBe(false);
    expect(sectionDefaultExpanded('rentals', withItems)).toBe(false);
    expect(sectionDefaultExpanded('events', withItems)).toBe(false);
  });

  it('keeps transport collapsed when the trip has no booking rows', () => {
    expect(sectionDefaultExpanded('transport', empty)).toBe(false);
    expect(sectionDefaultExpanded('timeline', empty)).toBe(true);
    expect(sectionDefaultExpanded('tools', empty)).toBe(false);
  });
});
