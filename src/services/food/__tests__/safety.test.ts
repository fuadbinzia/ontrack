import {
  assessIngredientSafety,
  buildExclusions,
  exclusionSummary,
  filterRecipesForSevereAllergies,
  filterUnsafeRecipeIdeas,
  filterUnsafeSuggestions,
  foodKeysMatch,
  ingredientAllergyConflict,
  normalizeFoodKey,
  profileHasSafetySignals,
  recipeAllergyConflicts,
  severeAllergenKeys,
  severeAllergyEntriesFromNames,
} from '@/services/food/safety';
import { createEmptyFoodProfile } from '@/store/food-profile';
import type { AllergyEntry, Recipe, UserFoodProfile } from '@/types/food';

function buildRecipe(overrides?: Partial<Recipe>): Recipe {
  return {
    id: 'recipe-test-safety',
    title: 'Test Recipe',
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

function buildProfile(overrides?: Partial<UserFoodProfile>): UserFoodProfile {
  return { ...createEmptyFoodProfile(), ...overrides };
}

const severePeanut: AllergyEntry = {
  id: 'allergy-peanut',
  allergen: 'Peanuts',
  severity: 'severe',
};
const mildDairy: AllergyEntry = {
  id: 'allergy-dairy',
  allergen: 'Dairy',
  severity: 'mild',
};

describe('normalizeFoodKey', () => {
  it('lowercases, strips punctuation, and singularizes', () => {
    expect(normalizeFoodKey('Peanuts')).toBe('peanut');
    expect(normalizeFoodKey('Tree Nuts!')).toBe('tree nut');
    expect(normalizeFoodKey('  Shellfish ')).toBe('shellfish');
  });
});

describe('foodKeysMatch', () => {
  it('matches equal and containing phrases, never empties', () => {
    expect(foodKeysMatch('peanut', 'peanut')).toBe(true);
    expect(foodKeysMatch('peanut butter', 'peanut')).toBe(true);
    expect(foodKeysMatch('peanut', 'egg')).toBe(false);
    expect(foodKeysMatch('', 'peanut')).toBe(false);
  });
});

describe('severeAllergenKeys', () => {
  it('only returns severe entries, normalized', () => {
    expect(severeAllergenKeys([severePeanut, mildDairy])).toEqual(['peanut']);
  });
});

describe('ingredientAllergyConflict', () => {
  it('matches by ingredient name and canonical key', () => {
    expect(
      ingredientAllergyConflict({ name: 'Peanut butter' }, [severePeanut])?.id,
    ).toBe('allergy-peanut');
    expect(
      ingredientAllergyConflict(
        { name: 'Spread', canonicalKey: 'peanut-butter' },
        [severePeanut],
      )?.id,
    ).toBe('allergy-peanut');
    expect(ingredientAllergyConflict({ name: 'Olive oil' }, [severePeanut])).toBeUndefined();
  });
});

describe('recipeAllergyConflicts', () => {
  it('trips on allergen tags at any severity', () => {
    const recipe = buildRecipe({ allergenTags: ['dairy'] });
    expect(recipeAllergyConflicts(recipe, [severePeanut, mildDairy]).map((a) => a.id)).toEqual([
      'allergy-dairy',
    ]);
  });

  it('trips on ingredients when tags are missing', () => {
    const recipe = buildRecipe({
      ingredients: [{ name: 'Roasted peanuts', canonicalKey: 'peanut' }],
    });
    expect(recipeAllergyConflicts(recipe, [severePeanut])).toHaveLength(1);
  });
});

describe('filterRecipesForSevereAllergies', () => {
  const safe = buildRecipe({ id: 'safe', allergenTags: ['dairy'] });
  const tagged = buildRecipe({ id: 'tagged', allergenTags: ['peanut'] });
  const untaggedButUnsafe = buildRecipe({
    id: 'untagged',
    ingredients: [{ name: 'Peanut sauce' }],
  });

  it('drops severe conflicts via tags and ingredients, keeps the rest', () => {
    expect(
      filterRecipesForSevereAllergies([safe, tagged, untaggedButUnsafe], [severePeanut]).map(
        (recipe) => recipe.id,
      ),
    ).toEqual(['safe']);
  });

  it('does not filter for mild/moderate allergies', () => {
    const dairyTagged = buildRecipe({ id: 'dairy', allergenTags: ['dairy'] });
    expect(filterRecipesForSevereAllergies([dairyTagged], [mildDairy])).toHaveLength(1);
  });
});

describe('filterUnsafeSuggestions', () => {
  type Suggestion = { id: string; title: string; ingredients: string[]; tags?: string[] };
  const accessors = {
    ingredientNames: (item: Suggestion) => item.ingredients,
    allergenTags: (item: Suggestion) => item.tags ?? [],
    texts: (item: Suggestion) => [item.title],
  };
  const profile = { allergies: [severePeanut, mildDairy] };

  it('filters a severe allergen present only in an ingredient name, not tags', () => {
    const items: Suggestion[] = [
      { id: 'unsafe', title: 'Satay noodles', ingredients: ['Peanut butter'], tags: [] },
      { id: 'safe', title: 'Herb couscous', ingredients: ['Couscous', 'Parsley'] },
    ];
    expect(filterUnsafeSuggestions(items, profile, accessors).map((i) => i.id)).toEqual(['safe']);
  });

  it('normalizes aliases, plurals, and case', () => {
    const items: Suggestion[] = [
      { id: 'plural', title: 'Bar', ingredients: ['ROASTED PEANUTS'] },
      { id: 'phrase', title: 'Bowl', ingredients: ['crushed peanut brittle'] },
      { id: 'title', title: 'Peanut stew', ingredients: ['Sweet potato'] },
      { id: 'clean', title: 'Fruit salad', ingredients: ['Melon'] },
    ];
    expect(filterUnsafeSuggestions(items, profile, accessors).map((i) => i.id)).toEqual(['clean']);
  });

  it('keeps mild/moderate matches and everything on an allergy-free profile', () => {
    const dairy: Suggestion[] = [{ id: 'dairy', title: 'Parfait', ingredients: ['Greek yogurt'] }];
    expect(filterUnsafeSuggestions(dairy, profile, accessors)).toHaveLength(1);
    expect(filterUnsafeSuggestions(dairy, { allergies: [] }, accessors)).toHaveLength(1);
  });
});

describe('filterUnsafeRecipeIdeas', () => {
  const idea = (id: string, overrides?: Partial<{
    title: string;
    ingredients: { name: string }[];
    missingIngredients: string[];
  }>) => ({
    id,
    title: 'Weeknight bowl',
    ingredients: [{ name: 'Chickpeas' }],
    missingIngredients: [],
    ...overrides,
  });

  it('also drops ideas that would ask the user to buy a severe allergen', () => {
    const items = [
      idea('missing', { missingIngredients: ['peanut oil'] }),
      idea('safe'),
    ];
    expect(filterUnsafeRecipeIdeas(items, [severePeanut]).map((i) => i.id)).toEqual(['safe']);
  });
});

describe('severeAllergyEntriesFromNames', () => {
  it('treats every listed allergen as severe (defensive server-side)', () => {
    expect(severeAllergyEntriesFromNames([' Peanuts ', '', 'Shellfish'])).toEqual([
      { id: 'exclusion-1', allergen: 'Peanuts', severity: 'severe' },
      { id: 'exclusion-2', allergen: 'Shellfish', severity: 'severe' },
    ]);
  });
});

describe('buildExclusions', () => {
  it('collects allergens (any severity), dietary labels, and avoided + intolerances', () => {
    const profile = buildProfile({
      dietaryPreferences: ['halal', 'gluten-free'],
      allergies: [severePeanut, mildDairy],
      intolerances: ['lactose'],
      avoidedIngredients: ['pork', 'gelatin'],
    });
    expect(buildExclusions(profile)).toEqual({
      allergens: ['Peanuts', 'Dairy'],
      dietary: ['Halal', 'Gluten-Free'],
      avoided: ['pork', 'gelatin', 'lactose'],
    });
  });

  it('dedupes case/plural variants and returns empty arrays for an empty profile', () => {
    const profile = buildProfile({
      avoidedIngredients: ['Pork', 'porks'],
    });
    expect(buildExclusions(profile).avoided).toEqual(['Pork']);
    expect(buildExclusions(buildProfile())).toEqual({
      allergens: [],
      dietary: [],
      avoided: [],
    });
  });
});

describe('exclusionSummary', () => {
  it('renders the visible "Halal • No Peanuts" line', () => {
    const profile = buildProfile({
      dietaryPreferences: ['halal'],
      allergies: [severePeanut],
      avoidedIngredients: ['shellfish'],
    });
    expect(exclusionSummary(profile)).toBe('Halal • No Peanuts • No Shellfish');
  });

  it('returns an empty string for an empty profile (no implied safety)', () => {
    expect(exclusionSummary(buildProfile())).toBe('');
  });
});

describe('assessIngredientSafety', () => {
  const profile = buildProfile({
    allergies: [severePeanut, mildDairy],
    intolerances: ['lactose'],
    avoidedIngredients: ['gelatin'],
  });

  it('returns allergy severity with a reason', () => {
    expect(assessIngredientSafety('peanut oil', profile)).toEqual({
      level: 'severe',
      reason: 'Matches your severe Peanuts allergy.',
    });
    expect(assessIngredientSafety('Dairy solids', profile).level).toBe('mild');
  });

  it('flags intolerances and avoided ingredients as avoided, not allergy', () => {
    expect(assessIngredientSafety('Lactose', profile).level).toBe('avoided');
    expect(assessIngredientSafety('beef gelatin', profile).level).toBe('avoided');
  });

  it('states no conflict only when the profile has data', () => {
    const result = assessIngredientSafety('Saffron', profile);
    expect(result.level).toBe('none');
    expect(result.reason).toMatch(/no conflicts/i);
  });

  it('makes no safety claim for an empty profile', () => {
    const empty = buildProfile();
    expect(profileHasSafetySignals(empty)).toBe(false);
    const result = assessIngredientSafety('Peanut butter cups', empty);
    expect(result.level).toBe('unknown');
    expect(result.reason).not.toMatch(/no conflict|safe/i);
  });
});
