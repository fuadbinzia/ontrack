/** Pure helpers for pinned bottom-nav trackers (fixed slots + Trackers page). */

/**
 * Pins beside center search, before More.
 * User-facing dock is only 3 or 5 pins (Search centered; More last).
 */
export const NAV_PIN_LIMIT = 5;
export const NAV_PIN_MIN = 3;
export const NAV_PIN_COUNTS = [NAV_PIN_MIN, NAV_PIN_LIMIT] as const;
export const NAV_DOCK_EXTRA_COUNTS = [3, 5] as const;

export type NavPinCount = (typeof NAV_PIN_COUNTS)[number];
export type NavDockExtraCount = (typeof NAV_DOCK_EXTRA_COUNTS)[number];

/**
 * Default left→right bar pins (then More).
 * Remaining catalog order fills “Others” on Trackers.
 */
export const DEFAULT_NAV_PIN_ORDER = [
  '(today)',
  'to-do',
  'calendar',
] as const;

/** Five pins around center search; More stays last. */
export const DEFAULT_PINNED_COUNT = NAV_PIN_LIMIT;

/** Full tracker catalog order (More / trackers excluded — always last in the bar). */
export const DEFAULT_TRACKER_ORDER = [
  ...DEFAULT_NAV_PIN_ORDER,
  'overview',
  'profile',
  'social',
  'insights',
  'workouts',
  'plants',
  'travel',
  'vision-board',
  'games',
  'vehicles',
  'health',
  'finance',
  'journal',
  'food',
] as const;

/** Optional pulse — no longer forced first in the bar. */
export const PRIMARY_OVERVIEW_ROUTE = 'overview';

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

/**
 * Snap to 3 or 5 pins (excluding Search and More).
 * Stored 1–3 → 3. Stored 4+ → 5 when `orderLength >= 5`, else 3.
 */
export function clampPinnedCount(
  count: number,
  orderLength: number,
): number {
  const allowFive = orderLength >= NAV_PIN_LIMIT;
  if (!Number.isFinite(count)) {
    return allowFive ? NAV_PIN_LIMIT : NAV_PIN_MIN;
  }
  const rounded = Math.round(count);
  if (rounded >= 4 && allowFive) return NAV_PIN_LIMIT;
  return NAV_PIN_MIN;
}

/** Extra dock icons = pin count after clamp. Always 3 or 5. */
export function navDockExtraCount(pinCount: number): NavDockExtraCount {
  return pinCount >= NAV_PIN_LIMIT ? 5 : 3;
}

export function pinCountFromDockExtras(extras: NavDockExtraCount): NavPinCount {
  return extras === 5 ? NAV_PIN_LIMIT : NAV_PIN_MIN;
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
