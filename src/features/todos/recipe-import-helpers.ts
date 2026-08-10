import { getSharedPayloads } from 'expo-sharing';

import type { EditableRecipeIngredient } from '@/features/todos/recipe-ingredient-editor';
import type { RecipeImportIngredient } from '@/services/recipes';
import { newId } from '@/utils/id';

export function withIds(
  ingredients: RecipeImportIngredient[],
): EditableRecipeIngredient[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    id: newId('ingredient'),
  }));
}

export function sharedUrl() {
  const payload = getSharedPayloads().find(
    (item) => item.shareType === 'url' || item.shareType === 'text',
  );
  if (!payload) return undefined;
  if (payload.shareType === 'url' && /^https:\/\//i.test(payload.value.trim())) {
    return payload.value.trim();
  }
  return payload.value.match(/https:\/\/[^\s<>"']+/i)?.[0];
}
