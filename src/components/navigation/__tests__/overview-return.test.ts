import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  beginTabForward,
  beginTabReturn,
  beginTabTap,
  clearTabReturn,
  endTabTap,
  endTabTapIfCurrent,
  focusedTabName,
  hasTabForward,
  hasTabPark,
  hasTabReturn,
  isOverviewPath,
  peekCurrentTabName,
  peekTabForwardHref,
  peekTabReturnHref,
  peekTabTapFrom,
  peekTabTapLane,
  peekTabTapToken,
  rememberFocusedTab,
  resolveSwipeBackAction,
  startTabOpen,
  subscribeTabReturn,
  TAB_RETURN_SETTLE_MS,
  tabNameFromSegments,
  useOpenedFromOverview,
  wasOpenedFromOverview,
} from '../overview-return';
import { tabSwipeLanes } from '../tab-swipe';

describe('tab return', () => {
  afterEach(() => {
    clearTabReturn();
  });

  it('returns to the most recent tab, not only Overview', () => {
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    rememberFocusedTab('calendar');
    expect(peekTabReturnHref()).toBe('/');
    expect(beginTabReturn()).toBe('/');
    rememberFocusedTab('(today)');
    expect(peekTabReturnHref()).toBe('/(tabs)/overview');
  });

  it('still returns Overview → Today to Overview', () => {
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    expect(beginTabReturn()).toBe('/(tabs)/overview');
  });

  it('returns Today → Overview to Today', () => {
    rememberFocusedTab('(today)');
    rememberFocusedTab('overview');
    expect(hasTabReturn()).toBe(true);
    expect(beginTabReturn()).toBe('/');
  });

  it('keeps the old Overview hook names as aliases so Fast Refresh cannot crash', () => {
    expect(typeof useOpenedFromOverview).toBe('function');
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    expect(wasOpenedFromOverview()).toBe(true);
  });

  it('ignores the same tab focusing twice', () => {
    rememberFocusedTab('(today)');
    rememberFocusedTab('(today)');
    expect(hasTabReturn()).toBe(false);
    expect(peekTabReturnHref()).toBeNull();
  });

  it('swipes forward to the page a swipe-back just left', () => {
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    expect(beginTabReturn()).toBe('/(tabs)/overview');
    rememberFocusedTab('overview');
    expect(hasTabForward()).toBe(true);
    expect(peekTabForwardHref()).toBe('/');
    expect(beginTabForward()).toBe('/');
    rememberFocusedTab('(today)');
    expect(peekTabForwardHref()).toBeNull();
    expect(peekTabReturnHref()).toBe('/(tabs)/overview');
  });

  it('clears forward when the user opens a different tab instead', () => {
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    beginTabReturn();
    rememberFocusedTab('overview');
    rememberFocusedTab('calendar');
    expect(hasTabForward()).toBe(false);
    expect(peekTabReturnHref()).toBe('/(tabs)/overview');
  });

  it('does not record the swipe-back navigation as a new previous page', () => {
    rememberFocusedTab('calendar');
    rememberFocusedTab('(today)');
    expect(beginTabReturn()).toBe('/(tabs)/calendar');
    rememberFocusedTab('calendar');
    expect(peekTabReturnHref()).toBeNull();
  });

  it('returns to the exact previous page inside a tab', () => {
    rememberFocusedTab('to-do', '/to-do/list-1');
    rememberFocusedTab('(today)', '/');
    expect(beginTabReturn()).toBe('/to-do/list-1');
  });

  it('notifies when a previous tab should stay parked underneath', () => {
    const seen: boolean[] = [];
    const stop = subscribeTabReturn(() => {
      seen.push(hasTabReturn());
    });
    rememberFocusedTab('overview');
    rememberFocusedTab('(today)');
    clearTabReturn();
    stop();
    expect(seen).toEqual([true, false]);
    expect(TAB_RETURN_SETTLE_MS).toBeGreaterThanOrEqual(200);
  });

  it('keeps the previous tab attached and unfrozen so the pager can slide it', () => {
    const tabs = readFileSync(
      join(__dirname, '../../../app/(tabs)/_layout.tsx'),
      'utf8',
    );
    expect(tabs).toContain('detachInactiveScreens={false}');
    expect(tabs).toContain('freezeOnBlur: route.name !== MORE_TAB_ROUTE');
    expect(tabs).not.toContain('detachInactiveScreens={!hasTabPark}');
    expect(tabs).toContain('rememberFocusedTab(tabName, pathname)');
    expect(tabs).toContain('useOverviewAffinity.getState().recordVisit(tabName)');
    expect(tabs).toContain("intent=\"overview-return\" tabName={route.name}");
    expect(tabs).toContain('beginTabReturn()');
    expect(tabs).toContain('export default function TabsRoot');
    expect(tabs).not.toContain('export default function TabsLayout');
  });

  it('reads the focused tab name through nested stacks', () => {
    expect(
      focusedTabName({
        type: 'stack',
        index: 0,
        routes: [
          {
            name: '(tabs)',
            state: {
              type: 'tab',
              index: 2,
              routes: [
                { name: 'overview' },
                { name: '(today)' },
                { name: 'calendar' },
              ],
            },
          },
        ],
      }),
    ).toBe('calendar');
    expect(tabNameFromSegments(['(tabs)', 'to-do', 'list-1'])).toBe('to-do');
    expect(tabNameFromSegments(['(tabs)', '(today)'])).toBe('(today)');
    expect(tabNameFromSegments(['welcome'])).toBeNull();
  });

  it('parks both tabs and holds swipe offset until a tap settle finishes', () => {
    rememberFocusedTab('(today)', '/');
    expect(beginTabTap('(today)', 'calendar', 'right')).toBe(true);
    expect(peekCurrentTabName()).toBe('calendar');
    expect(peekTabTapFrom()).toBe('(today)');
    expect(peekTabTapLane()).toBe('back');
    expect(hasTabPark()).toBe(true);
    expect(peekTabReturnHref()).toBe('/');
    rememberFocusedTab('(today)', '/');
    expect(peekCurrentTabName()).toBe('calendar');
    rememberFocusedTab('calendar', '/(tabs)/calendar');
    expect(peekTabTapFrom()).toBe('(today)');
    expect(peekCurrentTabName()).toBe('calendar');
    endTabTap();
    expect(peekTabTapFrom()).toBeNull();
    expect(hasTabReturn()).toBe(true);
  });

  it('clears a stuck tap after the settle window so dest cannot stay off-screen', () => {
    jest.useFakeTimers();
    rememberFocusedTab('(today)', '/');
    expect(beginTabTap('(today)', 'to-do', 'right')).toBe(true);
    expect(peekTabTapFrom()).toBe('(today)');
    jest.advanceTimersByTime(TAB_RETURN_SETTLE_MS - 1);
    expect(peekTabTapFrom()).toBe('(today)');
    jest.advanceTimersByTime(1);
    expect(peekTabTapFrom()).toBeNull();
    expect(peekCurrentTabName()).toBe('to-do');
    jest.useRealTimers();
  });

  it('mirrors lanes onto the UI thread so the flip lands with the pager offset', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    expect(
      startTabOpen({
        from: 'overview',
        to: 'plants',
        side: 'right',
        width: 390,
        reduceMotion: false,
      }),
    ).toBe(true);
    expect(tabSwipeLanes.value).toMatchObject({
      current: 'plants',
      tapFrom: 'overview',
      tapLane: 'back',
    });
    endTabTap();
    expect(tabSwipeLanes.value).toMatchObject({
      current: 'plants',
      back: 'overview',
      tapFrom: null,
      tapLane: null,
    });
  });

  it('lets a quick second tap keep the pager — a stale settle cannot snap it', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    startTabOpen({
      from: 'overview',
      to: 'plants',
      side: 'right',
      width: 390,
      reduceMotion: false,
    });
    const stale = peekTabTapToken();
    startTabOpen({
      from: 'plants',
      to: 'travel',
      side: 'right',
      width: 390,
      reduceMotion: false,
    });
    endTabTapIfCurrent(stale);
    expect(peekTabTapFrom()).toBe('plants');
    expect(peekCurrentTabName()).toBe('travel');
    endTabTapIfCurrent(peekTabTapToken());
    expect(peekTabTapFrom()).toBeNull();
  });

  it('ignores a settle rest that lands after the tap already ended', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    startTabOpen({
      from: 'overview',
      to: 'plants',
      side: 'right',
      width: 390,
      reduceMotion: false,
    });
    const token = peekTabTapToken();
    endTabTap();
    expect(() => endTabTapIfCurrent(token)).not.toThrow();
    expect(peekTabTapFrom()).toBeNull();
  });

  it('sets swipe offset before beginTabTap so dest does not flash at rest', () => {
    const source = readFileSync(join(__dirname, '../overview-return.ts'), 'utf8');
    expect(source).toMatch(
      /tabSwipeX\.value = tabTapStartX[\s\S]*beginTabTap/,
    );
    expect(source).not.toMatch(
      /if \(!beginTabTap[\s\S]*tabSwipeX\.value = tabTapStartX/,
    );
  });

  it('skips the pager when reduce-motion is on or dest is already current', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    expect(
      startTabOpen({
        from: 'overview',
        to: 'travel',
        side: 'right',
        width: 390,
        reduceMotion: true,
      }),
    ).toBe(false);
    expect(
      startTabOpen({
        from: 'overview',
        to: 'overview',
        side: 'right',
        width: 390,
        reduceMotion: false,
      }),
    ).toBe(false);
  });

  it('puts a leftward tap neighbor in the forward lane', () => {
    rememberFocusedTab('calendar', '/(tabs)/calendar');
    expect(beginTabTap('calendar', '(today)', 'left')).toBe(true);
    expect(peekTabTapLane()).toBe('forward');
    expect(beginTabTap('(today)', '(today)', 'left')).toBe(false);
  });

  it('treats /overview as the hub path', () => {
    expect(isOverviewPath('/overview')).toBe(true);
    expect(isOverviewPath('/(tabs)/overview')).toBe(true);
    expect(isOverviewPath('/overview/')).toBe(true);
    expect(isOverviewPath('/')).toBe(false);
    expect(isOverviewPath('/to-do')).toBe(false);
  });
});

describe('resolveSwipeBackAction', () => {
  it('pops a real stack or sheet before returning to the previous tab', () => {
    expect(
      resolveSwipeBackAction({
        canDismiss: true,
        canGoBack: false,
        hasTabReturn: true,
      }),
    ).toBe('pop');
    expect(
      resolveSwipeBackAction({
        canDismiss: false,
        canGoBack: true,
        hasTabReturn: true,
      }),
    ).toBe('pop');
  });

  it('returns to the previous tab from a tab root', () => {
    expect(
      resolveSwipeBackAction({
        canDismiss: false,
        canGoBack: false,
        hasTabReturn: true,
      }),
    ).toBe('tab');
  });

  it('does nothing when there is no previous tab', () => {
    expect(
      resolveSwipeBackAction({
        canDismiss: false,
        canGoBack: false,
        hasTabReturn: false,
      }),
    ).toBe('none');
  });
});
