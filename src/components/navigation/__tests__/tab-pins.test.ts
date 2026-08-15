import {
  DEFAULT_NAV_PIN_ORDER,
  DEFAULT_TRACKER_ORDER,
  mergeTrackerSections,
  MORE_TAB_ROUTE,
  NAV_PIN_LIMIT,
  promoteMoreSelection,
  resolveMoreRetapTarget,
  sanitizeTrackerOrder,
  splitTrackerOrder,
} from '../tab-pins';

describe('tab-pins', () => {
  it('defaults In nav to Today · Checklists · Calendar', () => {
    expect([...DEFAULT_NAV_PIN_ORDER]).toEqual([
      '(today)',
      'to-do',
      'calendar',
    ]);
    expect(DEFAULT_NAV_PIN_ORDER.length).toBeLessThanOrEqual(NAV_PIN_LIMIT);
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

  it('keeps a persisted order that puts Overview later', () => {
    expect(
      sanitizeTrackerOrder(['calendar', 'to-do', 'overview', '(today)']).slice(
        0,
        4,
      ),
    ).toEqual(['calendar', 'to-do', 'overview', '(today)']);
  });

  it('splits enabled order into In nav (by pinnedCount) and Others', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      4,
    );
    expect(inNav).toEqual([...DEFAULT_NAV_PIN_ORDER, 'overview']);
    expect(others[0]).toBe('profile');
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
    expect(inNav).toEqual(['(today)', 'to-do']);
    expect(others[0]).toBe('calendar');
  });

  it('drops disabled add-ons from both sections', () => {
    const enabled = new Set([
      'overview',
      'profile',
      'calendar',
      '(today)',
      'to-do',
      'travel',
    ]);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      4,
    );
    expect(inNav).toEqual(['(today)', 'to-do', 'calendar', 'overview']);
    expect(others).toEqual(['profile', 'travel']);
  });

  it('retapping More while on Trackers dismisses to the last pin', () => {
    expect(resolveMoreRetapTarget(MORE_TAB_ROUTE, '(today)', 'profile')).toBe(
      '(today)',
    );
    expect(resolveMoreRetapTarget(MORE_TAB_ROUTE, null, 'profile')).toBe(
      'profile',
    );
    expect(resolveMoreRetapTarget('(today)', '(today)', 'profile')).toBeNull();
    expect(resolveMoreRetapTarget('travel', '(today)', 'profile')).toBeNull();
  });

  it('promotes a More selection to the top of More without touching In nav', () => {
    const next = promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'travel', 4);
    expect(next).not.toBeNull();
    expect(next!.pinnedCount).toBe(4);
    expect(next!.trackerOrder.slice(0, 3)).toEqual([...DEFAULT_NAV_PIN_ORDER]);
    expect(next!.trackerOrder[4]).toBe('travel');
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'profile', 4),
    ).toBeNull();
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'social', 4),
    ).not.toBeNull();
  });
});
