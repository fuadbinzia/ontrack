import { useMealPlan } from '@/store/food-meal-plan';
import { usePantry } from '@/store/food-pantry';
import { useFoodProfile } from '@/store/food-profile';
import { useRecipes } from '@/store/food-recipes';

import {
  FOOD_FIXTURE_RECIPE_IDS,
  buildFoodFixtureMealPlan,
  buildFoodFixturePantry,
  buildFoodFixtureProfile,
  buildFoodFixtureRecipes,
} from './fixtures';

export type PlantFoodLibraryMode = 'empty-only' | 'upsert';

export type PlantFoodLibraryOptions = {
  /** Agent demo plants the severe-allergy fixture profile; install seed does not. */
  includeProfile?: boolean;
  /**
   * `empty-only` — fill stores that are still empty (install seed).
   * `upsert` — force plant recipes/pantry/plan (agent `food-demo`).
   */
  mode?: PlantFoodLibraryMode;
};

/**
 * Shared hydration for the Food demo library. Install seed and agent-ui
 * `food-demo` both go through here so store wiring stays in one place.
 */
export function plantFoodLibrary(
  options: PlantFoodLibraryOptions = {},
): { recipeId: string } {
  const { includeProfile = false, mode = 'empty-only' } = options;

  if (includeProfile) {
    useFoodProfile.getState().replaceProfile(buildFoodFixtureProfile());
  }

  const recipes = useRecipes.getState();
  const pantry = usePantry.getState();
  const mealPlan = useMealPlan.getState();
  const fixtureRecipes = buildFoodFixtureRecipes();
  const fixturePantry = buildFoodFixturePantry();
  const fixturePlan = buildFoodFixtureMealPlan();

  if (mode === 'upsert') {
    for (const recipe of fixtureRecipes) {
      recipes.upsertRecipe(recipe);
    }
    for (const item of fixturePantry) {
      pantry.addItem(item);
    }
    for (const entry of fixturePlan) {
      mealPlan.addEntry(entry);
    }
  } else {
    if (recipes.recipes.length === 0) {
      recipes.replaceRecipes(fixtureRecipes);
    }
    if (pantry.items.length === 0) {
      pantry.replaceItems(fixturePantry);
    }
    if (mealPlan.entries.length === 0) {
      mealPlan.replaceEntries(fixturePlan);
    }
  }

  return { recipeId: FOOD_FIXTURE_RECIPE_IDS.chickenTagine };
}

/**
 * The Food module has no backend yet, so every account opens on the demo
 * library instead of an empty tab. Runs once per install (the `seeded` flag on
 * the recipe store) and never overwrites a store the user has already filled.
 *
 * The fixture dietary/allergy profile is deliberately left out — a planted
 * severe allergy would silently drive real safety filtering.
 */
export function seedFoodIfNeeded(): void {
  const recipes = useRecipes.getState();
  if (recipes.seeded) return;
  recipes.setSeeded(true);
  plantFoodLibrary({ mode: 'empty-only' });
}
