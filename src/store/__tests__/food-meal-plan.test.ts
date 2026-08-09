import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
  selectEntriesForDate,
  selectEntriesForRange,
  useMealPlan,
} from '@/store/food-meal-plan';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('food meal plan store', () => {
  beforeEach(() => {
    useMealPlan.getState().reset();
  });

  it('adds, moves, and removes entries', () => {
    const id = useMealPlan.getState().addEntry({
      id: 'plan-tagine',
      dateKey: '2026-08-10',
      mealType: 'dinner',
      recipeId: 'recipe-tagine',
      servings: 2,
    });
    expect(id).toBe('plan-tagine');

    useMealPlan.getState().moveEntry(id, '2026-08-11', 'lunch');
    expect(useMealPlan.getState().entriesForDate('2026-08-10')).toHaveLength(0);
    expect(useMealPlan.getState().entriesForDate('2026-08-11')[0]).toMatchObject({
      id,
      mealType: 'lunch',
    });

    // Moving without a meal type keeps the current slot.
    useMealPlan.getState().moveEntry(id, '2026-08-12');
    expect(useMealPlan.getState().entriesForDate('2026-08-12')[0]?.mealType).toBe('lunch');

    useMealPlan.getState().removeEntry(id);
    expect(useMealPlan.getState().entries).toHaveLength(0);
  });

  it('sorts a day by meal order', () => {
    const entries = [
      { id: 'a', dateKey: '2026-08-10', mealType: 'dinner' as const, servings: 1 },
      { id: 'b', dateKey: '2026-08-10', mealType: 'breakfast' as const, servings: 1 },
      { id: 'c', dateKey: '2026-08-10', mealType: 'snack' as const, servings: 1 },
      { id: 'd', dateKey: '2026-08-10', mealType: 'lunch' as const, servings: 1 },
    ];
    expect(selectEntriesForDate(entries, '2026-08-10').map((entry) => entry.id)).toEqual([
      'b',
      'd',
      'c',
      'a',
    ]);
  });

  it('range queries are inclusive on both ends and sorted by date then meal', () => {
    const entries = [
      { id: 'before', dateKey: '2026-08-09', mealType: 'dinner' as const, servings: 1 },
      { id: 'start', dateKey: '2026-08-10', mealType: 'dinner' as const, servings: 1 },
      { id: 'mid-b', dateKey: '2026-08-11', mealType: 'dinner' as const, servings: 1 },
      { id: 'mid-a', dateKey: '2026-08-11', mealType: 'breakfast' as const, servings: 1 },
      { id: 'end', dateKey: '2026-08-12', mealType: 'lunch' as const, servings: 1 },
      { id: 'after', dateKey: '2026-08-13', mealType: 'lunch' as const, servings: 1 },
    ];
    expect(
      selectEntriesForRange(entries, '2026-08-10', '2026-08-12').map((entry) => entry.id),
    ).toEqual(['start', 'mid-a', 'mid-b', 'end']);
    expect(selectEntriesForRange(entries, '2026-08-14', '2026-08-15')).toEqual([]);
  });
});
