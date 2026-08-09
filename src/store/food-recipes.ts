import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type { Recipe } from '@/types/food';
import { newId } from '@/utils/id';

/** Recipe fields the app supplies when saving an AI-generated suggestion. */
export type GeneratedRecipeInput = Omit<
  Recipe,
  'id' | 'savedAt' | 'isFavorite' | 'source'
> & {
  id?: string;
  source?: Recipe['source'];
};

interface RecipesState {
  version: 1;
  /** Demo library planted once per install — see `features/food/food-seed`. */
  seeded: boolean;
  recipes: Recipe[];
  setSeeded: (seeded: boolean) => void;
  upsertRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  /** Stamps id/savedAt and an `ai` source, then saves. Returns the id. */
  saveGeneratedRecipe: (input: GeneratedRecipeInput) => string;
  replaceRecipes: (recipes: Recipe[]) => void;
  reset: () => void;
}

export function selectRecipeById(
  recipes: readonly Recipe[],
  id: string,
): Recipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}

export function selectFavoriteRecipes(recipes: readonly Recipe[]): Recipe[] {
  return recipes.filter((recipe) => recipe.isFavorite);
}

export const useRecipes = create<RecipesState>()(
  persist(
    (set) => ({
      version: 1,
      seeded: false,
      recipes: [],
      setSeeded: (seeded) => set({ seeded }),
      upsertRecipe: (recipe) =>
        set((state) => ({
          recipes: [
            ...state.recipes.filter((existing) => existing.id !== recipe.id),
            recipe,
          ],
        })),
      removeRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
        })),
      toggleFavorite: (id) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id ? { ...recipe, isFavorite: !recipe.isFavorite } : recipe,
          ),
        })),
      saveGeneratedRecipe: (input) => {
        const id = input.id ?? newId('recipe');
        const recipe: Recipe = {
          ...input,
          id,
          savedAt: new Date().toISOString(),
          isFavorite: false,
          source: input.source ?? { kind: 'ai', title: 'AI recipe idea' },
        };
        set((state) => ({
          recipes: [
            ...state.recipes.filter((existing) => existing.id !== id),
            recipe,
          ],
        }));
        return id;
      },
      replaceRecipes: (recipes) => set({ recipes }),
      reset: () => set({ recipes: [], seeded: false }),
    }),
    {
      name: STORAGE_KEYS.foodRecipes,
      storage: createPersistStorage(),
      partialize: (state) =>
        ({
          version: state.version,
          seeded: state.seeded,
          recipes: state.recipes,
        }) as RecipesState,
    },
  ),
);
