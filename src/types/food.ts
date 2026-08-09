import type { MealType, NutrientValue } from './models';

// Reused schedule/nutrition food types — import from here in Food feature code.
export type { FoodItem, Meal, MealType, NutrientValue, NutritionSource } from './models';

// ── Profile ─────────────────────────────────────────────────────────────

export type DietaryPreference =
  | 'halal'
  | 'kosher'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'keto'
  | 'paleo'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'low-sodium'
  | 'low-carb'
  | 'high-protein'
  | 'mediterranean';

export type AllergySeverity = 'mild' | 'moderate' | 'severe';

export interface AllergyEntry {
  id: string;
  allergen: string;
  severity: AllergySeverity;
  notes?: string;
}

export interface FoodPrivacySettings {
  shareAllergies: boolean;
  shareDietaryPreferences: boolean;
  shareMeals: boolean;
}

/** Health data is private by default — every share toggle starts off. */
export const DEFAULT_FOOD_PRIVACY: FoodPrivacySettings = {
  shareAllergies: false,
  shareDietaryPreferences: false,
  shareMeals: false,
};

export interface UserFoodProfile {
  dietaryPreferences: DietaryPreference[];
  allergies: AllergyEntry[];
  intolerances: string[];
  avoidedIngredients: string[];
  cuisineLikes: string[];
  cuisineDislikes: string[];
  /** Free-form priorities, e.g. "more protein", "less sugar". */
  nutritionPriorities: string[];
  privacy: FoodPrivacySettings;
}

// ── Recipes ─────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  /** Normalized ingredient key shared with pantry + ingredient knowledge. */
  canonicalKey?: string;
  quantityValue?: number;
  /** Display quantity when a number alone can't express it ("a pinch"). */
  quantityText?: string;
  unit?: string;
  preparation?: string;
  optional?: boolean;
  substitutes?: string[];
}

export interface RecipeStep {
  index: number;
  instruction: string;
  durationMinutes?: number;
  imageUri?: string;
}

/** Per-serving nutrition; mirrors the meal-analysis macro shape. */
export interface RecipeNutrition {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  nutrients?: NutrientValue[];
}

export type RecipeSourceKind = 'user' | 'ai' | 'import' | 'community';

export interface RecipeSource {
  kind: RecipeSourceKind;
  title?: string;
  /** https: when normalized for sync. */
  url?: string;
  attribution?: string;
}

export interface RecipeSocialMetrics {
  likeCount: number;
  saveCount: number;
  commentCount: number;
}

export interface Recipe {
  id: string;
  title: string;
  summary?: string;
  /** Locally persisted image (via `@/utils/image-persist`). */
  imageUri?: string;
  /** Remote https image. */
  imageUrl?: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition?: RecipeNutrition;
  dietaryTags: string[];
  allergenTags: string[];
  cuisine?: string;
  source?: RecipeSource;
  authorId?: string;
  savedAt: string;
  isFavorite: boolean;
  socialMetrics?: RecipeSocialMetrics;
}

// ── Pantry ──────────────────────────────────────────────────────────────

export type PantryItemSource = 'manual' | 'scan' | 'receipt' | 'recipe';

export interface PantryItem {
  id: string;
  canonicalKey: string;
  displayLabel: string;
  quantityValue?: number;
  unit?: string;
  /** YYYY-MM-DD via `@/utils/date`. */
  bestByDate?: string;
  source: PantryItemSource;
  addedAt: string;
}

// ── Ingredient knowledge (shared reference data) ────────────────────────

export type JurisdictionStatusKind =
  | 'allowed'
  | 'restricted'
  | 'not-approved-for-use'
  | 'banned';

/**
 * Regulatory claims are only renderable when sourced — `sourceUrl` and
 * `lastReviewedAt` are required, never optional.
 */
export interface JurisdictionStatus {
  countryCode: string;
  countryName: string;
  status: JurisdictionStatusKind;
  reason?: string;
  sourceUrl: string;
  lastReviewedAt: string;
}

export interface EvidenceSource {
  title: string;
  url: string;
  accessedAt?: string;
}

export type DietaryCompatibility = Partial<
  Record<DietaryPreference, 'compatible' | 'incompatible' | 'depends'>
>;

export interface IngredientKnowledge {
  canonicalKey: string;
  name: string;
  aliases: string[];
  functionalPurpose?: string;
  /** Measured, non-diagnostic concern notes. */
  concerns: string[];
  allergenTags: string[];
  dietaryCompatibility: DietaryCompatibility;
  jurisdictionStatuses: JurisdictionStatus[];
  /** Preference-compatible alternatives (never medical guarantees). */
  alternatives: string[];
  lastReviewedAt: string;
  sources: EvidenceSource[];
}

// ── Meal plan ───────────────────────────────────────────────────────────

export interface MealPlanEntry {
  id: string;
  /** YYYY-MM-DD via `@/utils/date`. */
  dateKey: string;
  mealType: MealType;
  recipeId?: string;
  freeformTitle?: string;
  servings: number;
}

// ── Community ───────────────────────────────────────────────────────────

/** Community post — never carries allergy or health-profile data. */
export interface FoodPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUri?: string;
  createdAt: string;
  caption: string;
  mediaUris: string[];
  recipeId?: string;
  dietaryTags: string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
}
