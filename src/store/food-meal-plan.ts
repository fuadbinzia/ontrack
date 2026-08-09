import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type { MealPlanEntry, MealType } from '@/types/food';
import { newId } from '@/utils/id';

const MEAL_TYPE_ORDER: readonly MealType[] = [
  'breakfast',
  'pre-workout',
  'lunch',
  'snack',
  'post-workout',
  'dinner',
];

function mealTypeRank(mealType: MealType): number {
  const index = MEAL_TYPE_ORDER.indexOf(mealType);
  return index === -1 ? MEAL_TYPE_ORDER.length : index;
}

function byDateThenMealType(a: MealPlanEntry, b: MealPlanEntry): number {
  return (
    a.dateKey.localeCompare(b.dateKey) || mealTypeRank(a.mealType) - mealTypeRank(b.mealType)
  );
}

/** Pure helpers — exported for unit tests and screen-side memoization. */
export function selectEntriesForDate(
  entries: readonly MealPlanEntry[],
  dateKey: string,
): MealPlanEntry[] {
  return entries.filter((entry) => entry.dateKey === dateKey).sort(byDateThenMealType);
}

export function selectEntriesForRange(
  entries: readonly MealPlanEntry[],
  startKey: string,
  endKey: string,
): MealPlanEntry[] {
  return entries
    .filter((entry) => entry.dateKey >= startKey && entry.dateKey <= endKey)
    .sort(byDateThenMealType);
}

interface MealPlanState {
  version: 1;
  entries: MealPlanEntry[];
  /** Returns the entry id (input id wins so fixtures can upsert stable keys). */
  addEntry: (input: Omit<MealPlanEntry, 'id'> & { id?: string }) => string;
  removeEntry: (id: string) => void;
  /** Move an entry to another day and/or meal slot. */
  moveEntry: (id: string, dateKey: string, mealType?: MealType) => void;
  entriesForDate: (dateKey: string) => MealPlanEntry[];
  /** Inclusive `YYYY-MM-DD` range, sorted by date then meal order. */
  entriesForRange: (startKey: string, endKey: string) => MealPlanEntry[];
  replaceEntries: (entries: MealPlanEntry[]) => void;
  reset: () => void;
}

export const useMealPlan = create<MealPlanState>()(
  persist(
    (set, get) => ({
      version: 1,
      entries: [],
      addEntry: (input) => {
        const id = input.id ?? newId('meal-plan');
        const entry: MealPlanEntry = { ...input, id };
        set((state) => ({
          entries: [...state.entries.filter((existing) => existing.id !== id), entry],
        }));
        return id;
      },
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),
      moveEntry: (id, dateKey, mealType) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id
              ? { ...entry, dateKey, mealType: mealType ?? entry.mealType }
              : entry,
          ),
        })),
      entriesForDate: (dateKey) => selectEntriesForDate(get().entries, dateKey),
      entriesForRange: (startKey, endKey) =>
        selectEntriesForRange(get().entries, startKey, endKey),
      replaceEntries: (entries) => set({ entries }),
      reset: () => set({ entries: [] }),
    }),
    {
      name: STORAGE_KEYS.foodMealPlan,
      storage: createPersistStorage(),
      partialize: (state) => ({ version: state.version, entries: state.entries }) as MealPlanState,
    },
  ),
);
