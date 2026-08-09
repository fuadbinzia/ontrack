import type {
  IngredientScanAnalysis,
  RecipeIdeaSuggestion,
} from '@/services/food/types';

/**
 * Deterministic AI-ideas fallback when the food API is unreachable, so the
 * `food-demo` flow renders offline. Respects the fixture profile (halal,
 * severe peanut allergy) and only uses fixture pantry ingredients.
 */
export function buildFoodFixtureRecipeIdeas(): RecipeIdeaSuggestion[] {
  return [
    {
      id: 'idea-fixture-shakshuka',
      title: 'Spinach & Tomato Shakshuka',
      whyItFits: 'Halal, peanut-free, and built from eggs, tomatoes, and spinach you already have.',
      usesFromAvailable: ['Eggs', 'Roma tomatoes', 'Baby spinach', 'Olive oil'],
      missingIngredients: ['Smoked paprika'],
      conflictsAvoided: ['No peanuts', 'No pork or gelatin'],
      substitutions: ['Any mild chili powder can stand in for smoked paprika.'],
      ingredients: [
        { name: 'Eggs', quantityText: '4' },
        { name: 'Roma tomatoes', quantityText: '5, diced' },
        { name: 'Baby spinach', quantityText: '2 handfuls' },
        { name: 'Olive oil', quantityText: '2 tbsp' },
      ],
      steps: [
        'Simmer tomatoes in olive oil until saucy.',
        'Wilt in spinach, then poach the eggs in wells until just set.',
      ],
      servings: 2,
      totalMinutes: 25,
      confidence: 0.85,
    },
    {
      id: 'idea-fixture-chickpea-couscous',
      title: 'Chickpea Couscous Bowl',
      whyItFits: 'Pantry chickpeas and couscous make a fast halal dinner with no allergy conflicts.',
      usesFromAvailable: ['Canned chickpeas', 'Couscous', 'Olive oil', 'Roma tomatoes'],
      missingIngredients: ['Lemon', 'Fresh parsley'],
      conflictsAvoided: ['No peanuts'],
      substitutions: ['A splash of yogurt can replace the lemon for brightness.'],
      ingredients: [
        { name: 'Canned chickpeas', quantityText: '1 can, drained' },
        { name: 'Couscous', quantityText: '150 g' },
        { name: 'Roma tomatoes', quantityText: '2, chopped' },
        { name: 'Olive oil', quantityText: '2 tbsp' },
      ],
      steps: [
        'Hydrate couscous in hot water.',
        'Warm chickpeas with tomatoes in olive oil and spoon over the couscous.',
      ],
      servings: 2,
      totalMinutes: 20,
      confidence: 0.8,
    },
    {
      id: 'idea-fixture-yogurt-eggs',
      title: 'Turkish-Style Yogurt Eggs',
      whyItFits: 'Uses eggs and Greek yogurt before their best-by dates; naturally peanut-free.',
      usesFromAvailable: ['Eggs', 'Greek yogurt', 'Olive oil'],
      missingIngredients: ['Warm flatbread'],
      conflictsAvoided: ['No peanuts'],
      substitutions: ['Couscous from the pantry works instead of flatbread.'],
      ingredients: [
        { name: 'Eggs', quantityText: '2' },
        { name: 'Greek yogurt', quantityText: '150 g' },
        { name: 'Olive oil', quantityText: '1 tbsp, warmed' },
      ],
      steps: [
        'Poach the eggs.',
        'Spread seasoned yogurt on a plate, top with eggs and warmed olive oil.',
      ],
      servings: 1,
      totalMinutes: 15,
      confidence: 0.7,
      caveat: 'Contains dairy — your profile lists a mild lactose intolerance.',
    },
  ];
}

/**
 * Deterministic scan fallback when the food API is unreachable. Low
 * confidence on purpose (`reviewRequired`) so the mandatory correction step
 * is exercised, with peanut + tartrazine to light up safety + restrictions.
 */
export function buildFoodFixtureScanResult(): IngredientScanAnalysis {
  return {
    productName: 'Crunchy Trail Mix Bar',
    productConfidence: 0.74,
    ingredients: [
      { name: 'Rolled oats', confidence: 0.94 },
      { name: 'Honey', confidence: 0.9 },
      { name: 'Peanuts', confidence: 0.88 },
      { name: 'Dried cranberries', confidence: 0.72 },
      { name: 'Tartrazine', confidence: 0.55 },
      { name: 'Soy lecithin', confidence: 0.62 },
    ],
    observations: [
      'Label text was partially glared; the additive names were hard to read.',
    ],
    overallConfidence: 0.66,
    reviewRequired: true,
    disclaimer:
      'AI reading of a label photo — verify the printed ingredient list before relying on it.',
  };
}
