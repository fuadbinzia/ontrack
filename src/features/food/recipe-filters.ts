import type { AppIconName } from '@/design-system';
import type { Recipe } from '@/types/food';

import { foodTestIdSlug } from './food-slug';

/** Pure recipe browse helpers (filter chips, search, categories). */

export type RecipeFilterId =
  | 'all'
  | 'quick'
  | 'healthy'
  | 'halal'
  | 'kosher'
  | 'vegetarian'
  | 'vegan'
  | 'high-protein'
  | 'saved';

export const RECIPE_FILTERS: readonly {
  id: RecipeFilterId;
  label: string;
  icon?: AppIconName;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'quick', label: 'Quick', icon: 'timer' },
  { id: 'healthy', label: 'Healthy', icon: 'nutrition' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'high-protein', label: 'High Protein' },
  { id: 'saved', label: 'Saved', icon: 'favorite' },
];

export function recipeTotalMinutes(recipe: Recipe): number | undefined {
  return (
    recipe.totalMinutes ??
    ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined)
  );
}

/** "35 min · Serves 2 · Levantine" caption under a recipe title. */
export function recipeMetaCaption(recipe: Recipe): string {
  const minutes = recipeTotalMinutes(recipe);
  const parts: string[] = [];
  if (minutes) parts.push(`${minutes} min`);
  if (recipe.servings > 0) parts.push(`Serves ${recipe.servings}`);
  if (recipe.cuisine) parts.push(recipe.cuisine);
  return parts.join(' · ');
}

const QUICK_MAX_MINUTES = 30;
/** Simple per-serving heuristic until Phase 5 nutrition scoring lands. */
const HEALTHY_MAX_CALORIES = 500;

export function recipeMatchesFilter(recipe: Recipe, filterId: RecipeFilterId): boolean {
  switch (filterId) {
    case 'all':
      return true;
    case 'quick': {
      const minutes = recipeTotalMinutes(recipe);
      return minutes != null && minutes <= QUICK_MAX_MINUTES;
    }
    case 'healthy':
      return (
        recipe.nutrition?.calories != null &&
        recipe.nutrition.calories <= HEALTHY_MAX_CALORIES
      );
    case 'saved':
      return recipe.isFavorite;
    default:
      return recipe.dietaryTags.includes(filterId);
  }
}

export function applyRecipeFilter(
  recipes: readonly Recipe[],
  filterId: RecipeFilterId,
): Recipe[] {
  return recipes.filter((recipe) => recipeMatchesFilter(recipe, filterId));
}

/** Case-insensitive match over title, summary, cuisine, and ingredients. */
export function searchRecipes(recipes: readonly Recipe[], query: string): Recipe[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...recipes];
  return recipes.filter((recipe) => {
    const haystack = [
      recipe.title,
      recipe.summary ?? '',
      recipe.cuisine ?? '',
      ...recipe.ingredients.map((ingredient) => ingredient.name),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/** Unique cuisines, alphabetical, for the categories row. */
export function recipeCuisines(recipes: readonly Recipe[]): string[] {
  return [...new Set(recipes.map((recipe) => recipe.cuisine).filter(Boolean))].sort() as string[];
}

/** Slug for `ontrack.food.recipes.category.<key>` testIDs. */
export function cuisineKey(cuisine: string): string {
  return foodTestIdSlug(cuisine);
}

export type RecipeDifficulty = 'Easy' | 'Moderate' | 'Involved';

/** Derived difficulty (Recipe carries no explicit field): time + step count. */
export function recipeDifficulty(recipe: Recipe): RecipeDifficulty {
  const minutes = recipeTotalMinutes(recipe);
  const steps = recipe.steps.length;
  if ((minutes == null || minutes <= 30) && steps <= 4) return 'Easy';
  if (minutes != null && minutes > 60) return 'Involved';
  return 'Moderate';
}
