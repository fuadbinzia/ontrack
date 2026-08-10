import type {
  RecipeImportDraft,
  RecipeImportIngredient,
} from './types';
import {
  MAX_INGREDIENTS,
  canonicalKey,
  cleanString,
} from './server-draft';

function recipeTypes(value: unknown) {
  const types = Array.isArray(value) ? value : [value];
  return types.some(
    (type) => typeof type === 'string' && type.toLocaleLowerCase() === 'recipe',
  );
}

function findRecipes(value: unknown, found: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => findRecipes(entry, found));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const object = value as Record<string, unknown>;
  if (recipeTypes(object['@type'])) found.push(object);
  if (object['@graph']) findRecipes(object['@graph'], found);
}

export function extractRecipeJsonLd(html: string) {
  const found: Record<string, unknown>[] = [];
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json(?:;[^"']*)?["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      findRecipes(JSON.parse(match[1]), found);
    } catch {
      // A malformed block should not hide another valid schema.org recipe.
    }
  }
  return found.slice(0, 3);
}

const INGREDIENT_UNITS: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'L',
  liter: 'L',
  liters: 'L',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  pint: 'pint',
  pints: 'pint',
  quart: 'quart',
  quarts: 'quart',
  gallon: 'gallon',
  gallons: 'gallon',
};

const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function parseQuantity(value: string) {
  const normalized = Object.entries(UNICODE_FRACTIONS)
    .reduce((result, [fraction, replacement]) =>
      result.replaceAll(fraction, ` ${replacement}`), value)
    .replace(/\s+/g, ' ')
    .trim();
  const mixed = /^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/.exec(normalized);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0
      ? Number(mixed[1]) + Number(mixed[2]) / denominator
      : null;
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(normalized);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function structuredIngredientLine(
  originalText: string,
): RecipeImportIngredient | undefined {
  const cleaned = cleanString(originalText, 240);
  if (!cleaned) return undefined;
  const quantityMatch =
    /^(\d+(?:\.\d+)?(?:\s+(?:\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]))?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])\s+(.+)$/.exec(
      cleaned,
    );
  const quantityText = quantityMatch?.[1] ?? null;
  const quantityValue = quantityText ? parseQuantity(quantityText) : null;
  let remainder = quantityMatch?.[2] ?? cleaned;
  let unit: string | null = null;
  const unitMatch = /^([A-Za-z]+)\.?\s+(.+)$/.exec(remainder);
  if (unitMatch) {
    const normalizedUnit = INGREDIENT_UNITS[unitMatch[1].toLocaleLowerCase()];
    if (normalizedUnit) {
      unit = normalizedUnit;
      remainder = unitMatch[2];
    }
  }
  const ambiguousMatch = /\b(to taste|as needed|for serving)\b/i.exec(
    remainder,
  );
  if (!quantityText && ambiguousMatch) {
    remainder = remainder
      .slice(0, ambiguousMatch.index)
      .replace(/[,(\s]+$/g, '');
  }

  const preparationStart = [remainder.indexOf(','), remainder.indexOf('(')]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  let name =
    preparationStart === undefined
      ? remainder
      : remainder.slice(0, preparationStart);
  let preparation =
    preparationStart === undefined
      ? null
      : remainder
          .slice(preparationStart)
          .replace(/^[,(\s]+/g, '')
          .replace(/[()]+/g, '')
          .trim() || null;
  const sizeMatch = /^(small|medium|med|large|extra-large)\s+(.+)$/i.exec(name);
  if (sizeMatch) {
    name = sizeMatch[2];
    preparation = [sizeMatch[1], preparation].filter(Boolean).join(', ');
  }
  name = cleanString(name, 100);
  if (!name) return undefined;

  return {
    name,
    canonicalKey: canonicalKey(name),
    quantityValue,
    quantityText:
      quantityText ??
      (ambiguousMatch ? ambiguousMatch[1].toLocaleLowerCase() : null),
    unit,
    preparation,
    originalText: cleaned,
    confidence: 0.98,
  };
}

function schemaServings(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  for (const candidate of values) {
    if (typeof candidate === 'number' && candidate > 0) return candidate;
    if (typeof candidate === 'string') {
      const match = /\d+(?:\.\d+)?/.exec(candidate);
      if (match && Number(match[0]) > 0) return Number(match[0]);
    }
  }
  return null;
}

export function draftFromRecipeJsonLd(
  recipes: Record<string, unknown>[],
  sourceUrl: string,
): RecipeImportDraft | undefined {
  for (const recipe of recipes) {
    if (!Array.isArray(recipe.recipeIngredient)) continue;
    const name = cleanString(recipe.name, 80);
    const ingredients = recipe.recipeIngredient
      .flatMap((line) =>
        typeof line === 'string'
          ? [structuredIngredientLine(line)].filter(
              (ingredient): ingredient is RecipeImportIngredient =>
                Boolean(ingredient),
            )
          : [],
      )
      .slice(0, MAX_INGREDIENTS);
    if (!name || ingredients.length === 0) continue;
    const servings = schemaServings(recipe.recipeYield);
    const ambiguousIngredients = ingredients.filter((ingredient) =>
      /\b(?:to taste|as needed|for serving)\b/i.test(ingredient.originalText),
    );
    return {
      name,
      sourceKind: 'url',
      sourceUrl,
      originalServings: servings,
      targetServings: servings,
      ingredients,
      warnings: ambiguousIngredients.length
        ? [
            `${ambiguousIngredients.length} ambiguous ingredient amount${
              ambiguousIngredients.length === 1 ? '' : 's'
            } should be reviewed before saving.`,
          ]
        : [],
      confidence: 0.98,
    };
  }
  return undefined;
}
