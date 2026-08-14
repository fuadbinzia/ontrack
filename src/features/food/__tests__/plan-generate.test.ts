import {
  buildMealPlanGroceryRecipes,
  describeMealPlanGeneration,
} from '@/features/food/plan-generate';
import type { MealPlanEntry, Recipe } from '@/types/food';

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'title'>): Recipe {
  return {
    servings: 2,
    ingredients: [],
    steps: [],
    dietaryTags: [],
    allergenTags: [],
    savedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    ...overrides,
  };
}

const TAGINE = recipe({
  id: 'recipe-tagine',
  title: 'Chicken Tagine',
  servings: 2,
  source: { kind: 'user', url: 'https://example.com/tagine' },
  ingredients: [
    { name: 'Chicken thighs', canonicalKey: 'chicken-thigh', quantityValue: 400, unit: 'g' },
    { name: 'Saffron', quantityText: 'a pinch' },
  ],
});

const PARFAIT = recipe({
  id: 'recipe-parfait',
  title: 'Berry Parfait',
  servings: 1,
  ingredients: [{ name: 'Greek yogurt', quantityValue: 200, unit: 'g' }],
});

function entry(
  id: string,
  recipeId: string | undefined,
  servings: number,
  freeformTitle?: string,
): MealPlanEntry {
  return { id, dateKey: '2026-03-02', mealType: 'dinner', recipeId, servings, freeformTitle };
}

describe('buildMealPlanGroceryRecipes', () => {
  it('aggregates servings per recipe and scales numeric quantities', () => {
    const result = buildMealPlanGroceryRecipes(
      [entry('e1', TAGINE.id, 2), entry('e2', TAGINE.id, 4)],
      [TAGINE],
      [],
    );

    expect(result.recipes).toHaveLength(1);
    const [input] = result.recipes;
    expect(input!.name).toBe('Chicken Tagine');
    expect(input!.sourceUrl).toBe('https://example.com/tagine');
    expect(input!.originalServings).toBe(2);
    expect(input!.targetServings).toBe(6);
    // 400 g for 2 servings → 1200 g for 6.
    expect(input!.ingredients[0]).toMatchObject({
      name: 'Chicken thighs',
      quantityValue: 1200,
    });
    // Unscalable text amounts pass through unchanged.
    expect(input!.ingredients[1]).toMatchObject({
      name: 'Saffron',
      quantityText: 'a pinch',
    });
  });

  it('skips recipes already on the list (by name) and freeform entries', () => {
    const result = buildMealPlanGroceryRecipes(
      [
        entry('e1', TAGINE.id, 2),
        entry('e2', PARFAIT.id, 1),
        entry('e3', undefined, 2, 'Dinner out'),
      ],
      [TAGINE, PARFAIT],
      ['chicken tagine'],
    );

    expect(result.recipes.map((item) => item.name)).toEqual(['Berry Parfait']);
    expect(result.skippedExisting).toEqual(['Chicken Tagine']);
    expect(result.skippedFreeform).toEqual(['Dinner out']);
  });

  it('ignores entries whose recipe no longer exists', () => {
    const result = buildMealPlanGroceryRecipes(
      [entry('e1', 'recipe-gone', 2)],
      [TAGINE],
      [],
    );
    expect(result.recipes).toEqual([]);
  });

  it('describes outcomes without adding anything twice', () => {
    expect(
      describeMealPlanGeneration({
        recipes: [],
        skippedExisting: ['Chicken Tagine'],
        skippedFreeform: [],
      }),
    ).toMatch(/already in the list/i);
    expect(
      describeMealPlanGeneration({ recipes: [], skippedExisting: [], skippedFreeform: [] }),
    ).toMatch(/plan some recipes/i);
  });

  it('uses singular count grammar for one generated meal and ingredient', () => {
    const result = buildMealPlanGroceryRecipes(
      [entry('e1', PARFAIT.id, 1)],
      [PARFAIT],
      [],
    );

    expect(describeMealPlanGeneration(result)).toBe(
      'Added 1 meal (1 ingredient).',
    );
  });

  it('keeps plural count grammar for multiple generated ingredients', () => {
    const result = buildMealPlanGroceryRecipes(
      [entry('e1', TAGINE.id, 2)],
      [TAGINE],
      [],
    );

    expect(describeMealPlanGeneration(result)).toBe(
      'Added 1 meal (2 ingredients).',
    );
  });
});
