import type { AddonEnabledState } from '@/addons/types';
import {
  isTrackerRouteEnabled,
  TAB_META,
  trackerCatalogLabel,
} from '@/components/navigation/bottom-nav-tab-meta';
import { MORE_TAB_ROUTE } from '@/components/navigation/tab-pins';
import { haystackMatchesQuery } from '@/utils/search-text';

import type { SearchDocument } from './search-types';

const SCREEN_ORDER = [
  '(today)',
  'calendar',
  'to-do',
  'overview',
  'profile',
  MORE_TAB_ROUTE,
] as const;

function isScreenSearchable(
  routeName: string,
  enabledAddons: AddonEnabledState,
): boolean {
  if (routeName === MORE_TAB_ROUTE) return true;
  return isTrackerRouteEnabled(routeName, enabledAddons);
}

function screenDocument(routeName: string): SearchDocument | null {
  const meta = TAB_META[routeName];
  if (!meta) return null;
  const id = routeName.replace(/[^a-zA-Z0-9]+/g, '_');
  return {
    kind: 'screen',
    domain: 'screen',
    id: `screen:${id}`,
    title: trackerCatalogLabel(routeName),
    href: meta.href,
    icon: meta.icon,
  };
}

/** Screens the typeahead can open, gated by enabled add-ons (Health is iOS-only). */
export function catalogSearchScreens(
  enabledAddons: AddonEnabledState,
  query = '',
): SearchDocument[] {
  const preferred = SCREEN_ORDER.filter((routeName) =>
    isScreenSearchable(routeName, enabledAddons),
  );
  const rest = Object.keys(TAB_META).filter(
    (routeName) =>
      !SCREEN_ORDER.includes(routeName as (typeof SCREEN_ORDER)[number]) &&
      isScreenSearchable(routeName, enabledAddons),
  );
  return [...preferred, ...rest]
    .map((routeName) => screenDocument(routeName))
    .filter((item): item is SearchDocument => {
      if (!item) return false;
      return haystackMatchesQuery([item.title], query);
    });
}
