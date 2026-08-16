import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { durations } from '@/design-system';

export const OVERVIEW_HREF = '/(tabs)/overview' as const satisfies Href;
/** Keep the leaving tab mounted until the dissolve finishes. */
export const TAB_RETURN_SETTLE_MS = durations.base;
export const OVERVIEW_RETURN_SETTLE_MS = TAB_RETURN_SETTLE_MS;

const MAX_TAB_RETURN_HISTORY = 16;

type TabReturnEntry = { tab: string; path: string };

let currentTab: string | null = null;
let currentPath: string | null = null;
let history: TabReturnEntry[] = [];
let forward: TabReturnEntry[] = [];
let returning = false;
let forwarding = false;
let parkAfterReturn = false;
let parkTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function historyKey() {
  return `${hasTabReturn()}|${peekTabReturnHref() ?? ''}|${hasTabForward()}|${peekTabForwardHref() ?? ''}`;
}

function notifyIfHistoryChanged(before: string) {
  if (historyKey() === before) return;
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
  if (returning) {
    if (history[history.length - 1]?.tab === tabName) {
      history.pop();
    }
    returning = false;
    currentTab = tabName;
    currentPath = nextPath;
    scheduleParkRelease();
    notifyIfHistoryChanged(before);
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
    scheduleParkRelease();
    notifyIfHistoryChanged(before);
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
  parkAfterReturn = false;
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
