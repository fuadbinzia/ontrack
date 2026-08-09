import type {
  AllergyEntry,
  AllergySeverity,
  Recipe,
  RecipeIngredient,
  UserFoodProfile,
} from '@/types/food';

import { dietaryPreferenceLabel } from './labels';

/**
 * Canonical Food safety module (skill hard requirement). Severe allergens are
 * injected as exclusions into every AI request AND filtered from results
 * before render — on the client and again on the server (defense in depth).
 * Pure and dependency-free so Expo API routes, screens, and unit tests share
 * exactly one implementation.
 */

// ── Food key normalization ─────────────────────────────────────────────

/** 'Tree Nuts' / 'Peanuts' → 'tree nut' / 'peanut': lowercase, alphanumeric words, naive singular. */
export function normalizeFoodKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ');
}

/** Normalized-key match: equal, or one phrase contains the other ("peanut butter"). */
export function foodKeysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function severeAllergenKeys(
  allergies: readonly AllergyEntry[],
): string[] {
  return allergies
    .filter((entry) => entry.severity === 'severe')
    .map((entry) => normalizeFoodKey(entry.allergen))
    .filter(Boolean);
}

// ── Recipe conflicts (any severity — used for warnings, not filtering) ──

/** First profile allergy this ingredient matches (name or canonical key). */
export function ingredientAllergyConflict(
  ingredient: RecipeIngredient,
  allergies: readonly AllergyEntry[],
): AllergyEntry | undefined {
  const keys = [
    normalizeFoodKey(ingredient.name),
    ingredient.canonicalKey ? normalizeFoodKey(ingredient.canonicalKey) : '',
  ].filter(Boolean);
  return allergies.find((entry) => {
    const allergenKey = normalizeFoodKey(entry.allergen);
    return keys.some((key) => foodKeysMatch(key, allergenKey));
  });
}

/** Profile allergies (any severity) the recipe trips via tags or ingredients. */
export function recipeAllergyConflicts(
  recipe: Recipe,
  allergies: readonly AllergyEntry[],
): AllergyEntry[] {
  const tagKeys = recipe.allergenTags.map(normalizeFoodKey);
  return allergies.filter((entry) => {
    const allergenKey = normalizeFoodKey(entry.allergen);
    if (tagKeys.some((tag) => foodKeysMatch(tag, allergenKey))) return true;
    return recipe.ingredients.some(
      (ingredient) => ingredientAllergyConflict(ingredient, [entry]) != null,
    );
  });
}

// ── Suggestion hard filter (severe allergies only) ──────────────────────

export interface UnsafeSuggestionAccessors<T> {
  /** Ingredient display names / free text scanned for severe allergens. */
  ingredientNames: (item: T) => readonly string[];
  /** Explicit allergen tags when the shape carries them. */
  allergenTags?: (item: T) => readonly string[];
  /** Extra copy also scanned (titles like "Peanut satay noodles"). */
  texts?: (item: T) => readonly string[];
}

/**
 * Suggestion-surface hard filter: anything matching a SEVERE profile allergy
 * (tags, ingredient names, or title copy) is never rendered as a suggestion.
 * Generic over recipes and AI suggestions.
 */
export function filterUnsafeSuggestions<T>(
  items: readonly T[],
  profile: Pick<UserFoodProfile, 'allergies'>,
  accessors: UnsafeSuggestionAccessors<T>,
): T[] {
  const severe = severeAllergenKeys(profile.allergies);
  if (severe.length === 0) return [...items];
  const trips = (value: string) => {
    const key = normalizeFoodKey(value);
    return severe.some((allergen) => foodKeysMatch(key, allergen));
  };
  return items.filter((item) => {
    if (accessors.allergenTags?.(item).some(trips)) return false;
    if (accessors.ingredientNames(item).some(trips)) return false;
    if (accessors.texts?.(item).some(trips)) return false;
    return true;
  });
}

/**
 * Recipes matching a SEVERE allergy (allergen tags or ingredients) are never
 * rendered as suggestions. Thin preset over `filterUnsafeSuggestions`.
 */
export function filterRecipesForSevereAllergies(
  recipes: readonly Recipe[],
  allergies: readonly AllergyEntry[],
): Recipe[] {
  return filterUnsafeSuggestions(recipes, { allergies: [...allergies] }, {
    allergenTags: (recipe) => recipe.allergenTags,
    ingredientNames: (recipe) =>
      recipe.ingredients.flatMap((ingredient) =>
        ingredient.canonicalKey
          ? [ingredient.name, ingredient.canonicalKey]
          : [ingredient.name],
      ),
  });
}

/**
 * AI suggestion preset: title + suggested + missing ingredients all count —
 * a severe allergen must never even be recommended as a purchase.
 */
export function filterUnsafeRecipeIdeas<
  T extends {
    title: string;
    ingredients: readonly { name: string }[];
    missingIngredients: readonly string[];
  },
>(items: readonly T[], allergies: readonly AllergyEntry[]): T[] {
  return filterUnsafeSuggestions(items, { allergies: [...allergies] }, {
    ingredientNames: (item) => [
      ...item.ingredients.map((ingredient) => ingredient.name),
      ...item.missingIngredients,
    ],
    texts: (item) => [item.title],
  });
}

/**
 * Defensive server-side reconstruction: request payloads carry allergen names
 * without severities, so every listed allergen is treated as severe.
 */
export function severeAllergyEntriesFromNames(
  allergens: readonly string[],
): AllergyEntry[] {
  return allergens
    .map((allergen) => allergen.trim())
    .filter(Boolean)
    .map((allergen, index) => ({
      id: `exclusion-${index + 1}`,
      allergen,
      severity: 'severe' as const,
    }));
}

// ── Exclusions injected into every AI request ────────────────────────────

export interface FoodExclusions {
  /** Every profile allergy name, any severity — the AI must avoid them all. */
  allergens: string[];
  /** Human dietary labels ("Halal", "Gluten-Free"). */
  dietary: string[];
  /** Avoided ingredients + intolerances. */
  avoided: string[];
}


function dedupeTrimmed(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeFoodKey(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/** What gets injected into every AI request for this profile. */
export function buildExclusions(profile: UserFoodProfile): FoodExclusions {
  return {
    allergens: dedupeTrimmed(profile.allergies.map((entry) => entry.allergen)),
    dietary: profile.dietaryPreferences.map(dietaryPreferenceLabel),
    avoided: dedupeTrimmed([
      ...profile.avoidedIngredients,
      ...profile.intolerances,
    ]),
  };
}

/**
 * Visible exclusions line required by the AI-ideas spec:
 * "Halal • No Peanuts • No Shellfish". Empty profile → '' (screens show a
 * measured caveat instead of implying safety certainty).
 */
export function exclusionSummary(profile: UserFoodProfile): string {
  const { allergens, dietary, avoided } = buildExclusions(profile);
  const noLabel = (value: string) =>
    `No ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  return [
    ...dietary,
    ...allergens.map(noLabel),
    ...avoided.map(noLabel),
  ].join(' • ');
}

// ── Per-ingredient assessment (scanner + ingredient screens) ─────────────

export type IngredientSafetyLevel =
  | AllergySeverity
  /** Matches an avoided ingredient or intolerance — preference, not allergy. */
  | 'avoided'
  /** Profile has data and nothing matched. */
  | 'none'
  /** Profile carries no safety data — no claim either way. */
  | 'unknown';

export interface IngredientSafetyAssessment {
  level: IngredientSafetyLevel;
  reason: string;
}

/** True when the profile has any data an ingredient can be checked against. */
export function profileHasSafetySignals(profile: UserFoodProfile): boolean {
  return (
    profile.allergies.length > 0 ||
    profile.intolerances.length > 0 ||
    profile.avoidedIngredients.length > 0
  );
}

/**
 * Severity + reason for one ingredient name against the profile. An empty
 * profile returns `unknown` — never a false "safe" claim.
 */
export function assessIngredientSafety(
  ingredientName: string,
  profile: UserFoodProfile,
): IngredientSafetyAssessment {
  const key = normalizeFoodKey(ingredientName);
  const allergy = profile.allergies.find((entry) =>
    foodKeysMatch(key, normalizeFoodKey(entry.allergen)),
  );
  if (allergy) {
    return {
      level: allergy.severity,
      reason: `Matches your ${allergy.severity} ${allergy.allergen.trim()} allergy.`,
    };
  }
  const intolerance = profile.intolerances.find((entry) =>
    foodKeysMatch(key, normalizeFoodKey(entry)),
  );
  if (intolerance) {
    return {
      level: 'avoided',
      reason: `Listed in your intolerances (${intolerance.trim()}).`,
    };
  }
  const avoided = profile.avoidedIngredients.find((entry) =>
    foodKeysMatch(key, normalizeFoodKey(entry)),
  );
  if (avoided) {
    return {
      level: 'avoided',
      reason: `On your avoided-ingredients list (${avoided.trim()}).`,
    };
  }
  if (!profileHasSafetySignals(profile)) {
    return {
      level: 'unknown',
      reason: 'Add allergies and preferences to personalize this check.',
    };
  }
  return {
    level: 'none',
    reason: 'No conflicts with your saved allergies and preferences.',
  };
}
