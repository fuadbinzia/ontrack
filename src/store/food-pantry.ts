import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type { PantryItem } from '@/types/food';
import { addDays, isDateKey, todayKey } from '@/utils/date';
import { newId } from '@/utils/id';

interface PantryState {
  version: 1;
  items: PantryItem[];
  /** Returns the item id (input id wins so fixtures can upsert stable keys). */
  addItem: (
    input: Omit<PantryItem, 'id' | 'addedAt'> & { id?: string; addedAt?: string },
  ) => string;
  updateItem: (id: string, patch: Partial<Omit<PantryItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  replaceItems: (items: PantryItem[]) => void;
  /** Items with a best-by date on or before today + `withinDays` (already-expired first). */
  expiringSoon: (withinDays: number) => PantryItem[];
  reset: () => void;
}

/** Pure helper — exported for unit tests and screen-side memoization. */
export function selectExpiringSoon(
  items: readonly PantryItem[],
  withinDays: number,
  today = todayKey(),
): PantryItem[] {
  const cutoff = addDays(today, Math.max(0, Math.floor(withinDays)));
  return items
    .filter(
      (item) =>
        typeof item.bestByDate === 'string' &&
        isDateKey(item.bestByDate) &&
        item.bestByDate <= cutoff,
    )
    .sort((a, b) => a.bestByDate!.localeCompare(b.bestByDate!));
}

export const usePantry = create<PantryState>()(
  persist(
    (set, get) => ({
      version: 1,
      items: [],
      addItem: (input) => {
        const id = input.id ?? newId('pantry');
        const item: PantryItem = {
          id,
          canonicalKey: input.canonicalKey,
          displayLabel: input.displayLabel.trim(),
          quantityValue: input.quantityValue,
          unit: input.unit,
          bestByDate: input.bestByDate,
          source: input.source,
          addedAt: input.addedAt ?? new Date().toISOString(),
        };
        set((state) => ({
          items: [...state.items.filter((existing) => existing.id !== id), item],
        }));
        return id;
      },
      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...patch, id } : item,
          ),
        })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      replaceItems: (items) => set({ items }),
      expiringSoon: (withinDays) => selectExpiringSoon(get().items, withinDays),
      reset: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEYS.foodPantry,
      storage: createPersistStorage(),
      partialize: (state) => ({ version: state.version, items: state.items }) as PantryState,
    },
  ),
);
