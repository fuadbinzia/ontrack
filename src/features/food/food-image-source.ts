import type { FoodPost, Recipe } from '@/types/food';

import { FOOD_FIXTURE_RECIPE_IDS } from './fixtures';

/**
 * Fixture recipes carry no photography of their own, so the demo seed would
 * otherwise render every hero, card, and feed item as a bare placeholder.
 * One bundled photo per fixture dish keeps the seed offline-safe, screenshot
 * stable, and matched to the recipe title — nothing here is persisted or synced.
 */
const FIXTURE_RECIPE_IMAGES: Record<string, number> = {
  [FOOD_FIXTURE_RECIPE_IDS.shakshuka]: require('../../../assets/images/seed/food/recipe-shakshuka.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.chickenTagine]: require('../../../assets/images/seed/food/recipe-chicken-tagine.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.lemonSalmon]: require('../../../assets/images/seed/food/recipe-lemon-salmon.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.chickpeaCurry]: require('../../../assets/images/seed/food/recipe-chickpea-curry.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.beefKofta]: require('../../../assets/images/seed/food/recipe-beef-kofta.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.berryParfait]: require('../../../assets/images/seed/food/recipe-berry-parfait.jpg'),
  [FOOD_FIXTURE_RECIPE_IDS.zaatarBowl]: require('../../../assets/images/seed/food/recipe-zaatar-bowl.jpg'),
};

/** Hero/card/detail image for a saved recipe. Pass to `FoodImage source`. */
export function recipeImageSource(recipe: Recipe): string | number | undefined {
  return recipe.imageUri ?? recipe.imageUrl ?? FIXTURE_RECIPE_IMAGES[recipe.id];
}

/**
 * First media item for a community post, falling back to the linked recipe's
 * photo so a fixture post never shows a dish it does not reference.
 */
export function foodPostImageSource(post: FoodPost): string | number | undefined {
  const linked = post.recipeId ? FIXTURE_RECIPE_IMAGES[post.recipeId] : undefined;
  return post.mediaUris[0] ?? linked;
}
