import type { Activity, Meal, MealType } from '@/types/models';

/**
 * Read-only selectors over `@/store/schedule` meals for the Food tracker.
 * Meals stay a schedule side-table keyed by `activityId` — never forked here.
 */

export interface ScheduledMeal {
  activity: Activity;
  meal: Meal;
}

interface ScheduleMealsSlice {
  activities: Activity[];
  meals: Meal[];
}

/** Meals scheduled on a date (YYYY-MM-DD), sorted by start time. */
export function selectScheduledMealsForDate(
  state: ScheduleMealsSlice,
  dateKey: string,
): ScheduledMeal[] {
  const activityById = new Map(
    state.activities
      .filter((activity) => activity.date === dateKey)
      .map((activity) => [activity.id, activity]),
  );
  return state.meals
    .flatMap((meal) => {
      const activity = activityById.get(meal.activityId);
      return activity ? [{ activity, meal }] : [];
    })
    .sort((a, b) => a.activity.startMinutes - b.activity.startMinutes);
}

export interface ScheduledMealNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Rows that actually carry logged items (0 = nothing analyzed yet). */
  loggedItemCount: number;
}

/** Macro totals across scheduled meals (from user-corrected `meal.items`). */
export function sumScheduledMealNutrition(
  meals: readonly ScheduledMeal[],
): ScheduledMealNutrition {
  const totals: ScheduledMealNutrition = {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    loggedItemCount: 0,
  };
  for (const { meal } of meals) {
    for (const item of meal.items) {
      totals.calories += item.calories;
      totals.proteinG += item.proteinG;
      totals.carbsG += item.carbsG;
      totals.fatG += item.fatG;
      totals.loggedItemCount += 1;
    }
  }
  return totals;
}

/** Meals on a date grouped by meal type (missing types omitted). */
export function selectScheduledMealsByType(
  state: ScheduleMealsSlice,
  dateKey: string,
): Partial<Record<MealType, ScheduledMeal[]>> {
  const grouped: Partial<Record<MealType, ScheduledMeal[]>> = {};
  for (const entry of selectScheduledMealsForDate(state, dateKey)) {
    (grouped[entry.meal.mealType] ??= []).push(entry);
  }
  return grouped;
}
