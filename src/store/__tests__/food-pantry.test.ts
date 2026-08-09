import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { selectExpiringSoon, usePantry } from '@/store/food-pantry';
import type { PantryItem } from '@/types/food';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function item(id: string, bestByDate?: string): PantryItem {
  return {
    id,
    canonicalKey: id,
    displayLabel: id,
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    bestByDate,
  };
}

describe('food pantry store', () => {
  beforeEach(() => {
    usePantry.getState().reset();
  });

  it('adds, updates, and removes items with stable ids', () => {
    const id = usePantry.getState().addItem({
      id: 'pantry-eggs',
      canonicalKey: 'egg',
      displayLabel: 'Eggs',
      quantityValue: 8,
      unit: 'whole',
      source: 'scan',
    });
    expect(id).toBe('pantry-eggs');

    usePantry.getState().updateItem(id, { quantityValue: 4 });
    expect(usePantry.getState().items[0]?.quantityValue).toBe(4);

    // Re-adding the same id upserts instead of duplicating.
    usePantry.getState().addItem({
      id,
      canonicalKey: 'egg',
      displayLabel: 'Eggs (dozen)',
      source: 'manual',
    });
    expect(usePantry.getState().items).toHaveLength(1);
    expect(usePantry.getState().items[0]?.displayLabel).toBe('Eggs (dozen)');

    usePantry.getState().removeItem(id);
    expect(usePantry.getState().items).toHaveLength(0);
  });

  it('generates an id when none is provided', () => {
    const id = usePantry.getState().addItem({
      canonicalKey: 'tomato',
      displayLabel: 'Tomatoes',
      source: 'manual',
    });
    expect(id).toMatch(/^pantry-/);
  });
});

describe('selectExpiringSoon', () => {
  const today = '2026-08-08';

  it('returns only dated items within the window, soonest first', () => {
    const items = [
      item('undated'),
      item('expired', '2026-08-06'),
      item('today', '2026-08-08'),
      item('in-window', '2026-08-11'),
      item('outside', '2026-08-20'),
    ];
    expect(selectExpiringSoon(items, 3, today).map((entry) => entry.id)).toEqual([
      'expired',
      'today',
      'in-window',
    ]);
  });

  it('treats withinDays 0 as "today or earlier" and ignores malformed dates', () => {
    const items = [
      item('today', '2026-08-08'),
      item('tomorrow', '2026-08-09'),
      { ...item('junk'), bestByDate: 'not-a-date' },
    ];
    expect(selectExpiringSoon(items, 0, today).map((entry) => entry.id)).toEqual([
      'today',
    ]);
  });
});
