import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  beginTabForward,
  beginTabReturn,
  clearTabReturn,
  focusedTabName,
  hasTabForward,
  hasTabReturn,
  isOverviewPath,
  peekTabForwardHref,
  peekTabReturnHref,
  rememberFocusedTab,
  resolveSwipeBackAction,
  subscribeTabReturn,
  TAB_RETURN_SETTLE_MS,
  tabNameFromSegments,
  useOpenedFromOverview,
  wasOpenedFromOverview,
} from '../overview-return';

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

  it('keeps the previous tab attached while a tab root can dissolve back', () => {
    const tabs = readFileSync(
      join(__dirname, '../../../app/(tabs)/_layout.tsx'),
      'utf8',
    );
    expect(tabs).toMatch(/detachInactiveScreens=\{!hasTabPark\}/);
    expect(tabs).toContain('rememberFocusedTab(tabName, pathname)');
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
