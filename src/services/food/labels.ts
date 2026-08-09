import type { DietaryPreference, MealType } from '@/types/food';

/** 'gluten-free' → 'Gluten-Free'. */
export function dietaryPreferenceLabel(preference: DietaryPreference): string {
  return preference
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

/** Core meal slots shared by AI ideas, week plan, and add-to-plan sheets. */
export const FOOD_MEAL_TYPE_OPTIONS: readonly {
  value: MealType;
  label: string;
}[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function mealTypeLabel(mealType: MealType): string {
  return (
    FOOD_MEAL_TYPE_OPTIONS.find((option) => option.value === mealType)?.label ??
    mealType.replace('-', ' ')
  );
}

/** Today / Tomorrow for plan day chips; otherwise fall back to `farther`. */
export function planDayRelativeLabel(
  offset: number,
  farther: () => string,
): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return farther();
}
