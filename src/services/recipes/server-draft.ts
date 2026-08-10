import type {
  RecipeImportDraft,
  RecipeImportIngredient,
} from './types';

export const MAX_INGREDIENTS = 80;

export function cleanString(value: unknown, limit: number) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, limit)
    : '';
}

export function nullableString(value: unknown, limit: number) {
  const cleaned = cleanString(value, limit);
  return cleaned || null;
}

export function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function confidence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

export function canonicalKey(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function validateRecipeImportDraft(
  value: unknown,
  source: { kind: 'url'; url: string } | { kind: 'image' },
): RecipeImportDraft {
  if (!value || typeof value !== 'object') throw new Error('INVALID_DRAFT');
  const candidate = value as Record<string, unknown>;
  const name = cleanString(candidate.name, 80);
  if (!name || !Array.isArray(candidate.ingredients)) {
    throw new Error('NO_RECIPE_FOUND');
  }
  const ingredients = candidate.ingredients
    .slice(0, MAX_INGREDIENTS)
    .flatMap((raw): RecipeImportIngredient[] => {
      if (!raw || typeof raw !== 'object') return [];
      const ingredient = raw as Record<string, unknown>;
      const ingredientName = cleanString(ingredient.name, 100);
      const originalText = cleanString(ingredient.originalText, 240);
      if (!ingredientName || !originalText) return [];
      const quantityValue =
        ingredient.quantityValue === null
          ? null
          : typeof ingredient.quantityValue === 'number' &&
              Number.isFinite(ingredient.quantityValue) &&
              ingredient.quantityValue >= 0
            ? ingredient.quantityValue
            : null;
      return [{
        name: ingredientName,
        canonicalKey: canonicalKey(
          cleanString(ingredient.canonicalKey, 120) || ingredientName,
        ),
        quantityValue,
        quantityText: nullableString(ingredient.quantityText, 40),
        unit: nullableString(ingredient.unit, 40),
        preparation: nullableString(ingredient.preparation, 80),
        originalText,
        confidence: confidence(ingredient.confidence),
      }];
    });
  if (ingredients.length === 0) throw new Error('NO_RECIPE_FOUND');
  return {
    name,
    sourceKind: source.kind,
    sourceUrl: source.kind === 'url' ? source.url : undefined,
    originalServings: positiveNumber(candidate.originalServings),
    targetServings:
      positiveNumber(candidate.targetServings) ??
      positiveNumber(candidate.originalServings),
    ingredients,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings
          .map((warning) => cleanString(warning, 180))
          .filter(Boolean)
          .slice(0, 12)
      : [],
    confidence: confidence(candidate.confidence),
  };
}
