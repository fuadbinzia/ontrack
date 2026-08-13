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
  it('defaults In nav to Overview · Today · Calendar · Checklists', () => {
    expect([...DEFAULT_NAV_PIN_ORDER]).toEqual([
      'overview',
      '(today)',
      'calendar',
      'to-do',
    ]);
    expect(DEFAULT_NAV_PIN_ORDER).toHaveLength(NAV_PIN_LIMIT);
  });

  it('sanitizes unknown / duplicate names and appends missing catalog entries', () => {
    expect(
      sanitizeTrackerOrder(['profile', 'nope', 'profile', 'travel']),
    ).toEqual([
      'overview',
      'profile',
      'travel',
      ...DEFAULT_TRACKER_ORDER.filter(
        (name) =>
          name !== 'overview' && name !== 'profile' && name !== 'travel',
      ),
    ]);
  });

  it('keeps Overview first when a persisted or dragged order puts it elsewhere', () => {
    expect(
      sanitizeTrackerOrder(['calendar', 'to-do', 'overview', '(today)']).slice(
        0,
        4,
      ),
    ).toEqual(['overview', 'calendar', 'to-do', '(today)']);
  });

  it('splits enabled order into In nav (by pinnedCount) and Others', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      4,
    );
    expect(inNav).toEqual([...DEFAULT_NAV_PIN_ORDER]);
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
    expect(inNav).toEqual(['overview', '(today)']);
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
    expect(inNav).toEqual(['overview', '(today)', 'calendar', 'to-do']);
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
    expect(next!.trackerOrder.slice(0, 4)).toEqual([...DEFAULT_NAV_PIN_ORDER]);
    expect(next!.trackerOrder[4]).toBe('travel');
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'profile', 4),
    ).toBeNull();
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'social', 4),
    ).not.toBeNull();
  });
});
