import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { durations } from '@/design-system';

import {
  resetTabSwipeX,
  settleTabSwipeX,
  syncTabSwipeLanes,
  tabSwipeX,
  tabTapLane,
  tabTapStartX,
  type TabTapSide,
} from './tab-swipe';

export const OVERVIEW_HREF = '/(tabs)/overview' as const satisfies Href;
/** Keep the leaving tab mounted until the swipe spring finishes. */
export const TAB_RETURN_SETTLE_MS = durations.slow;
export const OVERVIEW_RETURN_SETTLE_MS = TAB_RETURN_SETTLE_MS;

const MAX_TAB_RETURN_HISTORY = 16;

type TabReturnEntry = { tab: string; path: string };

let currentTab: string | null = null;
let currentPath: string | null = null;
let history: TabReturnEntry[] = [];
let forward: TabReturnEntry[] = [];
let returning = false;
let forwarding = false;
let tapping = false;
let tapFrom: string | null = null;
let tapNeighborLane: 'back' | 'forward' | null = null;
let parkAfterReturn = false;
let parkTimer: ReturnType<typeof setTimeout> | null = null;
let tapFallbackTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function syncLanes() {
  syncTabSwipeLanes({
    current: currentTab,
    back: peekTabReturnName(),
    forward: peekTabForwardName(),
    tapFrom,
    tapLane: tapNeighborLane,
  });
}

function notify() {
  // Mirror lanes onto the UI thread first so the flip rides the same frame
  // batch as the pager offset — React re-renders only refresh pointerEvents.
  syncLanes();
  listeners.forEach((listener) => listener());
}

function historyKey() {
  return `${hasTabReturn()}|${peekTabReturnHref() ?? ''}|${hasTabForward()}|${peekTabForwardHref() ?? ''}`;
}

function notifyIfHistoryChanged(before: string) {
  if (historyKey() === before) {
    syncLanes();
    return;
  }
  notify();
}

function hrefForTabName(tabName: string): string {
  if (tabName === '(today)') return '/';
  if (tabName === 'overview') return OVERVIEW_HREF;
  return `/(tabs)/${tabName}`;
}

export function focusedTabName(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const nav = state as {
    type?: string;
    index?: number;
    routes?: Array<{ name?: string; state?: unknown }>;
  };
  if (nav.type === 'tab') {
    return nav.routes?.[nav.index ?? 0]?.name ?? null;
  }
  const route = nav.routes?.[nav.index ?? 0];
  return route?.state ? focusedTabName(route.state) : null;
}

export function tabNameFromSegments(segments: readonly string[]): string | null {
  if (segments[0] !== '(tabs)') return null;
  return segments[1] ?? null;
}

function pathForTab(tabName: string, pathname?: string): string | null {
  const path = pathname?.split('?')[0];
  if (path && path !== '/') return path;
  return hrefForTabName(tabName);
}

export function rememberFocusedTab(tabName: string | null, pathname?: string) {
  if (!tabName) return;
  const nextPath = pathForTab(tabName, pathname);
  const before = historyKey();
  if (tapping) {
    // Ignore the leaving tab's stale focus report so it cannot undo dest.
    if (tabName === tapFrom) return;
    if (currentTab === tabName && nextPath) currentPath = nextPath;
    return;
  }
  if (returning) {
    if (history[history.length - 1]?.tab === tabName) {
      history.pop();
    }
    returning = false;
    currentTab = tabName;
    currentPath = nextPath;
    resetTabSwipeX();
    scheduleParkRelease();
    notify();
    return;
  }
  if (forwarding) {
    if (forward[forward.length - 1]?.tab === tabName) {
      forward.pop();
    }
    if (currentTab && currentPath && currentTab !== tabName) {
      history.push({ tab: currentTab, path: currentPath });
      if (history.length > MAX_TAB_RETURN_HISTORY) {
        history.splice(0, history.length - MAX_TAB_RETURN_HISTORY);
      }
    }
    forwarding = false;
    currentTab = tabName;
    currentPath = nextPath;
    resetTabSwipeX();
    scheduleParkRelease();
    notify();
    return;
  }
  if (currentTab === tabName) {
    if (nextPath) currentPath = nextPath;
    return;
  }
  forward = [];
  if (currentTab && currentPath) {
    history.push({ tab: currentTab, path: currentPath });
    if (history.length > MAX_TAB_RETURN_HISTORY) {
      history.splice(0, history.length - MAX_TAB_RETURN_HISTORY);
    }
  }
  currentTab = tabName;
  currentPath = nextPath;
  notifyIfHistoryChanged(before);
}

export function peekCurrentTabName(): string | null {
  return currentTab;
}

export function peekTabReturnName(): string | null {
  return history[history.length - 1]?.tab ?? null;
}

export function peekTabForwardName(): string | null {
  return forward[forward.length - 1]?.tab ?? null;
}

export function peekTabReturnHref(): Href | null {
  const path = history[history.length - 1]?.path;
  return path ? (path as Href) : null;
}

export function beginTabReturn(): Href | null {
  const href = peekTabReturnHref();
  if (!href) return null;
  if (currentTab && currentPath) {
    forward.push({ tab: currentTab, path: currentPath });
    if (forward.length > MAX_TAB_RETURN_HISTORY) {
      forward.splice(0, forward.length - MAX_TAB_RETURN_HISTORY);
    }
  }
  returning = true;
  parkAfterReturn = true;
  notify();
  return href;
}

export function peekTabForwardHref(): Href | null {
  const path = forward[forward.length - 1]?.path;
  return path ? (path as Href) : null;
}

export function beginTabForward(): Href | null {
  const href = peekTabForwardHref();
  if (!href) return null;
  forwarding = true;
  parkAfterReturn = true;
  notify();
  return href;
}

export function peekTabTapFrom(): string | null {
  return tapFrom;
}

export function peekTabTapLane(): 'back' | 'forward' | null {
  return tapNeighborLane;
}

let tapToken = 0;

export function peekTabTapToken(): number {
  return tapToken;
}

/** End only the tap that started this settle — a newer tap owns the pager. */
export function endTabTapIfCurrent(token: number) {
  if (token !== tapToken || !tapping) return;
  endTabTap();
}

/** Park both tabs and treat dest as current so a tap can spring like a swipe. */
export function beginTabTap(
  from: string,
  to: string,
  side: TabTapSide,
): boolean {
  if (!from || !to || from === to) return false;
  tapToken += 1;
  tapping = true;
  tapFrom = from;
  tapNeighborLane = tabTapLane(side);
  parkAfterReturn = true;
  forward = [];
  if (currentTab && currentPath && currentTab !== to) {
    history.push({ tab: currentTab, path: currentPath });
    if (history.length > MAX_TAB_RETURN_HISTORY) {
      history.splice(0, history.length - MAX_TAB_RETURN_HISTORY);
    }
  }
  currentTab = to;
  currentPath = pathForTab(to);
  if (tapFallbackTimer) clearTimeout(tapFallbackTimer);
  tapFallbackTimer = setTimeout(() => {
    tapFallbackTimer = null;
    if (tapping) endTabTap();
  }, TAB_RETURN_SETTLE_MS);
  notify();
  return true;
}

export function endTabTap() {
  tapping = false;
  tapFrom = null;
  tapNeighborLane = null;
  if (tapFallbackTimer) {
    clearTimeout(tapFallbackTimer);
    tapFallbackTimer = null;
  }
  resetTabSwipeX();
  scheduleParkRelease();
  notify();
}

/**
 * Offset the pager, then notify dest as current. Setting dest first at
 * swipeX=0 flashes the incoming page at rest.
 */
export function startTabOpen(input: {
  from: string | null | undefined;
  to: string;
  side: TabTapSide | null;
  width: number;
  reduceMotion: boolean;
}): boolean {
  if (!input.from) return false;
  if (input.from === input.to) {
    endTabTap();
    return false;
  }
  if (input.reduceMotion || !input.side) return false;
  tabSwipeX.value = tabTapStartX(input.side, input.width);
  if (!beginTabTap(input.from, input.to, input.side)) {
    resetTabSwipeX();
    return false;
  }
  // A quick second tap cancels this spring; its rest callback must not reset
  // the new tap's state mid-flight (that was a hard snap on double taps).
  const token = tapToken;
  settleTabSwipeX(0, false, () => endTabTapIfCurrent(token));
  return true;
}

export function hasTabReturn() {
  return history.length > 0 || parkAfterReturn;
}

export function hasTabForward() {
  return forward.length > 0;
}

export function hasTabPark() {
  return hasTabReturn() || hasTabForward();
}

export function clearTabReturn() {
  currentTab = null;
  currentPath = null;
  history = [];
  forward = [];
  returning = false;
  forwarding = false;
  tapping = false;
  tapFrom = null;
  tapNeighborLane = null;
  parkAfterReturn = false;
  resetTabSwipeX();
  if (tapFallbackTimer) {
    clearTimeout(tapFallbackTimer);
    tapFallbackTimer = null;
  }
  if (parkTimer) {
    clearTimeout(parkTimer);
    parkTimer = null;
  }
  notify();
}

function scheduleParkRelease() {
  parkAfterReturn = true;
  if (parkTimer) clearTimeout(parkTimer);
  parkTimer = setTimeout(() => {
    parkAfterReturn = false;
    parkTimer = null;
    notify();
  }, TAB_RETURN_SETTLE_MS);
}

export function tabSwipeLaneKey() {
  return `${currentTab ?? ''}|${peekTabReturnName() ?? ''}|${peekTabForwardName() ?? ''}|${tapFrom ?? ''}|${tapNeighborLane ?? ''}`;
}

export function subscribeTabReturn(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function useHasTabReturn() {
  return useSyncExternalStore(subscribeTabReturn, hasTabReturn, hasTabReturn);
}

export function useHasTabForward() {
  return useSyncExternalStore(subscribeTabReturn, hasTabForward, hasTabForward);
}

export function useHasTabPark() {
  return useSyncExternalStore(subscribeTabReturn, hasTabPark, hasTabPark);
}

/** Fast Refresh / older callers — same as `useHasTabReturn`. */
export function useOpenedFromOverview() {
  return useHasTabReturn();
}

export function wasOpenedFromOverview() {
  return hasTabReturn();
}

export function isOverviewPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
  return path === '/overview' || path === '/(tabs)/overview';
}

export function resolveSwipeBackAction(input: {
  canDismiss: boolean;
  canGoBack: boolean;
  hasTabReturn: boolean;
}): 'pop' | 'tab' | 'none' {
  if (input.canDismiss || input.canGoBack) return 'pop';
  if (input.hasTabReturn) return 'tab';
  return 'none';
}
