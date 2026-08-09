import { fireEvent, render, screen } from '@testing-library/react-native';

import { RecipeCard } from '@/features/food/components/recipe-card';
import { recipeMetaCaption } from '@/features/food/recipe-filters';
import type { Recipe } from '@/types/food';

function buildRecipe(overrides?: Partial<Recipe>): Recipe {
  return {
    id: 'recipe-test-zaatar',
    title: "Za'atar Grain Bowl",
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [],
    steps: [],
    dietaryTags: [],
    allergenTags: [],
    cuisine: 'Levantine',
    savedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    ...overrides,
  };
}

describe('recipeMetaCaption', () => {
  it('sums prep + cook when totalMinutes is missing', () => {
    expect(recipeMetaCaption(buildRecipe())).toBe('35 min · Serves 2 · Levantine');
  });

  it('prefers totalMinutes and omits empty parts', () => {
    expect(
      recipeMetaCaption(
        buildRecipe({
          totalMinutes: 50,
          cuisine: undefined,
          prepMinutes: undefined,
          cookMinutes: undefined,
        }),
      ),
    ).toBe('50 min · Serves 2');
  });
});

describe('RecipeCard', () => {
  it.each(['list', 'grid'] as const)(
    '%s layout renders title + meta and fires onPress',
    (layout) => {
      const onPress = jest.fn();
      const recipe = buildRecipe();
      render(<RecipeCard recipe={recipe} layout={layout} onPress={onPress} />);

      expect(screen.getByText("Za'atar Grain Bowl")).toBeTruthy();
      expect(screen.getByText('35 min · Serves 2 · Levantine')).toBeTruthy();
      fireEvent.press(
        screen.getByTestId('ontrack.food.recipes.card.recipe-test-zaatar'),
      );
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['list', 'grid'] as const)(
    '%s layout favorite heart toggles without pressing the card',
    (layout) => {
      const onPress = jest.fn();
      const onToggleFavorite = jest.fn();
      render(
        <RecipeCard
          recipe={buildRecipe()}
          layout={layout}
          onPress={onPress}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      fireEvent.press(
        screen.getByTestId(
          'ontrack.food.recipes.card.recipe-test-zaatar.favorite',
        ),
      );
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    },
  );

  it('hides the heart when onToggleFavorite is not provided', () => {
    render(
      <RecipeCard recipe={buildRecipe()} layout="list" onPress={jest.fn()} />,
    );
    expect(
      screen.queryByTestId(
        'ontrack.food.recipes.card.recipe-test-zaatar.favorite',
      ),
    ).toBeNull();
  });
});
