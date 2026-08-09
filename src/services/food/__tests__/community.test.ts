import {
  buildFoodPostPayload,
  buildRecipeShareMessage,
  buildShareProfilePreview,
} from '@/services/food/community';
import type { UserFoodProfile } from '@/types/food';
import { DEFAULT_FOOD_PRIVACY } from '@/types/food';

function profileWithHealthData(
  privacy: Partial<UserFoodProfile['privacy']> = {},
): UserFoodProfile {
  return {
    dietaryPreferences: ['halal', 'gluten-free'],
    allergies: [
      {
        id: 'allergy-1',
        allergen: 'Peanuts',
        severity: 'severe',
        notes: 'Carries an epinephrine auto-injector.',
      },
      { id: 'allergy-2', allergen: 'Shellfish', severity: 'moderate' },
    ],
    intolerances: ['lactose'],
    avoidedIngredients: ['pork'],
    cuisineLikes: ['Levantine'],
    cuisineDislikes: [],
    nutritionPriorities: ['more protein'],
    privacy: { ...DEFAULT_FOOD_PRIVACY, ...privacy },
  };
}

describe('food community share privacy', () => {
  it('excludes allergy and dietary data from post payloads by default', () => {
    const payload = buildFoodPostPayload(
      {
        caption: 'Tagine night!',
        recipeId: 'recipe-1',
        recipeTitle: 'Chicken Tagine',
      },
      profileWithHealthData(),
    );

    expect(payload).toEqual({
      caption: 'Tagine night!',
      recipeId: 'recipe-1',
      recipeTitle: 'Chicken Tagine',
      mediaUris: [],
    });
    expect('sharedAllergies' in payload).toBe(false);
    expect('sharedDietaryPreferences' in payload).toBe(false);

    // Nothing allergy- or health-shaped may leak through any field.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/peanut/i);
    expect(serialized).not.toMatch(/shellfish/i);
    expect(serialized).not.toMatch(/severe/i);
    expect(serialized).not.toMatch(/epinephrine/i);
    expect(serialized).not.toMatch(/lactose/i);
    expect(serialized).not.toMatch(/halal/i);
  });

  it('keeps the profile preview empty until each flag is explicitly on', () => {
    expect(buildShareProfilePreview(profileWithHealthData())).toEqual({
      dietaryPreferences: [],
      allergies: [],
    });

    expect(
      buildShareProfilePreview(profileWithHealthData({ shareAllergies: true })),
    ).toEqual({
      dietaryPreferences: [],
      allergies: ['Peanuts', 'Shellfish'],
    });

    expect(
      buildShareProfilePreview(
        profileWithHealthData({ shareDietaryPreferences: true }),
      ),
    ).toEqual({
      dietaryPreferences: ['Halal', 'Gluten-Free'],
      allergies: [],
    });
  });

  it('includes only opted-in data, without severities or notes', () => {
    const payload = buildFoodPostPayload(
      { caption: 'Meal prep Sunday.' },
      profileWithHealthData({ shareAllergies: true }),
    );

    expect(payload.sharedAllergies).toEqual(['Peanuts', 'Shellfish']);
    expect('sharedDietaryPreferences' in payload).toBe(false);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/severe/i);
    expect(serialized).not.toMatch(/epinephrine/i);
    expect(serialized).not.toMatch(/lactose/i);
  });

  it('never attaches profile data to external recipe share text', () => {
    expect(
      buildRecipeShareMessage({
        title: 'Chickpea Coconut Curry',
        source: { kind: 'user', url: 'https://example.com/curry' },
      }),
    ).toBe('Chickpea Coconut Curry\nhttps://example.com/curry');
    expect(buildRecipeShareMessage({ title: 'Shakshuka' })).toBe(
      'Shakshuka — via onTrack',
    );
  });
});
