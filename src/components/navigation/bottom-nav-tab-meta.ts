import type { Href } from 'expo-router';

import type { AppIconName } from '@/design-system';

/** Route name → label / icon / href for the bottom carousel. */
export const TAB_META: Record<
  string,
  { label: string; icon: AppIconName; href: Href }
> = {
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
    label: 'Workout',
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
  food: {
    label: 'Food',
    icon: 'food',
    href: '/(tabs)/food',
  },
};
