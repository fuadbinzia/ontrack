import {
  canonicalIngredientKey,
  type ChecklistIngredientInput,
  type ChecklistTask,
} from '@/store/todos';
import { formatCompactNumber } from '@/utils/parse';

export type CombinedCompletion = 'checked' | 'mixed' | 'unchecked';

export interface CombinedIngredient {
  id: string;
  canonicalKey: string;
  name: string;
  taskIds: string[];
  completedCount: number;
  totalCount: number;
  completion: CombinedCompletion;
  amountFragments: string[];
}

interface UnitDefinition {
  dimension: 'mass' | 'volume' | 'count';
  factor: number;
  label: string;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  g: { dimension: 'mass', factor: 1, label: 'g' },
  gram: { dimension: 'mass', factor: 1, label: 'g' },
  grams: { dimension: 'mass', factor: 1, label: 'g' },
  kg: { dimension: 'mass', factor: 1_000, label: 'kg' },
  kilogram: { dimension: 'mass', factor: 1_000, label: 'kg' },
  kilograms: { dimension: 'mass', factor: 1_000, label: 'kg' },
  oz: { dimension: 'mass', factor: 28.3495, label: 'oz' },
  ounce: { dimension: 'mass', factor: 28.3495, label: 'oz' },
  ounces: { dimension: 'mass', factor: 28.3495, label: 'oz' },
  lb: { dimension: 'mass', factor: 453.592, label: 'lb' },
  lbs: { dimension: 'mass', factor: 453.592, label: 'lb' },
  pound: { dimension: 'mass', factor: 453.592, label: 'lb' },
  pounds: { dimension: 'mass', factor: 453.592, label: 'lb' },
  ml: { dimension: 'volume', factor: 1, label: 'ml' },
  milliliter: { dimension: 'volume', factor: 1, label: 'ml' },
  milliliters: { dimension: 'volume', factor: 1, label: 'ml' },
  l: { dimension: 'volume', factor: 1_000, label: 'L' },
  liter: { dimension: 'volume', factor: 1_000, label: 'L' },
  liters: { dimension: 'volume', factor: 1_000, label: 'L' },
  tsp: { dimension: 'volume', factor: 4.92892, label: 'tsp' },
  teaspoon: { dimension: 'volume', factor: 4.92892, label: 'tsp' },
  teaspoons: { dimension: 'volume', factor: 4.92892, label: 'tsp' },
  tbsp: { dimension: 'volume', factor: 14.7868, label: 'tbsp' },
  tablespoon: { dimension: 'volume', factor: 14.7868, label: 'tbsp' },
  tablespoons: { dimension: 'volume', factor: 14.7868, label: 'tbsp' },
  cup: { dimension: 'volume', factor: 236.588, label: 'cup' },
  cups: { dimension: 'volume', factor: 236.588, label: 'cup' },
  pint: { dimension: 'volume', factor: 473.176, label: 'pint' },
  pints: { dimension: 'volume', factor: 473.176, label: 'pint' },
  quart: { dimension: 'volume', factor: 946.353, label: 'quart' },
  quarts: { dimension: 'volume', factor: 946.353, label: 'quart' },
  gallon: { dimension: 'volume', factor: 3_785.41, label: 'gallon' },
  gallons: { dimension: 'volume', factor: 3_785.41, label: 'gallon' },
  count: { dimension: 'count', factor: 1, label: '' },
  each: { dimension: 'count', factor: 1, label: '' },
  ea: { dimension: 'count', factor: 1, label: '' },
  item: { dimension: 'count', factor: 1, label: '' },
  items: { dimension: 'count', factor: 1, label: '' },
  piece: { dimension: 'count', factor: 1, label: '' },
  pieces: { dimension: 'count', factor: 1, label: '' },
  pc: { dimension: 'count', factor: 1, label: '' },
  pcs: { dimension: 'count', factor: 1, label: '' },
};

function normalizedUnit(value?: string) {
  return value?.trim().toLocaleLowerCase().replace(/\.$/, '');
}

function formatNumber(value: number) {
  return formatCompactNumber(value);
}

function amountForTask(task: ChecklistTask) {
  const amount = task.quantityText?.trim();
  const unit = task.unit?.trim();
  return [amount, unit].filter(Boolean).join(' ') || 'amount not specified';
}

export function buildCombinedIngredients(tasks: ChecklistTask[]): CombinedIngredient[] {
  const groups = new Map<string, ChecklistTask[]>();
  for (const task of tasks) {
    if (!task.recipeId) continue;
    const key =
      task.canonicalKey?.trim() ||
      canonicalIngredientKey(task.ingredientName || task.title);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }

  return [...groups.entries()]
    .map(([canonicalKey, groupTasks]) => {
      const compatible = new Map<
        string,
        { baseValue: number; firstUnit: UnitDefinition }
      >();
      const fragments: string[] = [];

      for (const task of groupTasks) {
        const unitKey = normalizedUnit(task.unit);
        const definition = unitKey ? UNIT_DEFINITIONS[unitKey] : undefined;
        if (
          definition &&
          typeof task.quantityValue === 'number' &&
          Number.isFinite(task.quantityValue)
        ) {
          const current = compatible.get(definition.dimension);
          compatible.set(definition.dimension, {
            baseValue:
              (current?.baseValue ?? 0) +
              task.quantityValue * definition.factor,
            firstUnit: current?.firstUnit ?? definition,
          });
        } else if (
          !unitKey &&
          typeof task.quantityValue === 'number' &&
          Number.isFinite(task.quantityValue)
        ) {
          const definition = UNIT_DEFINITIONS.count;
          const current = compatible.get(definition.dimension);
          compatible.set(definition.dimension, {
            baseValue: (current?.baseValue ?? 0) + task.quantityValue,
            firstUnit: current?.firstUnit ?? definition,
          });
        } else {
          fragments.push(amountForTask(task));
        }
      }

      const compatibleFragments: string[] = [];
      for (const { baseValue, firstUnit } of compatible.values()) {
        const converted = baseValue / firstUnit.factor;
        compatibleFragments.push(
          [formatNumber(converted), firstUnit.label].filter(Boolean).join(' '),
        );
      }

      const completedCount = groupTasks.filter((task) => task.completed).length;
      const totalCount = groupTasks.length;
      return {
        id: `combined:${canonicalKey}`,
        canonicalKey,
        name: groupTasks[0]?.ingredientName || groupTasks[0]?.title || canonicalKey,
        taskIds: groupTasks.map((task) => task.id),
        completedCount,
        totalCount,
        completion:
          completedCount === 0
            ? 'unchecked'
            : completedCount === totalCount
              ? 'checked'
              : 'mixed',
        amountFragments: [...compatibleFragments, ...fragments],
      } satisfies CombinedIngredient;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatScaledQuantity(value: number) {
  const whole = Math.floor(value);
  const fractional = value - whole;
  const denominators = [2, 3, 4, 8, 16];
  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Number.POSITIVE_INFINITY;
  for (const denominator of denominators) {
    const numerator = Math.round(fractional * denominator);
    const error = Math.abs(fractional - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }
  }
  if (bestError > 0.015) return formatNumber(value);
  if (bestNumerator === 0) return String(whole);
  if (bestNumerator === bestDenominator) return String(whole + 1);
  return `${whole > 0 ? `${whole} ` : ''}${bestNumerator}/${bestDenominator}`;
}

export function parseQuantityText(value: string): number | undefined {
  const normalized = value
    .trim()
    .replace('¼', ' 1/4')
    .replace('½', ' 1/2')
    .replace('¾', ' 3/4')
    .replace('⅓', ' 1/3')
    .replace('⅔', ' 2/3')
    .replace(/\s+/g, ' ')
    .trim();
  const mixed = /^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/.exec(normalized);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator > 0) {
      return Number(mixed[1]) + Number(mixed[2]) / denominator;
    }
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(normalized);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator > 0) return Number(fraction[1]) / denominator;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function scaleIngredients(
  ingredients: ChecklistIngredientInput[],
  sourceServings?: number,
  targetServings?: number,
) {
  if (
    !sourceServings ||
    !targetServings ||
    sourceServings <= 0 ||
    targetServings <= 0
  ) {
    return {
      ingredients,
      warnings: ['Enter valid source and target servings to scale quantities.'],
    };
  }
  const factor = targetServings / sourceServings;
  const warnings: string[] = [];
  const scaled = ingredients.map((ingredient) => {
    if (
      typeof ingredient.quantityValue !== 'number' ||
      !Number.isFinite(ingredient.quantityValue)
    ) {
      warnings.push(
        `${ingredient.name}: “${ingredient.quantityText || 'amount not specified'}” was left unchanged.`,
      );
      return ingredient;
    }
    const quantityValue = ingredient.quantityValue * factor;
    return {
      ...ingredient,
      quantityValue,
      quantityText: formatScaledQuantity(quantityValue),
    };
  });
  return { ingredients: scaled, warnings };
}
