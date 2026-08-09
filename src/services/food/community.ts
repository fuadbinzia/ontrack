import type { Recipe, UserFoodProfile } from '@/types/food';

import { dietaryPreferenceLabel } from './labels';

/**
 * Community share payload builders (skill hard requirement): allergy and
 * health-preference data is private by default and NEVER enters a post,
 * share payload, or profile preview unless the matching
 * `profile.privacy` flag is explicitly on. Pure and dependency-free so the
 * composer, share sheet, and unit tests share one implementation.
 */

/** Profile data cleared for social surfaces (post cards, profile previews). */
export interface FoodShareProfilePreview {
  /** Present only when `privacy.shareDietaryPreferences` is on. */
  dietaryPreferences: string[];
  /** Present only when `privacy.shareAllergies` is on — names only, never severity or notes. */
  allergies: string[];
}

/** Applies the privacy flags — the only gate between profile and social surfaces. */
export function buildShareProfilePreview(
  profile: UserFoodProfile,
): FoodShareProfilePreview {
  return {
    dietaryPreferences: profile.privacy.shareDietaryPreferences
      ? profile.dietaryPreferences.map(dietaryPreferenceLabel)
      : [],
    allergies: profile.privacy.shareAllergies
      ? profile.allergies.map((entry) => entry.allergen.trim()).filter(Boolean)
      : [],
  };
}

export interface FoodPostDraft {
  caption: string;
  recipeId?: string;
  recipeTitle?: string;
  mediaUris?: string[];
}

/** What actually leaves the composer — no other profile fields ever join it. */
export interface FoodPostPayload {
  caption: string;
  recipeId?: string;
  recipeTitle?: string;
  mediaUris: string[];
  /** Omitted entirely (not just empty) when sharing is off. */
  sharedDietaryPreferences?: string[];
  /** Omitted entirely (not just empty) when sharing is off. */
  sharedAllergies?: string[];
}

/**
 * Composer output. Only the privacy-cleared preview may attach profile data;
 * intolerances, avoided ingredients, notes, and severities never appear.
 */
export function buildFoodPostPayload(
  draft: FoodPostDraft,
  profile: UserFoodProfile,
): FoodPostPayload {
  const preview = buildShareProfilePreview(profile);
  return {
    caption: draft.caption.trim(),
    recipeId: draft.recipeId,
    recipeTitle: draft.recipeTitle?.trim() || undefined,
    mediaUris: draft.mediaUris ?? [],
    ...(profile.privacy.shareDietaryPreferences
      ? { sharedDietaryPreferences: preview.dietaryPreferences }
      : {}),
    ...(profile.privacy.shareAllergies
      ? { sharedAllergies: preview.allergies }
      : {}),
  };
}

/**
 * External share text for a recipe: the recipe's own title/link only —
 * profile data never rides along on a system share.
 */
export function buildRecipeShareMessage(
  recipe: Pick<Recipe, 'title' | 'source'>,
): string {
  const url = recipe.source?.url;
  return url ? `${recipe.title}\n${url}` : `${recipe.title} — via onTrack`;
}
