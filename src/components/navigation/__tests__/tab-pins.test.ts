import {
  clampPinnedCount,
  DEFAULT_NAV_PIN_ORDER,
  DEFAULT_PINNED_COUNT,
  DEFAULT_TRACKER_ORDER,
  mergeTrackerSections,
  MORE_TAB_ROUTE,
  NAV_DOCK_EXTRA_COUNTS,
  NAV_PIN_COUNTS,
  NAV_PIN_LIMIT,
  NAV_PIN_MIN,
  navDockExtraCount,
  pinCountFromDockExtras,
  promoteMoreSelection,
  resolveMoreRetapTarget,
  sanitizeTrackerOrder,
  splitTrackerOrder,
} from '../tab-pins';

describe('tab-pins', () => {
  it('defaults In nav to Today · Checklists · Calendar, then fills to 5', () => {
    expect([...DEFAULT_NAV_PIN_ORDER]).toEqual([
      '(today)',
      'to-do',
      'calendar',
    ]);
    expect(DEFAULT_NAV_PIN_ORDER.length).toBeLessThanOrEqual(NAV_PIN_LIMIT);
    expect(DEFAULT_PINNED_COUNT).toBe(NAV_PIN_LIMIT);
    expect(NAV_PIN_MIN).toBe(3);
    expect(NAV_PIN_LIMIT).toBe(5);
    expect([...NAV_PIN_COUNTS]).toEqual([3, 5]);
    expect([...NAV_DOCK_EXTRA_COUNTS]).toEqual([3, 5]);
  });

  it('snaps pinnedCount to 3 or 5 so Search stays centered', () => {
    const orderLength = DEFAULT_TRACKER_ORDER.length;
    expect(clampPinnedCount(1, orderLength)).toBe(3);
    expect(clampPinnedCount(2, orderLength)).toBe(3);
    expect(clampPinnedCount(3, orderLength)).toBe(3);
    expect(clampPinnedCount(4, orderLength)).toBe(5);
    expect(clampPinnedCount(5, orderLength)).toBe(5);
    expect(clampPinnedCount(6, orderLength)).toBe(5);
    expect(clampPinnedCount(Number.NaN, orderLength)).toBe(5);
    expect(navDockExtraCount(clampPinnedCount(2, orderLength))).toBe(3);
    expect(navDockExtraCount(clampPinnedCount(3, orderLength))).toBe(3);
    expect(navDockExtraCount(clampPinnedCount(4, orderLength))).toBe(5);
    expect(navDockExtraCount(clampPinnedCount(5, orderLength))).toBe(5);
    expect(pinCountFromDockExtras(3)).toBe(3);
    expect(pinCountFromDockExtras(5)).toBe(5);

    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    expect(
      splitTrackerOrder(DEFAULT_TRACKER_ORDER, enabled, 4).inNav,
    ).toHaveLength(5);
    expect(
      splitTrackerOrder(DEFAULT_TRACKER_ORDER, enabled, 1).inNav,
    ).toHaveLength(3);
    expect(
      mergeTrackerSections(
        [...DEFAULT_NAV_PIN_ORDER],
        DEFAULT_TRACKER_ORDER.slice(3),
      ).pinnedCount,
    ).toBe(3);
    expect(
      mergeTrackerSections(
        [...DEFAULT_NAV_PIN_ORDER, 'overview'],
        DEFAULT_TRACKER_ORDER.slice(4),
      ).pinnedCount,
    ).toBe(5);
  });

  it('never returns 2 or 4 pins when orderLength is at least 5', () => {
    const orderLength = DEFAULT_TRACKER_ORDER.length;
    for (const count of [0, 1, 2, 3, 4, 5, 6, 99, Number.NaN]) {
      const next = clampPinnedCount(count, orderLength);
      expect(next === 3 || next === 5).toBe(true);
      expect(next).not.toBe(2);
      expect(next).not.toBe(4);
    }
  });

  it('stays at 3 pins when the catalog cannot fill 5', () => {
    expect(clampPinnedCount(3, 3)).toBe(3);
    expect(clampPinnedCount(4, 4)).toBe(3);
    expect(clampPinnedCount(5, 4)).toBe(3);
    expect(clampPinnedCount(4, 2)).toBe(3);
    expect(navDockExtraCount(clampPinnedCount(5, 4))).toBe(3);
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
        5,
      ),
    ).toEqual(['calendar', 'to-do', 'overview', '(today)', 'profile']);
  });

  it('splits enabled order into In nav (by pinnedCount) and Others', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      5,
    );
    expect(inNav).toEqual([...DEFAULT_NAV_PIN_ORDER, 'overview', 'profile']);
    expect(others[0]).toBe('social');
    expect(mergeTrackerSections(inNav, others)).toEqual({
      trackerOrder: [...DEFAULT_TRACKER_ORDER],
      pinnedCount: 5,
    });
  });

  it('honors the compact 3-pin dock', () => {
    const enabled = new Set<string>(DEFAULT_TRACKER_ORDER);
    const { inNav, others } = splitTrackerOrder(
      DEFAULT_TRACKER_ORDER,
      enabled,
      3,
    );
    expect(inNav).toEqual(['(today)', 'to-do', 'calendar']);
    expect(others[0]).toBe('overview');
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
      5,
    );
    expect(inNav).toEqual([
      '(today)',
      'to-do',
      'calendar',
      'overview',
      'profile',
    ]);
    expect(others).toEqual(['travel']);
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
    const next = promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'travel', 5);
    expect(next).not.toBeNull();
    expect(next!.pinnedCount).toBe(5);
    expect(next!.trackerOrder.slice(0, 5)).toEqual([
      ...DEFAULT_NAV_PIN_ORDER,
      'overview',
      'profile',
    ]);
    expect(next!.trackerOrder[5]).toBe('travel');
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'profile', 5),
    ).toBeNull();
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'social', 5),
    ).toBeNull();
    expect(
      promoteMoreSelection(DEFAULT_TRACKER_ORDER, 'insights', 5),
    ).not.toBeNull();
  });
});
