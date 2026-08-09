import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useFoodProfile } from '@/store/food-profile';
import { DEFAULT_FOOD_PRIVACY } from '@/types/food';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('food profile store', () => {
  beforeEach(() => {
    useFoodProfile.getState().reset();
  });

  it('starts with everything empty and health sharing off', () => {
    const { profile } = useFoodProfile.getState();
    expect(profile.dietaryPreferences).toEqual([]);
    expect(profile.allergies).toEqual([]);
    expect(profile.privacy).toEqual({
      shareAllergies: false,
      shareDietaryPreferences: false,
      shareMeals: false,
    });
    expect(DEFAULT_FOOD_PRIVACY.shareAllergies).toBe(false);
  });

  it('adds, updates, and removes allergies', () => {
    const id = useFoodProfile.getState().addAllergy({
      allergen: '  Peanuts ',
      severity: 'severe',
      notes: ' Carries an auto-injector. ',
    });
    let entry = useFoodProfile.getState().profile.allergies[0];
    expect(entry).toEqual({
      id,
      allergen: 'Peanuts',
      severity: 'severe',
      notes: 'Carries an auto-injector.',
    });

    useFoodProfile.getState().updateAllergy(id, { severity: 'moderate' });
    entry = useFoodProfile.getState().profile.allergies[0];
    expect(entry?.severity).toBe('moderate');
    expect(entry?.allergen).toBe('Peanuts');

    // Updating an unknown id is a no-op.
    useFoodProfile.getState().updateAllergy('missing', { severity: 'mild' });
    expect(useFoodProfile.getState().profile.allergies).toHaveLength(1);

    // Re-adding with the same id upserts instead of duplicating.
    useFoodProfile.getState().addAllergy({ id, allergen: 'Peanut', severity: 'severe' });
    expect(useFoodProfile.getState().profile.allergies).toHaveLength(1);

    useFoodProfile.getState().removeAllergy(id);
    expect(useFoodProfile.getState().profile.allergies).toEqual([]);
  });

  it('dedupes dietary preferences and merges privacy patches', () => {
    useFoodProfile.getState().setDietaryPreferences(['halal', 'halal', 'vegan']);
    expect(useFoodProfile.getState().profile.dietaryPreferences).toEqual([
      'halal',
      'vegan',
    ]);

    useFoodProfile.getState().setPrivacy({ shareMeals: true });
    expect(useFoodProfile.getState().profile.privacy).toEqual({
      shareAllergies: false,
      shareDietaryPreferences: false,
      shareMeals: true,
    });
  });

  it('updates list fields independently', () => {
    useFoodProfile.getState().setIntolerances(['lactose']);
    useFoodProfile.getState().setAvoidedIngredients(['pork']);
    useFoodProfile.getState().setCuisineLikes(['Moroccan']);
    useFoodProfile.getState().setCuisineDislikes(['heavy cream']);
    useFoodProfile.getState().setNutritionPriorities(['more protein']);
    const { profile } = useFoodProfile.getState();
    expect(profile.intolerances).toEqual(['lactose']);
    expect(profile.avoidedIngredients).toEqual(['pork']);
    expect(profile.cuisineLikes).toEqual(['Moroccan']);
    expect(profile.cuisineDislikes).toEqual(['heavy cream']);
    expect(profile.nutritionPriorities).toEqual(['more protein']);
  });
});
