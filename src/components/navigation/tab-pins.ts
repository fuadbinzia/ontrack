/** Pure helpers for pinned bottom-nav trackers (fixed slots + Trackers page). */

/** Slots in the bar before the always-present More / Trackers control. */
export const NAV_PIN_LIMIT = 4;
export const NAV_PIN_MIN = 1;

/**
 * Default left→right bar pins (then More).
 * Remaining catalog order fills “Others” on Trackers.
 */
export const DEFAULT_NAV_PIN_ORDER = [
  'profile',
  'calendar',
  '(today)',
  'to-do',
] as const;

/** Full tracker catalog order (More / trackers excluded — always the 5th bar slot). */
export const DEFAULT_TRACKER_ORDER = [
  ...DEFAULT_NAV_PIN_ORDER,
  'social',
  'insights',
  'workouts',
  'plants',
  'travel',
  'vision-board',
  'games',
  'vehicles',
  'health',
  'food',
] as const;

export const TRACKER_ROUTE_NAMES = new Set<string>(DEFAULT_TRACKER_ORDER);

export const MORE_TAB_ROUTE = 'trackers';

/**
 * Retapping More while Trackers is open dismisses to the last pin.
 * Returns that pin name, or `null` when More should open instead.
 */
export function resolveMoreRetapTarget(
  focusedRouteName: string | undefined,
  lastPinRouteName: string | null | undefined,
  fallbackPin: string,
): string | null {
  if (focusedRouteName !== MORE_TAB_ROUTE) return null;
  if (lastPinRouteName && lastPinRouteName !== MORE_TAB_ROUTE) {
    return lastPinRouteName;
  }
  return fallbackPin;
}

export function sanitizeTrackerOrder(
  value?: readonly string[] | null,
): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const name of value ?? []) {
    if (typeof name !== 'string') continue;
    if (!TRACKER_ROUTE_NAMES.has(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    next.push(name);
  }
  for (const name of DEFAULT_TRACKER_ORDER) {
    if (seen.has(name)) continue;
    next.push(name);
  }
  return next;
}

export function clampPinnedCount(
  count: number,
  orderLength: number,
): number {
  if (!Number.isFinite(count)) return NAV_PIN_LIMIT;
  const max = Math.min(NAV_PIN_LIMIT, Math.max(NAV_PIN_MIN, orderLength));
  return Math.min(max, Math.max(NAV_PIN_MIN, Math.round(count)));
}

/** Enabled trackers in persisted order, split by pinnedCount. */
export function splitTrackerOrder(
  order: readonly string[],
  enabledNames: ReadonlySet<string>,
  pinnedCount: number = NAV_PIN_LIMIT,
): { inNav: string[]; others: string[] } {
  const filtered = sanitizeTrackerOrder(order).filter((name) =>
    enabledNames.has(name),
  );
  const pins = clampPinnedCount(pinnedCount, filtered.length);
  return {
    inNav: filtered.slice(0, pins),
    others: filtered.slice(pins),
  };
}

export function mergeTrackerSections(
  inNav: readonly string[],
  others: readonly string[],
): { trackerOrder: string[]; pinnedCount: number } {
  const trackerOrder = sanitizeTrackerOrder([...inNav, ...others]);
  const pinnedCount = clampPinnedCount(inNav.length, trackerOrder.length);
  return { trackerOrder, pinnedCount };
}

/**
 * Move a More-section route to the top of More. In nav stays unchanged.
 * Returns null when the route is not in More (or already first).
 */
export function promoteMoreSelection(
  order: readonly string[],
  routeName: string,
  pinnedCount: number = NAV_PIN_LIMIT,
): { trackerOrder: string[]; pinnedCount: number } | null {
  const trackerOrder = sanitizeTrackerOrder(order);
  const pins = clampPinnedCount(pinnedCount, trackerOrder.length);
  const inNav = trackerOrder.slice(0, pins);
  const others = trackerOrder.slice(pins);
  if (!others.includes(routeName) || others[0] === routeName) return null;
  return mergeTrackerSections(
    inNav,
    [routeName, ...others.filter((name) => name !== routeName)],
  );
}
