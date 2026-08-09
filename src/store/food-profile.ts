import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type {
  AllergyEntry,
  DietaryPreference,
  FoodPrivacySettings,
  UserFoodProfile,
} from '@/types/food';
import { DEFAULT_FOOD_PRIVACY } from '@/types/food';
import { newId } from '@/utils/id';

/**
 * Persisted product-facing food profile (diet, allergies, cuisines).
 * Separate from the intentionally memory-only clinical `@/store/nutrition`.
 */
interface FoodProfileState {
  version: 1;
  profile: UserFoodProfile;
  setDietaryPreferences: (preferences: DietaryPreference[]) => void;
  /** Returns the allergy id (input id wins so fixtures can upsert stable keys). */
  addAllergy: (input: Omit<AllergyEntry, 'id'> & { id?: string }) => string;
  updateAllergy: (id: string, patch: Partial<Omit<AllergyEntry, 'id'>>) => void;
  removeAllergy: (id: string) => void;
  setIntolerances: (intolerances: string[]) => void;
  setAvoidedIngredients: (avoidedIngredients: string[]) => void;
  setCuisineLikes: (cuisineLikes: string[]) => void;
  setCuisineDislikes: (cuisineDislikes: string[]) => void;
  setNutritionPriorities: (nutritionPriorities: string[]) => void;
  setPrivacy: (patch: Partial<FoodPrivacySettings>) => void;
  replaceProfile: (profile: UserFoodProfile) => void;
  reset: () => void;
}

export function createEmptyFoodProfile(): UserFoodProfile {
  return {
    dietaryPreferences: [],
    allergies: [],
    intolerances: [],
    avoidedIngredients: [],
    cuisineLikes: [],
    cuisineDislikes: [],
    nutritionPriorities: [],
    privacy: { ...DEFAULT_FOOD_PRIVACY },
  };
}

function patchProfile(
  state: FoodProfileState,
  patch: Partial<UserFoodProfile>,
): Pick<FoodProfileState, 'profile'> {
  return { profile: { ...state.profile, ...patch } };
}

export const useFoodProfile = create<FoodProfileState>()(
  persist(
    (set, get) => ({
      version: 1,
      profile: createEmptyFoodProfile(),
      setDietaryPreferences: (dietaryPreferences) =>
        set((state) => patchProfile(state, { dietaryPreferences: [...new Set(dietaryPreferences)] })),
      addAllergy: (input) => {
        const id = input.id ?? newId('allergy');
        const entry: AllergyEntry = {
          id,
          allergen: input.allergen.trim(),
          severity: input.severity,
          notes: input.notes?.trim() || undefined,
        };
        set((state) =>
          patchProfile(state, {
            allergies: [
              ...state.profile.allergies.filter((item) => item.id !== id),
              entry,
            ],
          }),
        );
        return id;
      },
      updateAllergy: (id, patch) => {
        if (!get().profile.allergies.some((item) => item.id === id)) return;
        set((state) =>
          patchProfile(state, {
            allergies: state.profile.allergies.map((item) =>
              item.id === id ? { ...item, ...patch, id } : item,
            ),
          }),
        );
      },
      removeAllergy: (id) =>
        set((state) =>
          patchProfile(state, {
            allergies: state.profile.allergies.filter((item) => item.id !== id),
          }),
        ),
      setIntolerances: (intolerances) =>
        set((state) => patchProfile(state, { intolerances })),
      setAvoidedIngredients: (avoidedIngredients) =>
        set((state) => patchProfile(state, { avoidedIngredients })),
      setCuisineLikes: (cuisineLikes) =>
        set((state) => patchProfile(state, { cuisineLikes })),
      setCuisineDislikes: (cuisineDislikes) =>
        set((state) => patchProfile(state, { cuisineDislikes })),
      setNutritionPriorities: (nutritionPriorities) =>
        set((state) => patchProfile(state, { nutritionPriorities })),
      setPrivacy: (patch) =>
        set((state) =>
          patchProfile(state, { privacy: { ...state.profile.privacy, ...patch } }),
        ),
      replaceProfile: (profile) => set({ profile }),
      reset: () => set({ profile: createEmptyFoodProfile() }),
    }),
    {
      name: STORAGE_KEYS.foodProfile,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<FoodProfileState>;
        const profile = persisted.profile;
        return {
          ...currentState,
          profile: profile
            ? {
                ...createEmptyFoodProfile(),
                ...profile,
                // Missing privacy fields always resolve to "not shared".
                privacy: { ...DEFAULT_FOOD_PRIVACY, ...profile.privacy },
              }
            : currentState.profile,
        };
      },
      partialize: (state) => ({ version: state.version, profile: state.profile }) as FoodProfileState,
    },
  ),
);
