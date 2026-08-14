import { scaleIngredients } from '@/features/todos/grocery-utils';
import type { TodoIngredientInput, TodoRecipeInput } from '@/store/todos';
import type { MealPlanEntry, Recipe, RecipeIngredient } from '@/types/food';
import { formatCount } from '@/utils/grammar';

/**
 * "Generate from meal plan" bridge: turns a week of `useMealPlan` entries
 * into `TodoRecipeInput`s for the EXISTING grocery list in `@/store/todos`.
 * Pure so the quantity scaling and dedupe rules stay unit-testable — the
 * screen only calls `useTodos.addRecipe` with the result.
 */

export interface MealPlanGroceryResult {
  recipes: TodoRecipeInput[];
  /** Recipe titles already on the list (matched by name) — not re-added. */
  skippedExisting: string[];
  /** Freeform entries ("Dinner out") — nothing to shop for. */
  skippedFreeform: string[];
}

export function toTodoIngredientInputs(
  ingredients: readonly RecipeIngredient[],
): TodoIngredientInput[] {
  return ingredients.map((ingredient) => ({
    name: ingredient.name,
    canonicalKey: ingredient.canonicalKey,
    quantityValue: ingredient.quantityValue,
    quantityText: ingredient.quantityText,
    unit: ingredient.unit,
    preparation: ingredient.preparation,
  }));
}

export function buildMealPlanGroceryRecipes(
  entries: readonly MealPlanEntry[],
  recipes: readonly Recipe[],
  existingRecipeNames: readonly string[],
): MealPlanGroceryResult {
  const existing = new Set(
    existingRecipeNames.map((name) => name.trim().toLowerCase()),
  );
  const servingsByRecipeId = new Map<string, number>();
  const skippedFreeform: string[] = [];

  for (const entry of entries) {
    if (!entry.recipeId) {
      const title = entry.freeformTitle?.trim();
      if (title && !skippedFreeform.includes(title)) skippedFreeform.push(title);
      continue;
    }
    servingsByRecipeId.set(
      entry.recipeId,
      (servingsByRecipeId.get(entry.recipeId) ?? 0) + Math.max(1, entry.servings),
    );
  }

  const result: TodoRecipeInput[] = [];
  const skippedExisting: string[] = [];
  for (const [recipeId, totalServings] of servingsByRecipeId) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe || recipe.ingredients.length === 0) continue;
    if (existing.has(recipe.title.trim().toLowerCase())) {
      skippedExisting.push(recipe.title);
      continue;
    }
    const { ingredients } = scaleIngredients(
      toTodoIngredientInputs(recipe.ingredients),
      recipe.servings,
      totalServings,
    );
    result.push({
      name: recipe.title,
      sourceKind: 'url',
      sourceUrl: recipe.source?.url,
      originalServings: recipe.servings,
      targetServings: totalServings,
      ingredients,
    });
  }

  return { recipes: result, skippedExisting, skippedFreeform };
}

/** One-line confirmation copy for the generate action. */
export function describeMealPlanGeneration(result: MealPlanGroceryResult): string {
  if (result.recipes.length === 0) {
    return result.skippedExisting.length > 0
      ? 'Everything on this week’s plan is already in the list.'
      : 'Nothing to add — plan some recipes first.';
  }
  const ingredientCount = result.recipes.reduce(
    (sum, recipe) => sum + recipe.ingredients.length,
    0,
  );
  const parts = [
    `Added ${formatCount(result.recipes.length, 'meal')} (${formatCount(ingredientCount, 'ingredient')}).`,
  ];
  if (result.skippedExisting.length > 0) {
    parts.push(`Already in the list: ${result.skippedExisting.join(', ')}.`);
  }
  return parts.join(' ');
}
