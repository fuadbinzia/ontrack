import {
  ADDONS,
  DEFAULT_ADDON_STATE,
  addonForCategory,
  isActivityEnabled,
  isCategoryEnabled,
} from '../registry';

describe('add-on registry', () => {
  it('keeps the beta catalog enabled by default', () => {
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
    });
  });

  it('maps feature categories without affecting core calendar categories', () => {
    expect(addonForCategory('food')).toBe('food');
    expect(addonForCategory('gym')).toBe('fitness');
    expect(addonForCategory('plant')).toBe('plants');
    expect(addonForCategory('appointment')).toBeUndefined();

    const enabled = { ...DEFAULT_ADDON_STATE, food: false };
    expect(isCategoryEnabled('food', enabled)).toBe(false);
    expect(isActivityEnabled({ categoryId: 'food' }, enabled)).toBe(false);
    expect(isActivityEnabled({ categoryId: 'appointment' }, enabled)).toBe(true);
  });
});
