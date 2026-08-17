import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
  buildCombinedIngredients,
  formatScaledQuantity,
  parseQuantityText,
  scaleIngredients,
} from '@/features/todos/grocery-utils';
import type { ChecklistTask } from '@/store/todos';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function ingredient(
  id: string,
  name: string,
  quantityValue: number | undefined,
  unit: string | undefined,
  completed = false,
): ChecklistTask {
  return {
    id,
    listId: 'list',
    recipeId: `recipe-${id}`,
    ingredientName: name,
    canonicalKey: name.toLowerCase(),
    quantityValue,
    quantityText:
      quantityValue === undefined ? 'to taste' : String(quantityValue),
    unit,
    originalText: name,
    title: name,
    completed,
    important: false,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
    version: 0,
  };
}

describe('grocery ingredient utilities', () => {
  it('combines compatible units and reports mixed completion', () => {
    const result = buildCombinedIngredients([
      ingredient('a', 'Flour', 1, 'kg', true),
      ingredient('b', 'Flour', 500, 'g'),
      ingredient('c', 'Flour', 2, 'cups'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Flour',
      completion: 'mixed',
      completedCount: 1,
      totalCount: 3,
    });
    expect(result[0].amountFragments).toEqual(['1.5 kg', '2 cup']);
  });

  it('keeps ambiguous amounts unchanged when servings scale', () => {
    const result = scaleIngredients(
      [
        { name: 'Rice', quantityValue: 2, quantityText: '2', unit: 'cups' },
        { name: 'Salt', quantityText: 'to taste' },
      ],
      4,
      6,
    );

    expect(result.ingredients[0]).toMatchObject({
      quantityValue: 3,
      quantityText: '3',
    });
    expect(result.ingredients[1].quantityText).toBe('to taste');
    expect(result.warnings[0]).toContain('left unchanged');
    expect(formatScaledQuantity(1.5)).toBe('1 1/2');
    expect(parseQuantityText('1 1/2')).toBe(1.5);
    expect(parseQuantityText('¾')).toBe(0.75);
    expect(parseQuantityText('to taste')).toBeUndefined();
  });
});
