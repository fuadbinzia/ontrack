/** Pure tab-order helpers for the bottom-nav carousel. */

/**
 * Cold-start / never-visited fallback — matches `(tabs)/_layout` screen order.
 * With empty recency, center=Today, right=next entries, left wraps to the last
 * entry (Profile for brand-new users).
 */
export const DEFAULT_TAB_ORDER = [
  '(today)',
  'calendar',
  'to-do',
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
  'food',
  'profile',
] as const;

const DEFAULT_INDEX = new Map<string, number>(
  DEFAULT_TAB_ORDER.map((name, index) => [name, index]),
);

function defaultRank(routeName: string): number {
  return DEFAULT_INDEX.get(routeName) ?? Number.MAX_SAFE_INTEGER;
}

function hasFocusTimestamp(
  routeName: string,
  lastFocusedAt: Readonly<Record<string, number>>,
): boolean {
  const focused = lastFocusedAt[routeName];
  return typeof focused === 'number' && Number.isFinite(focused);
}

/** Higher `lastFocusedAt` first; never-used falls back to DEFAULT_TAB_ORDER. */
export function compareTabsByRecency(
  a: string,
  b: string,
  lastFocusedAt: Readonly<Record<string, number>>,
): number {
  const focusedA = lastFocusedAt[a];
  const focusedB = lastFocusedAt[b];
  const hasA = typeof focusedA === 'number' && Number.isFinite(focusedA);
  const hasB = typeof focusedB === 'number' && Number.isFinite(focusedB);

  if (hasA && hasB && focusedA !== focusedB) {
    return focusedB - focusedA;
  }
  if (hasA !== hasB) {
    return hasA ? -1 : 1;
  }

  const rankCmp = defaultRank(a) - defaultRank(b);
  if (rankCmp !== 0) return rankCmp;
  return a.localeCompare(b);
}

/**
 * Rank most-recent first, then place prior tabs left of center and the rest
 * on the right for browse-through:
 * center = active (ranked[0]), left = recents (most recent closest to middle),
 * right = never-focused tabs in DEFAULT_TAB_ORDER.
 */
export function orderRoutesByRecency<T extends { name: string }>(
  routes: readonly T[],
  lastFocusedAt: Readonly<Record<string, number>>,
): T[] {
  const ranked = [...routes].sort((a, b) =>
    compareTabsByRecency(a.name, b.name, lastFocusedAt),
  );
  return arrangeRecentsLeftRestRight(ranked, lastFocusedAt);
}

/**
 * Place ranked[0] at center index 0.
 * Carousel left of center is index n-1; right is index 1.
 * Focused prior tabs go left (most recent closest to center); never-focused
 * tabs fill the right so arrow taps walk the remaining catalog.
 */
export function arrangeRecentsLeftRestRight<T extends { name: string }>(
  ranked: readonly T[],
  lastFocusedAt: Readonly<Record<string, number>>,
): T[] {
  const n = ranked.length;
  if (n <= 1) return [...ranked];

  const recents: T[] = [];
  const rest: T[] = [];
  for (let i = 1; i < n; i++) {
    const route = ranked[i];
    if (hasFocusTimestamp(route.name, lastFocusedAt)) {
      recents.push(route);
    } else {
      rest.push(route);
    }
  }

  const arranged: T[] = new Array(n);
  arranged[0] = ranked[0];
  for (let i = 0; i < recents.length; i++) {
    arranged[n - 1 - i] = recents[i];
  }
  for (let i = 0; i < rest.length; i++) {
    arranged[1 + i] = rest[i];
  }
  return arranged;
}
