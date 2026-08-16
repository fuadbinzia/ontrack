import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const foodPrefs = readFileSync(
  resolve(process.cwd(), 'src/app/(tabs)/food/preferences.tsx'),
  'utf8',
);
const foodNutrition = readFileSync(
  resolve(process.cwd(), 'src/app/(tabs)/food/nutrition-profile.tsx'),
  'utf8',
);
const profile = readFileSync(
  resolve(process.cwd(), 'src/app/(tabs)/profile/index.tsx'),
  'utf8',
);
const legacy = readFileSync(
  resolve(process.cwd(), 'src/app/nutrition-profile.tsx'),
  'utf8',
);

it('opens Nutrition from Food preferences, not Profile', () => {
  expect(foodPrefs).toContain("label=\"Nutrition\"");
  expect(foodPrefs).toContain('AgentUiIds.food.preferences.clinical');
  expect(foodPrefs).toContain('/(tabs)/food/nutrition-profile');
  expect(foodPrefs).not.toContain('/(tabs)/profile/nutrition-profile');
  expect(profile).not.toContain('nutrition-profile');
  expect(profile).not.toContain('Add-ons');
});

it('keeps the nutrition form on the Food stack with Food back chrome', () => {
  expect(foodNutrition).toContain('FoodScreen');
  expect(foodNutrition).toContain('FoodHeaderBackButton');
  expect(foodNutrition).toContain('eyebrow="Food"');
  expect(legacy).toContain('/(tabs)/food/nutrition-profile');
});
