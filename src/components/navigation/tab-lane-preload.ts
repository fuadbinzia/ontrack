import {
  peekCurrentTabName,
  peekTabForwardName,
  peekTabReturnName,
  TAB_RETURN_SETTLE_MS,
} from './overview-return';

/**
 * Keep the swipe lanes mounted before a gesture needs them.
 *
 * Lazy tabs unmount whenever the tab navigator remounts (Fast Refresh, shell
 * rebuilds) even though lane history survives — the pager then drags a lane
 * that renders nothing until the commit mounts it ("blank page before the
 * next page loads", right-to-left swipes especially: the back lane is often
 * Overview which is lazy: false, but the forward lane is a lazy tab).
 * React Navigation preload mounts a route without focusing it; combined with
 * the keep-painted scene spec the neighbor holds real pixels mid-drag.
 *
 * Bounded on purpose: only the two lanes a swipe can reveal — never the whole
 * dock (battery contract). The router drops a route's preloaded key when it
 * gains focus, so lanes are re-preloaded after every settled tab change.
 */
type TabPreloadNavigation = {
  dispatch: (action: { type: 'PRELOAD'; payload: { name: string } }) => void;
  getState?: () =>
    | {
        routes?: Array<{ key?: string; name?: string }>;
        preloadedRouteKeys?: string[];
      }
    | undefined;
};

export function tabLanePreloadNames(
  current: string | null,
  back: string | null,
  forward: string | null,
): string[] {
  const names = new Set<string>();
  if (back && back !== current) names.add(back);
  if (forward && forward !== current) names.add(forward);
  return [...names];
}

export function preloadTabLanes(navigation: TabPreloadNavigation) {
  const state = navigation.getState?.();
  const names = tabLanePreloadNames(
    peekCurrentTabName(),
    peekTabReturnName(),
    peekTabForwardName(),
  );
  for (const name of names) {
    const route = state?.routes?.find((entry) => entry.name === name);
    if (!route?.key) continue;
    if (state?.preloadedRouteKeys?.includes(route.key)) continue;
    navigation.dispatch({ type: 'PRELOAD', payload: { name } });
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Defer past the pager settle so preload renders never race the spring. */
export function schedulePreloadTabLanes(navigation: TabPreloadNavigation) {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    preloadTabLanes(navigation);
  }, TAB_RETURN_SETTLE_MS);
}

export function resetTabLanePreloadForTests() {
  if (pending) clearTimeout(pending);
  pending = null;
}
