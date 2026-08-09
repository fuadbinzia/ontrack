import type { MealType } from '@/types/food';

import type { FoodExclusions } from './safety';

export type FoodErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_IMAGE'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'OFFLINE'
  | 'PROVIDER_FAILURE'
  | 'NOT_CONFIGURED';

// ── AI recipe ideas ─────────────────────────────────────────────────────

export type RecipeIdeaTimeframe = 'quick' | 'standard' | 'relaxed';

export interface RecipeIdeasRequest {
  /** Free-form "what's in your kitchen" text from the user. */
  ingredientsText: string;
  /** Pantry/recent ingredient labels the user opted to include. */
  pantryIngredients: string[];
  mealType?: MealType;
  timeframe?: RecipeIdeaTimeframe;
  /** Profile exclusions injected into every request (`buildExclusions`). */
  exclusions: FoodExclusions;
}

export interface RecipeIdeaIngredient {
  name: string;
  quantityText?: string;
}

export interface RecipeIdeaSuggestion {
  id: string;
  title: string;
  /** Why this suggestion fits the request and the profile. */
  whyItFits: string;
  /** "Uses what you have" — entered/pantry ingredients this idea uses. */
  usesFromAvailable: string[];
  missingIngredients: string[];
  /** Profile conflicts the idea deliberately avoided. */
  conflictsAvoided: string[];
  substitutions: string[];
  ingredients: RecipeIdeaIngredient[];
  steps: string[];
  servings: number;
  totalMinutes?: number;
  confidence: number;
  caveat?: string;
}

export interface RecipeIdeasResponse {
  suggestions: RecipeIdeaSuggestion[];
  /** Echo of the exclusions the server applied. */
  exclusionsApplied: FoodExclusions;
  disclaimer: string;
}

// ── Ingredient scanner ──────────────────────────────────────────────────

export interface IngredientScanRequest {
  imageDataUrl: string;
}

export interface ScannedIngredient {
  name: string;
  /** Per-item OCR/vision confidence, 0..1. */
  confidence: number;
}

export interface IngredientScanAnalysis {
  productName?: string;
  productConfidence: number;
  /** Label-order ingredient list with per-item confidence. */
  ingredients: ScannedIngredient[];
  /** Short neutral observations — never diagnoses. */
  observations: string[];
  overallConfidence: number;
  /**
   * Low OCR confidence — the client MUST route through an editable user
   * correction step before presenting analysis as conclusive.
   */
  reviewRequired: boolean;
  disclaimer: string;
}
