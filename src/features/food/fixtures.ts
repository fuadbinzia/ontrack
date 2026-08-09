import type {
  FoodPost,
  MealPlanEntry,
  MealType,
  PantryItem,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  UserFoodProfile,
} from '@/types/food';
import { addDays, todayKey } from '@/utils/date';

/**
 * Deterministic Food fixtures for the `food-demo` agent seed and visual QA.
 * Stable ids (screenshot-stable), synthetic people only, halal + severe
 * peanut-allergy profile so safety filtering is exercised everywhere.
 */

const FIXTURE_ISO = '2026-01-01T00:00:00.000Z';

export const FOOD_FIXTURE_ALLERGY_PEANUT_ID = 'allergy-agent-ui-food-peanut';

export const FOOD_FIXTURE_RECIPE_IDS = {
  shakshuka: 'recipe-agent-ui-food-shakshuka',
  chickenTagine: 'recipe-agent-ui-food-chicken-tagine',
  lemonSalmon: 'recipe-agent-ui-food-lemon-salmon',
  chickpeaCurry: 'recipe-agent-ui-food-chickpea-curry',
  beefKofta: 'recipe-agent-ui-food-beef-kofta',
  berryParfait: 'recipe-agent-ui-food-berry-parfait',
  zaatarBowl: 'recipe-agent-ui-food-zaatar-bowl',
} as const;

export const FOOD_FIXTURE_PANTRY_IDS = {
  chickpeas: 'pantry-agent-ui-food-chickpeas',
  coconutMilk: 'pantry-agent-ui-food-coconut-milk',
  couscous: 'pantry-agent-ui-food-couscous',
  eggs: 'pantry-agent-ui-food-eggs',
  spinach: 'pantry-agent-ui-food-spinach',
  yogurt: 'pantry-agent-ui-food-yogurt',
  tomatoes: 'pantry-agent-ui-food-tomatoes',
  oliveOil: 'pantry-agent-ui-food-olive-oil',
} as const;

const FOOD_FIXTURE_POST_IDS = {
  tagineNight: 'post-agent-ui-food-tagine-night',
  mealPrep: 'post-agent-ui-food-meal-prep',
  curryWin: 'post-agent-ui-food-curry-win',
  parfaitIdea: 'post-agent-ui-food-parfait-idea',
} as const;

function ing(
  name: string,
  canonicalKey: string,
  quantityValue: number,
  unit: string,
  extras?: Partial<RecipeIngredient>,
): RecipeIngredient {
  return { name, canonicalKey, quantityValue, unit, ...extras };
}

function step(index: number, instruction: string, durationMinutes?: number): RecipeStep {
  return { index, instruction, durationMinutes };
}

export function buildFoodFixtureProfile(): UserFoodProfile {
  return {
    dietaryPreferences: ['halal'],
    allergies: [
      {
        id: FOOD_FIXTURE_ALLERGY_PEANUT_ID,
        allergen: 'Peanuts',
        severity: 'severe',
        notes: 'Carries an epinephrine auto-injector.',
      },
    ],
    intolerances: ['lactose (mild)'],
    avoidedIngredients: ['pork', 'gelatin'],
    cuisineLikes: ['Moroccan', 'Levantine', 'Mediterranean'],
    cuisineDislikes: ['heavy cream sauces'],
    nutritionPriorities: ['more protein', 'less added sugar'],
    privacy: {
      shareAllergies: false,
      shareDietaryPreferences: false,
      shareMeals: false,
    },
  };
}

export function buildFoodFixturePantry(anchor = todayKey()): PantryItem[] {
  const item = (
    id: string,
    canonicalKey: string,
    displayLabel: string,
    extras: Partial<PantryItem> = {},
  ): PantryItem => ({
    id,
    canonicalKey,
    displayLabel,
    source: 'manual',
    addedAt: FIXTURE_ISO,
    ...extras,
  });
  return [
    item(FOOD_FIXTURE_PANTRY_IDS.spinach, 'spinach', 'Baby spinach', {
      quantityValue: 1,
      unit: 'bag',
      bestByDate: addDays(anchor, 1),
      source: 'receipt',
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.eggs, 'egg', 'Eggs', {
      quantityValue: 8,
      unit: 'whole',
      bestByDate: addDays(anchor, 3),
      source: 'scan',
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.yogurt, 'greek-yogurt', 'Greek yogurt', {
      quantityValue: 500,
      unit: 'g',
      bestByDate: addDays(anchor, 5),
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.tomatoes, 'tomato', 'Roma tomatoes', {
      quantityValue: 6,
      unit: 'whole',
      bestByDate: addDays(anchor, 6),
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.chickpeas, 'chickpea', 'Canned chickpeas', {
      quantityValue: 2,
      unit: 'can',
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.coconutMilk, 'coconut-milk', 'Coconut milk', {
      quantityValue: 1,
      unit: 'can',
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.couscous, 'couscous', 'Couscous', {
      quantityValue: 400,
      unit: 'g',
      source: 'recipe',
    }),
    item(FOOD_FIXTURE_PANTRY_IDS.oliveOil, 'olive-oil', 'Olive oil'),
  ];
}

export function buildFoodFixtureRecipes(): Recipe[] {
  const base = {
    savedAt: FIXTURE_ISO,
    isFavorite: false,
    source: { kind: 'user', title: 'Home recipe' } as Recipe['source'],
  };
  return [
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.shakshuka,
      title: 'Skillet Shakshuka',
      summary: 'Eggs poached in a spiced tomato-pepper sauce.',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 20,
      totalMinutes: 30,
      ingredients: [
        ing('Roma tomatoes', 'tomato', 6, 'whole', { preparation: 'diced' }),
        ing('Eggs', 'egg', 4, 'whole'),
        ing('Red bell pepper', 'bell-pepper', 1, 'whole', { preparation: 'sliced' }),
        ing('Onion', 'onion', 1, 'whole', { preparation: 'diced' }),
        ing('Smoked paprika', 'paprika', 1, 'tsp'),
        ing('Olive oil', 'olive-oil', 2, 'tbsp'),
        ing('Feta', 'feta', 40, 'g', { optional: true, substitutes: ['dairy-free feta'] }),
      ],
      steps: [
        step(0, 'Soften onion and pepper in olive oil over medium heat.', 6),
        step(1, 'Add tomatoes and paprika; simmer until thick.', 10),
        step(2, 'Make wells, crack in eggs, cover, and cook until just set.', 6),
        step(3, 'Finish with feta and serve from the pan.'),
      ],
      nutrition: { calories: 380, proteinG: 19, carbsG: 21, fatG: 24, fiberG: 5, sodiumMg: 520 },
      dietaryTags: ['vegetarian', 'gluten-free', 'halal'],
      allergenTags: ['egg', 'dairy'],
      cuisine: 'North African',
      isFavorite: true,
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.chickenTagine,
      title: 'Chicken & Apricot Tagine',
      summary: 'Slow-simmered chicken with apricots, saffron, and warm spices.',
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 50,
      totalMinutes: 65,
      ingredients: [
        ing('Chicken thighs', 'chicken-thigh', 700, 'g', { preparation: 'trimmed' }),
        ing('Dried apricots', 'apricot-dried', 120, 'g'),
        ing('Onion', 'onion', 2, 'whole', { preparation: 'sliced' }),
        ing('Saffron threads', 'saffron', 1, 'pinch', { optional: true }),
        ing('Ras el hanout', 'ras-el-hanout', 2, 'tsp'),
        ing('Couscous', 'couscous', 300, 'g'),
      ],
      steps: [
        step(0, 'Brown chicken in batches; set aside.', 10),
        step(1, 'Cook onions with ras el hanout and saffron until golden.', 8),
        step(2, 'Return chicken with apricots and water; simmer covered.', 40),
        step(3, 'Steam couscous and serve under the tagine.', 10),
      ],
      nutrition: { calories: 540, proteinG: 38, carbsG: 52, fatG: 18, fiberG: 6, sodiumMg: 430 },
      dietaryTags: ['halal', 'dairy-free'],
      allergenTags: ['gluten'],
      cuisine: 'Moroccan',
      isFavorite: true,
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.lemonSalmon,
      title: 'Lemon Herb Salmon',
      summary: 'Roast salmon with lemon, dill, and herbed couscous.',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 15,
      totalMinutes: 25,
      ingredients: [
        ing('Salmon fillets', 'salmon', 2, 'fillet'),
        ing('Lemon', 'lemon', 1, 'whole', { preparation: 'sliced' }),
        ing('Fresh dill', 'dill', 2, 'tbsp', { preparation: 'chopped' }),
        ing('Couscous', 'couscous', 150, 'g'),
        ing('Olive oil', 'olive-oil', 1, 'tbsp'),
      ],
      steps: [
        step(0, 'Roast salmon with lemon slices and oil at 220°C.', 12),
        step(1, 'Hydrate couscous in hot water; fluff with dill.', 8),
        step(2, 'Rest the fish briefly, then plate over couscous.'),
      ],
      nutrition: { calories: 520, proteinG: 40, carbsG: 38, fatG: 22, fiberG: 3, sodiumMg: 310 },
      dietaryTags: ['pescatarian', 'dairy-free', 'high-protein'],
      allergenTags: ['fish', 'gluten'],
      cuisine: 'Mediterranean',
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.chickpeaCurry,
      title: 'Chickpea Coconut Curry',
      summary: 'Weeknight coconut curry with chickpeas and spinach.',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      totalMinutes: 35,
      ingredients: [
        ing('Canned chickpeas', 'chickpea', 2, 'can', { preparation: 'drained' }),
        ing('Coconut milk', 'coconut-milk', 1, 'can'),
        ing('Baby spinach', 'spinach', 120, 'g'),
        ing('Curry powder', 'curry-powder', 2, 'tbsp'),
        ing('Tomatoes', 'tomato', 3, 'whole', { preparation: 'chopped' }),
        ing('Basmati rice', 'rice-basmati', 300, 'g'),
      ],
      steps: [
        step(0, 'Bloom curry powder in oil, then add tomatoes.', 6),
        step(1, 'Add chickpeas and coconut milk; simmer to thicken.', 15),
        step(2, 'Wilt in spinach off the heat and serve over rice.', 4),
      ],
      nutrition: { calories: 480, proteinG: 15, carbsG: 62, fatG: 20, fiberG: 11, sodiumMg: 390 },
      dietaryTags: ['vegan', 'gluten-free', 'dairy-free', 'halal'],
      allergenTags: [],
      cuisine: 'Indian',
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.beefKofta,
      title: 'Beef Kofta Skewers',
      summary: 'Grilled spiced beef skewers with yogurt-mint sauce.',
      servings: 4,
      prepMinutes: 20,
      cookMinutes: 12,
      totalMinutes: 32,
      ingredients: [
        ing('Ground beef', 'beef-ground', 600, 'g'),
        ing('Onion', 'onion', 1, 'whole', { preparation: 'grated' }),
        ing('Parsley', 'parsley', 3, 'tbsp', { preparation: 'chopped' }),
        ing('Baharat', 'baharat', 2, 'tsp'),
        ing('Greek yogurt', 'greek-yogurt', 200, 'g'),
        ing('Mint', 'mint', 1, 'tbsp', { preparation: 'chopped' }),
      ],
      steps: [
        step(0, 'Knead beef with onion, parsley, and baharat; shape onto skewers.', 15),
        step(1, 'Grill over high heat, turning once.', 10),
        step(2, 'Stir mint into yogurt and serve alongside.'),
      ],
      nutrition: { calories: 450, proteinG: 34, carbsG: 8, fatG: 30, fiberG: 1, sodiumMg: 480 },
      dietaryTags: ['halal', 'low-carb', 'high-protein'],
      allergenTags: ['dairy'],
      cuisine: 'Levantine',
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.berryParfait,
      title: 'Berry Yogurt Parfait',
      summary: 'Layered Greek yogurt, berries, and toasted oats.',
      servings: 1,
      prepMinutes: 5,
      cookMinutes: 0,
      totalMinutes: 5,
      ingredients: [
        ing('Greek yogurt', 'greek-yogurt', 200, 'g'),
        ing('Mixed berries', 'berries-mixed', 100, 'g'),
        ing('Rolled oats', 'oats', 30, 'g', { preparation: 'toasted' }),
        ing('Honey', 'honey', 1, 'tsp', { optional: true }),
      ],
      steps: [
        step(0, 'Toast oats in a dry pan until golden.', 3),
        step(1, 'Layer yogurt, berries, and oats; drizzle honey.'),
      ],
      nutrition: { calories: 320, proteinG: 22, carbsG: 42, fatG: 7, fiberG: 6, sugarG: 22 },
      dietaryTags: ['vegetarian', 'halal'],
      allergenTags: ['dairy', 'gluten'],
      cuisine: 'Breakfast',
    },
    {
      ...base,
      id: FOOD_FIXTURE_RECIPE_IDS.zaatarBowl,
      title: "Za'atar Roast Vegetable Bowl",
      summary: "Roast vegetables and chickpeas over grains with za'atar oil.",
      servings: 2,
      prepMinutes: 15,
      cookMinutes: 30,
      totalMinutes: 45,
      ingredients: [
        ing('Cauliflower', 'cauliflower', 1, 'head', { preparation: 'florets' }),
        ing('Carrots', 'carrot', 3, 'whole', { preparation: 'chunks' }),
        ing('Canned chickpeas', 'chickpea', 1, 'can', { preparation: 'drained' }),
        ing("Za'atar", 'zaatar', 2, 'tbsp'),
        ing('Bulgur', 'bulgur', 150, 'g', { substitutes: ['quinoa'] }),
        ing('Olive oil', 'olive-oil', 3, 'tbsp'),
      ],
      steps: [
        step(0, "Toss vegetables and chickpeas with oil and za'atar.", 5),
        step(1, 'Roast at 210°C until charred at the edges.', 28),
        step(2, 'Simmer bulgur, then build bowls and spoon over pan oil.', 12),
      ],
      nutrition: { calories: 430, proteinG: 14, carbsG: 58, fatG: 17, fiberG: 13, sodiumMg: 350 },
      dietaryTags: ['vegan', 'dairy-free', 'halal'],
      allergenTags: ['gluten', 'sesame'],
      cuisine: 'Levantine',
    },
  ];
}

/** One week of entries starting at `anchor` (default today). */
export function buildFoodFixtureMealPlan(anchor = todayKey()): MealPlanEntry[] {
  const r = FOOD_FIXTURE_RECIPE_IDS;
  const week: [MealType, string | undefined, string | undefined][][] = [
    // [mealType, recipeId, freeformTitle] per day, Sunday-relative to anchor.
    [['breakfast', r.berryParfait, undefined], ['dinner', r.chickenTagine, undefined]],
    [['breakfast', r.shakshuka, undefined], ['dinner', r.chickpeaCurry, undefined]],
    [['lunch', r.zaatarBowl, undefined], ['dinner', r.lemonSalmon, undefined]],
    [['breakfast', r.berryParfait, undefined], ['dinner', r.beefKofta, undefined]],
    [['lunch', undefined, 'Leftover tagine'], ['dinner', r.chickpeaCurry, undefined]],
    [['breakfast', r.shakshuka, undefined], ['dinner', r.lemonSalmon, undefined]],
    [['lunch', r.zaatarBowl, undefined], ['dinner', undefined, 'Family dinner out']],
  ];
  return week.flatMap((meals, dayOffset) =>
    meals.map(([mealType, recipeId, freeformTitle]) => ({
      id: `plan-agent-ui-food-${dayOffset}-${mealType}`,
      dateKey: addDays(anchor, dayOffset),
      mealType,
      recipeId,
      freeformTitle,
      servings: 2,
    })),
  );
}

export function buildFoodFixturePosts(): FoodPost[] {
  const post = (
    id: string,
    authorName: string,
    caption: string,
    extras: Partial<FoodPost> = {},
  ): FoodPost => ({
    id,
    authorId: `user-agent-ui-food-${authorName.split(' ')[0]!.toLowerCase()}`,
    authorName,
    createdAt: FIXTURE_ISO,
    caption,
    mediaUris: [],
    dietaryTags: [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    ...extras,
  });
  return [
    post(
      FOOD_FIXTURE_POST_IDS.tagineNight,
      'Alex Rivera',
      'Tagine night — apricots straight from the farmers market.',
      {
        recipeId: FOOD_FIXTURE_RECIPE_IDS.chickenTagine,
        dietaryTags: ['halal'],
        likeCount: 24,
        commentCount: 6,
        likedByMe: true,
      },
    ),
    post(
      FOOD_FIXTURE_POST_IDS.mealPrep,
      'Jordan Lee',
      "Sunday prep: za'atar bowls for the whole week.",
      {
        recipeId: FOOD_FIXTURE_RECIPE_IDS.zaatarBowl,
        dietaryTags: ['vegan'],
        likeCount: 18,
        commentCount: 3,
      },
    ),
    post(
      FOOD_FIXTURE_POST_IDS.curryWin,
      'Casey Morgan',
      'Fifteen-minute chickpea curry actually held up as leftovers.',
      {
        recipeId: FOOD_FIXTURE_RECIPE_IDS.chickpeaCurry,
        dietaryTags: ['vegan', 'gluten-free'],
        likeCount: 31,
        commentCount: 9,
        savedByMe: true,
      },
    ),
    post(
      FOOD_FIXTURE_POST_IDS.parfaitIdea,
      'Riley Chen',
      'Toasting the oats first changes everything.',
      {
        recipeId: FOOD_FIXTURE_RECIPE_IDS.berryParfait,
        dietaryTags: ['vegetarian'],
        likeCount: 12,
        commentCount: 2,
      },
    ),
  ];
}


export {
  buildFoodFixtureRecipeIdeas,
  buildFoodFixtureScanResult,
} from './fixture-ai-fallbacks';
export { FOOD_FIXTURE_INGREDIENT_KNOWLEDGE } from './fixture-ingredient-knowledge';
