import {
  isTrackerRouteEnabled,
  TAB_META,
} from '@/components/navigation/bottom-nav-tab-meta';
import { splitTrackerOrder } from '@/components/navigation/tab-pins';

/**
 * More lists every enabled section. Presence used to hide empty add-ons,
 * which also hid a module the user had just turned on.
 */
export function visibleMoreRoutes(others: readonly string[]): string[] {
  return [...others];
}

/** In-nav pins plus More rows for the current add-on toggles. */
export function moreListRoutes(
  trackerOrder: readonly string[],
  enabledAddons: Record<string, boolean>,
  pinnedCount: number,
): { inNav: string[]; others: string[] } {
  const enabledNames = new Set<string>();
  for (const name of Object.keys(TAB_META)) {
    if (!isTrackerRouteEnabled(name, enabledAddons)) continue;
    enabledNames.add(name);
  }
  const { inNav, others } = splitTrackerOrder(
    trackerOrder,
    enabledNames,
    pinnedCount,
  );
  return { inNav, others: visibleMoreRoutes(others) };
}
