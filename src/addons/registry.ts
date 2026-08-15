import type { Activity } from '@/types/models';

import type {
  AddonDefinition,
  AddonEnabledState,
  AddonEntitlementState,
  AddonId,
} from './types';

/**
 * The only catalog the app shell knows about.
 *
 * Add-on UI, state, and services stay in their feature folders. The shell uses
 * this small manifest for discovery and visibility, so adding a module does not
 * require duplicating entitlement or navigation rules.
 */
export const ADDONS = [
  {
    id: 'food',
    name: 'Food Tracker',
    description: 'Meals, nutrition, photos, and food insights.',
    categoryIds: ['food'],
    tabRoute: 'food',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    description: 'Workout planning, exercise tracking, and progress.',
    categoryIds: ['gym'],
    tabRoute: 'workouts',
  },
  {
    id: 'plants',
    name: 'Plant Care',
    description: 'Plant profiles, reminders, and care check-ins.',
    categoryIds: ['plant'],
    tabRoute: 'plants',
  },
  {
    id: 'travel',
    name: 'Travel Planner',
    description: 'Shared trips, itineraries, flight search, and stays.',
    categoryIds: [],
    tabRoute: 'travel',
  },
  {
    id: 'vision-board',
    name: 'Vision Board',
    description: 'Visualize goals with personal images, affirmations, and intentions.',
    categoryIds: [],
    tabRoute: 'vision-board',
  },
  {
    id: 'games',
    name: 'Games',
    description: 'Quick mini-games like Balloon Pop for short focus breaks.',
    categoryIds: [],
    tabRoute: 'games',
  },
  {
    id: 'vehicles',
    name: 'Vehicle Tracker',
    description: 'Maintenance, mileage, expenses, registration, insurance, and parts.',
    categoryIds: [],
    tabRoute: 'vehicles',
  },
  {
    id: 'health',
    name: 'Health',
    description: 'Private Apple Health trends, mood check-ins, and personal action plans.',
    categoryIds: [],
    tabRoute: 'health',
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Spending, bills, savings buckets, businesses/properties, and tax prep.',
    categoryIds: [],
    tabRoute: 'finance',
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'Private daily pages with typed notes, dictate, and voice notes.',
    categoryIds: [],
    tabRoute: 'journal',
  },
] as const satisfies readonly AddonDefinition[];

export const DEFAULT_ADDON_STATE: AddonEnabledState = {
  food: true,
  fitness: true,
  plants: true,
  travel: true,
  'vision-board': true,
  games: true,
  vehicles: true,
  health: true,
  finance: true,
  journal: true,
};

/** Beta default. Paid access can later replace this from server-owned rows. */
export const DEFAULT_ADDON_ENTITLEMENTS: AddonEntitlementState = {
  food: { active: true, source: 'included' },
  fitness: { active: true, source: 'included' },
  plants: { active: true, source: 'included' },
  travel: { active: true, source: 'included' },
  'vision-board': { active: true, source: 'included' },
  games: { active: true, source: 'included' },
  vehicles: { active: true, source: 'included' },
  health: { active: true, source: 'included' },
  finance: { active: true, source: 'included' },
  journal: { active: true, source: 'included' },
};

const ADDON_BY_ID = new Map<AddonId, AddonDefinition>(ADDONS.map((addon) => [addon.id, addon]));
const ADDON_BY_CATEGORY = new Map<string, AddonId>(
  ADDONS.flatMap((addon) => addon.categoryIds.map((categoryId) => [categoryId, addon.id] as const)),
);

export function getAddon(id: AddonId): AddonDefinition {
  const addon = ADDON_BY_ID.get(id);
  if (!addon) throw new Error(`Unknown add-on: ${id}`);
  return addon;
}

export function addonForCategory(categoryId: string): AddonId | undefined {
  return ADDON_BY_CATEGORY.get(categoryId);
}

export function isCategoryEnabled(categoryId: string, enabled: AddonEnabledState): boolean {
  const addonId = addonForCategory(categoryId);
  return addonId ? enabled[addonId] : true;
}

export function isActivityEnabled(
  activity: Pick<Activity, 'categoryId'>,
  enabled: AddonEnabledState,
): boolean {
  return isCategoryEnabled(activity.categoryId, enabled);
}
