import {
  affinitiesFromUsage,
  isOverviewAffinityRoute,
  overviewAffinityScore,
  sortOverviewRowsByAffinity,
} from '../overview-affinity';

const now = Date.UTC(2026, 7, 15);

function row(routeName: string) {
  return { routeName };
}

describe('overview affinity ranking', () => {
  it('keeps catalog order when nobody has opened a module yet', () => {
    expect(
      sortOverviewRowsByAffinity(
        [row('(today)'), row('travel'), row('to-do'), row('finance')],
        {},
        now,
      ).map((item) => item.routeName),
    ).toEqual(['(today)', 'travel', 'to-do', 'finance']);
  });

  it('puts the most opened recent module first', () => {
    expect(
      sortOverviewRowsByAffinity(
        [row('(today)'), row('travel'), row('to-do')],
        {
          '(today)': { visitCount: 2, lastVisitedAt: now },
          travel: { visitCount: 8, lastVisitedAt: now },
          'to-do': { visitCount: 3, lastVisitedAt: now },
        },
        now,
      ).map((item) => item.routeName),
    ).toEqual(['travel', 'to-do', '(today)']);
  });

  it('lets a recently used module overtake an older favorite', () => {
    const twoWeeksAgo = now - 14 * 86_400_000;
    const ranked = sortOverviewRowsByAffinity(
      [row('travel'), row('finance')],
      {
        travel: { visitCount: 10, lastVisitedAt: twoWeeksAgo },
        finance: { visitCount: 8, lastVisitedAt: now },
      },
      now,
    ).map((item) => item.routeName);

    expect(ranked[0]).toBe('finance');
    expect(overviewAffinityScore({ visitCount: 8, lastVisitedAt: now }, now)).toBeGreaterThan(
      overviewAffinityScore(
        { visitCount: 10, lastVisitedAt: twoWeeksAgo },
        now,
      ),
    );
  });

  it('keeps unused modules in their original relative order under used ones', () => {
    expect(
      sortOverviewRowsByAffinity(
        [row('(today)'), row('travel'), row('to-do'), row('finance'), row('plants')],
        {
          finance: { visitCount: 4, lastVisitedAt: now },
        },
        now,
      ).map((item) => item.routeName),
    ).toEqual(['finance', '(today)', 'travel', 'to-do', 'plants']);
  });

  it('treats equal scores as a stable catalog tie', () => {
    expect(
      sortOverviewRowsByAffinity(
        [row('plants'), row('finance')],
        {
          plants: { visitCount: 2, lastVisitedAt: now },
          finance: { visitCount: 2, lastVisitedAt: now },
        },
        now,
      ).map((item) => item.routeName),
    ).toEqual(['plants', 'finance']);
  });

  it('seeds visit weight from dwell time without inventing finance or auth', () => {
    expect(
      affinitiesFromUsage(
        [
          { surface: 'travel', activeMs: 180_000 },
          { surface: 'checklists', activeMs: 30_000 },
          { surface: 'auth', activeMs: 90_000 },
        ],
        now,
      ),
    ).toEqual({
      travel: { visitCount: 3, lastVisitedAt: now },
      'to-do': { visitCount: 1, lastVisitedAt: now },
    });
  });

  it('only tracks real product modules, not Overview itself', () => {
    expect(isOverviewAffinityRoute('travel')).toBe(true);
    expect(isOverviewAffinityRoute('finance')).toBe(true);
    expect(isOverviewAffinityRoute('overview')).toBe(false);
    expect(isOverviewAffinityRoute('trackers')).toBe(false);
  });
});
