/**
 * `food-demo` hydration + purge for the four Food stores. Lazy requires keep
 * agent-ui unit tests free of Zustand/AsyncStorage.
 */

function loadFoodDemoDeps() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const foodFixtures =
    require('@/features/food/fixtures') as typeof import('@/features/food/fixtures');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const foodSeed =
    require('@/features/food/food-seed') as typeof import('@/features/food/food-seed');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useFoodProfile } =
    require('@/store/food-profile') as typeof import('@/store/food-profile');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePantry } =
    require('@/store/food-pantry') as typeof import('@/store/food-pantry');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRecipes } =
    require('@/store/food-recipes') as typeof import('@/store/food-recipes');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useMealPlan } =
    require('@/store/food-meal-plan') as typeof import('@/store/food-meal-plan');
  return { foodFixtures, foodSeed, useFoodProfile, usePantry, useRecipes, useMealPlan };
}

/** Fill the four food stores from `@/features/food/fixtures` (incl. profile). */
export function seedFoodDemoStores(): { recipeId: string } {
  const { foodSeed } = loadFoodDemoDeps();
  return foodSeed.plantFoodLibrary({ includeProfile: true, mode: 'upsert' });
}

/**
 * Strip `food-demo` data from the four food stores (fixture ids only), then
 * re-plant the shared default library so leaving Dev Mode does not hand the
 * user an empty Food tab. Only the fixture diet/allergy profile really goes.
 */
export function purgeFoodDemoFixtures(): void {
  const {
    foodFixtures,
    foodSeed,
    useFoodProfile,
    usePantry,
    useRecipes,
    useMealPlan,
  } = loadFoodDemoDeps();

  for (const recipeId of Object.values(foodFixtures.FOOD_FIXTURE_RECIPE_IDS)) {
    useRecipes.getState().removeRecipe(recipeId);
  }
  for (const itemId of Object.values(foodFixtures.FOOD_FIXTURE_PANTRY_IDS)) {
    usePantry.getState().removeItem(itemId);
  }
  for (const entry of useMealPlan.getState().entries) {
    if (entry.id.startsWith('plan-agent-ui-food-')) {
      useMealPlan.getState().removeEntry(entry.id);
    }
  }
  // Only reset the profile when it is still the seeded fixture profile —
  // a real user's profile never carries the demo allergy id.
  const { profile } = useFoodProfile.getState();
  if (
    profile.allergies.some(
      (allergy) => allergy.id === foodFixtures.FOOD_FIXTURE_ALLERGY_PEANUT_ID,
    )
  ) {
    useFoodProfile.getState().reset();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const communityData =
    require('@/features/food/community-data') as typeof import('@/features/food/community-data');
  communityData.resetFoodCommunityLocalState();

  useRecipes.getState().setSeeded(false);
  foodSeed.seedFoodIfNeeded();
}
