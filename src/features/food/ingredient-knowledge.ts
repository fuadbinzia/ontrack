import { foodKeysMatch, normalizeFoodKey } from '@/services/food/safety';
import type { IngredientKnowledge, JurisdictionStatus } from '@/types/food';

import { FOOD_FIXTURE_INGREDIENT_KNOWLEDGE } from './fixture-ingredient-knowledge';

/**
 * Local sourced ingredient reference data (name/alias lookup + search).
 * Backed by the reviewed fixture dataset for now; a synced dataset can swap
 * in behind these helpers without touching the screens.
 */
export function ingredientKnowledgeBase(): readonly IngredientKnowledge[] {
  return FOOD_FIXTURE_INGREDIENT_KNOWLEDGE;
}

/** Match by canonical key, name, or alias (normalized: case/plural/punctuation). */
export function findIngredientKnowledge(
  keyOrName: string,
): IngredientKnowledge | undefined {
  const key = normalizeFoodKey(keyOrName);
  if (!key) return undefined;
  return ingredientKnowledgeBase().find((entry) =>
    [entry.canonicalKey, entry.name, ...entry.aliases].some((candidate) =>
      foodKeysMatch(normalizeFoodKey(candidate), key),
    ),
  );
}

/** Substring search over names, aliases, and keys; empty query → everything. */
export function searchIngredientKnowledge(query: string): IngredientKnowledge[] {
  const needle = query.trim().toLowerCase();
  const base = [...ingredientKnowledgeBase()];
  if (!needle) return base;
  return base.filter((entry) =>
    [entry.canonicalKey, entry.name, ...entry.aliases].some((candidate) =>
      candidate.toLowerCase().includes(needle),
    ),
  );
}

/**
 * A jurisdiction status renders ONLY when sourced (`sourceUrl` +
 * `lastReviewedAt`) — never from model output alone. The type already
 * requires both; this guards data arriving from looser sources.
 */
export function renderableJurisdictionStatuses(
  entry: IngredientKnowledge,
): JurisdictionStatus[] {
  return entry.jurisdictionStatuses.filter(
    (status) => Boolean(status.sourceUrl) && Boolean(status.lastReviewedAt),
  );
}
