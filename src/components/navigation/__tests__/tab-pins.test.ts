import {
    DEFAULT_NAV_PIN_ORDER,
    DEFAULT_TRACKER_ORDER,
    mergeTrackerSections,
    MORE_TAB_ROUTE,
    NAV_PIN_LIMIT,
    resolveMoreRetapTarget,
    sanitizeTrackerOrder,
    splitTrackerOrder,
} from '../tab-pins';

describe('tab-pins', () => {
  it('defaults In nav to Profile · Calendar · Today · Checklists', () => {
    expect([...DEFAULT_NAV_PIN_ORDER]).toEqual([
      'profile',
      'calendar',
      '(today)',
      'to-do',
    ]);
    expect(DEFAULT_NAV_PIN_ORDER).toHaveLength(NAV_PIN_LIMIT);
  });

  it('sanitizes unknown / duplicate names and appends missing catalog entries', () => {
    expect(
      sanitizeTrackerOrder(['profile', 'nope', 'profile', 'travel']),
    ).toEqual([
      'profile',
      'travel',
      ...DEFAULT_TRACKER_ORDER.filter(
        (name) => name !== 'profile' && name !== 'travel',
      ),
    ]);
  });

  it('splits enabled order into In nav (by pinnedCount) and Others', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      4,
    );
    expect(inNav).toEqual([...DEFAULT_NAV_PIN_ORDER]);
    expect(others[0]).toBe('social');
    expect(mergeTrackerSections(inNav, others)).toEqual({
      trackerOrder: [...DEFAULT_TRACKER_ORDER],
      pinnedCount: 4,
    });
  });

  it('honors a smaller pinnedCount', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      2,
    );
    expect(inNav).toEqual(['profile', 'calendar']);
    expect(others[0]).toBe('(today)');
  });

  it('drops disabled add-ons from both sections', () => {
    const enabled = new Set(['profile', 'calendar', '(today)', 'to-do', 'travel']);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      4,
    );
    expect(inNav).toEqual(['profile', 'calendar', '(today)', 'to-do']);
    expect(others).toEqual(['travel']);
  });

  it('retapping More while on Trackers dismisses to the last pin', () => {
    expect(
      resolveMoreRetapTarget(MORE_TAB_ROUTE, '(today)', 'profile'),
    ).toBe('(today)');
    expect(resolveMoreRetapTarget(MORE_TAB_ROUTE, null, 'profile')).toBe(
      'profile',
    );
    expect(resolveMoreRetapTarget('(today)', '(today)', 'profile')).toBeNull();
    expect(resolveMoreRetapTarget('travel', '(today)', 'profile')).toBeNull();
  });
});
