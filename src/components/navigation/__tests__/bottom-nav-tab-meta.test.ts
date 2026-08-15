import { ADDONS } from '@/addons/registry';

import {
  isTrackerRouteEnabled,
  TAB_META,
  trackerCatalogLabel,
} from '../bottom-nav-tab-meta';

describe('bottom-nav-tab-meta eager routes', () => {
  const addonsOff = {
    fitness: false,
    plants: false,
    travel: false,
    'vision-board': false,
    games: false,
    vehicles: false,
    food: false,
    health: false,
    finance: false,
    journal: false,
  };

  it('treats core catalog routes as enabled without addons', () => {
    expect(isTrackerRouteEnabled('profile', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('calendar', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('(today)', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('to-do', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('travel', addonsOff)).toBe(false);
  });

  it('labels the workouts route as Fitness to match the add-on catalog', () => {
    const fitnessAddon = ADDONS.find((addon) => addon.id === 'fitness');

    expect(TAB_META.workouts).toMatchObject({
      label: 'Fitness',
      icon: 'gym',
      href: '/(tabs)/workouts',
    });
    expect(TAB_META.workouts.label).toBe(fitnessAddon?.name);
  });

  it('uses the full Vision Board name in catalogs, not the short rail label', () => {
    expect(TAB_META['vision-board'].label).toBe('Vision');
    expect(trackerCatalogLabel('vision-board')).toBe('Vision Board');
    expect(trackerCatalogLabel('workouts')).toBe('Fitness');
    expect(trackerCatalogLabel('unknown-route')).toBe('unknown-route');
  });
});
