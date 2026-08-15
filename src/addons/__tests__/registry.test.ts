import {
  ADDONS,
  ALL_ADDONS_ON,
  DEFAULT_ADDON_STATE,
  addonForCategory,
  isActivityEnabled,
  isCategoryEnabled,
} from '../registry';

describe('add-on registry', () => {
  it('starts new installs with the catalog off', () => {
    expect(ADDONS.map((addon) => addon.id)).toEqual([
      'food',
      'fitness',
      'plants',
      'travel',
      'vision-board',
      'games',
      'vehicles',
      'health',
      'finance',
      'journal',
    ]);
    expect(DEFAULT_ADDON_STATE).toEqual({
      food: false,
      fitness: false,
      plants: false,
      travel: false,
      'vision-board': false,
      games: false,
      vehicles: false,
      health: false,
      finance: false,
      journal: false,
    });
    expect(ALL_ADDONS_ON.food).toBe(true);
  });

  it('maps feature categories without affecting core calendar categories', () => {
    expect(addonForCategory('food')).toBe('food');
    expect(addonForCategory('gym')).toBe('fitness');
    expect(addonForCategory('plant')).toBe('plants');
    expect(addonForCategory('appointment')).toBeUndefined();

    const enabled = { ...ALL_ADDONS_ON, food: false };
    expect(isCategoryEnabled('food', enabled)).toBe(false);
    expect(isActivityEnabled({ categoryId: 'food' }, enabled)).toBe(false);
    expect(isActivityEnabled({ categoryId: 'appointment' }, enabled)).toBe(true);
  });
});
