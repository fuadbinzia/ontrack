import type { Href } from 'expo-router';

import type { AppIconName } from '@/design-system';

import { MORE_TAB_ROUTE } from './tab-pins';

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

/** Whether an addon-gated tracker route is available on this device. */
export function isTrackerRouteEnabled(
  routeName: string,
  enabledAddons: Record<string, boolean>,
): boolean {
  if (routeName === 'workouts') return !!enabledAddons.fitness;
  if (routeName === 'plants') return !!enabledAddons.plants;
  if (routeName === 'travel') return !!enabledAddons.travel;
  if (routeName === 'vision-board') return !!enabledAddons['vision-board'];
  if (routeName === 'games') return !!enabledAddons.games;
  if (routeName === 'vehicles') return !!enabledAddons.vehicles;
  if (routeName === 'food') return !!enabledAddons.food;
  if (routeName === 'finance') return !!enabledAddons.finance;
  if (routeName === 'journal') return !!enabledAddons.journal;
  if (routeName === 'health') {
    return process.env.EXPO_OS === 'ios' && !!enabledAddons.health;
  }
  return routeName in TAB_META && routeName !== MORE_TAB_ROUTE;
}
