import { newUuid } from '@/utils/id';
import { asFiniteNonNegative, asPositiveNumber, formatCompactNumber } from '@/utils/parse';
import {
  canonicalIngredientKey,
  cleanHttpsUrl,
  cleanName,
  cleanOptional,
  formatIngredientTitle,
  nowIso,
} from './todos-normalize';
import { markGuestEdit, queuedMutation } from './todos-helpers';
import type {
  ChecklistIngredientInput,
  Checklist,
  ChecklistPersistedState,
  ChecklistRecipe,
  ChecklistRecipeInput,
  ChecklistTask,
} from './todos-types';

type RecipeSet = (
  partial:
    | Partial<ChecklistPersistedState>
    | ((state: ChecklistPersistedState) => Partial<ChecklistPersistedState>),
) => void;

type RecipeGet = () => ChecklistPersistedState & {
  lists: Checklist[];
};

export type ChecklistRecipeActions = {
  addRecipe: (listId: string, input: ChecklistRecipeInput) => ChecklistRecipe | undefined;
  updateRecipe: (
    id: string,
    patch: Partial<Pick<ChecklistRecipe, 'name' | 'sourceUrl' | 'targetServings'>>,
  ) => void;
  deleteRecipe: (id: string) => void;
  updateIngredient: (id: string, patch: Partial<ChecklistIngredientInput>) => void;
};

export function createChecklistRecipeActions(
  set: RecipeSet,
  get: RecipeGet,
): ChecklistRecipeActions {
  return {
    addRecipe: (listId, input) => {
      const list = get().lists.find((item) => item.id === listId);
      const name = cleanName(input.name);
      const ingredients = input.ingredients.flatMap((ingredient) => {
        const ingredientName = cleanOptional(ingredient.name, 100);
        if (!ingredientName) return [];
        const quantityValue = asFiniteNonNegative(ingredient.quantityValue);
        const quantityText =
          cleanOptional(ingredient.quantityText, 40) ??
          (quantityValue !== undefined
            ? formatCompactNumber(quantityValue)
            : undefined);
        const normalized: ChecklistIngredientInput = {
          name: ingredientName,
          canonicalKey:
            cleanOptional(ingredient.canonicalKey, 120) ??
            canonicalIngredientKey(ingredientName),
          quantityValue,
          quantityText,
          unit: cleanOptional(ingredient.unit, 40),
          preparation: cleanOptional(ingredient.preparation, 80),
          originalText: cleanOptional(ingredient.originalText, 240),
          confidence:
            typeof ingredient.confidence === 'number' &&
            Number.isFinite(ingredient.confidence)
              ? Math.max(0, Math.min(1, ingredient.confidence))
              : undefined,
        };
        return [normalized];
      });
      if (
        !list ||
        list.kind !== 'grocery' ||
        list.role !== 'owner' ||
        !name ||
        ingredients.length === 0
      ) {
        return undefined;
      }

      const now = nowIso();
      const recipePositions = get().recipes
        .filter((recipe) => recipe.listId === listId)
        .flatMap((recipe) =>
          typeof recipe.position === 'number' ? [recipe.position] : [],
        );
      const recipe: ChecklistRecipe = {
        id: newUuid(),
        listId,
        name,
        sourceKind: input.sourceKind === 'image' ? 'image' : 'url',
        sourceUrl: cleanHttpsUrl(input.sourceUrl, 2_000),
        sourceImageUri:
          typeof input.sourceImageUri === 'string' && input.sourceImageUri.trim()
            ? input.sourceImageUri.trim()
            : undefined,
        originalServings: asPositiveNumber(input.originalServings),
        targetServings:
          asPositiveNumber(input.targetServings) ??
          asPositiveNumber(input.originalServings),
        position: recipePositions.length
          ? Math.min(...recipePositions) - 1
          : 0,
        createdAt: now,
        updatedAt: now,
      };
      const tasks: ChecklistTask[] = ingredients.map((ingredient, index) => ({
        id: newUuid(),
        listId,
        recipeId: recipe.id,
        ingredientPosition: index,
        ingredientName: ingredient.name,
        canonicalKey: ingredient.canonicalKey,
        quantityValue: ingredient.quantityValue,
        quantityText: ingredient.quantityText,
        unit: ingredient.unit,
        preparation: ingredient.preparation,
        originalText: ingredient.originalText,
        confidence: ingredient.confidence,
        title: formatIngredientTitle(ingredient),
        completed: false,
        important: false,
        createdAt: now,
        updatedAt: now,
        version: 0,
      }));

      markGuestEdit();
      set((state) => ({
        recipes: [recipe, ...state.recipes],
        tasks: [...tasks, ...state.tasks],
        lists: state.lists.map((item) =>
          item.id === listId ? { ...item, updatedAt: now } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'add_recipe', { recipe, tasks }),
        ],
      }));
      return recipe;
    },

    updateRecipe: (id, patch) => {
      const recipe = get().recipes.find((item) => item.id === id);
      const list = recipe
        ? get().lists.find((item) => item.id === recipe.listId)
        : undefined;
      if (!recipe || !list || list.role !== 'owner') return;
      const name =
        patch.name === undefined ? recipe.name : cleanName(patch.name);
      if (!name) return;
      const updatedAt = nowIso();
      const next: ChecklistRecipe = {
        ...recipe,
        name,
        sourceUrl:
          patch.sourceUrl === undefined
            ? recipe.sourceUrl
            : cleanHttpsUrl(patch.sourceUrl, 2_000),
        targetServings:
          patch.targetServings === undefined
            ? recipe.targetServings
            : asPositiveNumber(patch.targetServings),
        updatedAt,
      };
      markGuestEdit();
      set((state) => ({
        recipes: state.recipes.map((item) => (item.id === id ? next : item)),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'update_recipe', { recipe: next }),
        ],
      }));
    },

    deleteRecipe: (id) => {
      const recipe = get().recipes.find((item) => item.id === id);
      const list = recipe
        ? get().lists.find((item) => item.id === recipe.listId)
        : undefined;
      if (!recipe || !list || list.role !== 'owner') return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        recipes: state.recipes.filter((item) => item.id !== id),
        tasks: state.tasks.filter((task) => task.recipeId !== id),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'delete_recipe', {
            recipeId: id,
            sourceImagePath: recipe.sourceImagePath,
          }),
        ],
      }));
    },

    updateIngredient: (id, patch) => {
      const task = get().tasks.find((item) => item.id === id);
      const list = task
        ? get().lists.find((item) => item.id === task.listId)
        : undefined;
      if (!task?.recipeId || !list || list.role !== 'owner') return;
      const ingredientName =
        patch.name === undefined
          ? task.ingredientName
          : cleanOptional(patch.name, 100);
      if (!ingredientName) return;
      const quantityValue =
        patch.quantityValue === undefined
          ? task.quantityValue
          : asFiniteNonNegative(patch.quantityValue);
      const quantityText =
        patch.quantityText === undefined
          ? task.quantityText
          : cleanOptional(patch.quantityText, 40);
      const updatedAt = nowIso();
      const next: ChecklistTask = {
        ...task,
        ingredientName,
        canonicalKey:
          patch.canonicalKey === undefined
            ? task.canonicalKey ?? canonicalIngredientKey(ingredientName)
            : cleanOptional(patch.canonicalKey, 120) ??
              canonicalIngredientKey(ingredientName),
        quantityValue,
        quantityText,
        unit:
          patch.unit === undefined
            ? task.unit
            : cleanOptional(patch.unit, 40),
        preparation:
          patch.preparation === undefined
            ? task.preparation
            : cleanOptional(patch.preparation, 80),
        originalText:
          patch.originalText === undefined
            ? task.originalText
            : cleanOptional(patch.originalText, 240),
        confidence:
          patch.confidence === undefined
            ? task.confidence
            : typeof patch.confidence === 'number' &&
                Number.isFinite(patch.confidence)
              ? Math.max(0, Math.min(1, patch.confidence))
              : undefined,
        title: formatIngredientTitle({
          name: ingredientName,
          quantityText,
          unit:
            patch.unit === undefined
              ? task.unit
              : cleanOptional(patch.unit, 40),
          preparation:
            patch.preparation === undefined
              ? task.preparation
              : cleanOptional(patch.preparation, 80),
        }),
        updatedAt,
      };
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) => (item.id === id ? next : item)),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'update_ingredient', { task: next }),
        ],
      }));
    },
  };
}
