import type { Href } from 'expo-router';

import { ADDONS } from '@/addons/registry';
import type { AppIconName } from '@/design-system/icons';

import { MORE_TAB_ROUTE } from './tab-pins';

const ADDON_ID_BY_ROUTE = new Map<string, (typeof ADDONS)[number]['id']>(
  ADDONS.flatMap((addon) =>
    addon.tabRoute ? ([[addon.tabRoute, addon.id]] as const) : [],
  ),
);

/** Route name → label / icon / href for the bottom bar + Trackers catalog. */
export const TAB_META: Record<
  string,
  { label: string; icon: AppIconName; href: Href }
> = {
  overview: { label: 'Overview', icon: 'home', href: '/(tabs)/overview' },
  '(today)': { label: 'Today', icon: 'today', href: '/' },
  calendar: {
    label: 'Calendar',
    icon: 'calendar',
    href: '/(tabs)/calendar',
  },
  'to-do': {
    label: 'Checklists',
    icon: 'tasks',
    href: '/(tabs)/to-do',
  },
  social: {
    label: 'Social',
    icon: 'people',
    href: '/(tabs)/social',
  },
  insights: {
    label: 'Insights',
    icon: 'insights',
    href: '/(tabs)/insights',
  },
  profile: {
    label: 'Profile',
    icon: 'profile',
    href: '/(tabs)/profile',
  },
  workouts: {
    label: 'Fitness',
    icon: 'gym',
    href: '/(tabs)/workouts',
  },
  plants: { label: 'Plants', icon: 'plant', href: '/(tabs)/plants' },
  travel: { label: 'Travel', icon: 'flight', href: '/(tabs)/travel' },
  'vision-board': {
    // Short chrome label so equal rail slots keep even visual gutters.
    label: 'Vision',
    icon: 'vision-board',
    href: '/(tabs)/vision-board',
  },
  games: {
    label: 'Games',
    icon: 'games',
    href: '/(tabs)/games',
  },
  vehicles: {
    label: 'Vehicles',
    icon: 'vehicles',
    href: '/(tabs)/vehicles',
  },
  health: {
    label: 'Health',
    icon: 'health',
    href: '/(tabs)/health',
  },
  finance: {
    label: 'Finance',
    icon: 'finance',
    href: '/(tabs)/finance',
  },
  journal: {
    label: 'Journal',
    icon: 'journal',
    href: '/(tabs)/journal',
  },
  food: {
    label: 'Food',
    icon: 'food',
    href: '/(tabs)/food',
  },
  trackers: {
    label: 'More',
    icon: 'more',
    href: '/(tabs)/trackers',
  },
};

/** Full catalog name. Rail chrome keeps the short `TAB_META` label. */
export function trackerCatalogLabel(routeName: string): string {
  if (routeName === 'vision-board') return 'Vision Board';
  return TAB_META[routeName]?.label ?? routeName;
}

/** Whether an addon-gated tracker route is available on this device. */
export function isTrackerRouteEnabled(
  routeName: string,
  enabledAddons: Record<string, boolean>,
): boolean {
  const addonId = ADDON_ID_BY_ROUTE.get(routeName);
  if (addonId) {
    if (addonId === 'health') {
      return process.env.EXPO_OS === 'ios' && !!enabledAddons.health;
    }
    return !!enabledAddons[addonId];
  }
  return routeName in TAB_META && routeName !== MORE_TAB_ROUTE;
}
