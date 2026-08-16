import { Redirect } from 'expo-router';

/** Legacy `/nutrition-profile` → Food stack (keeps bottom nav). */
export default function NutritionProfileLegacyRedirect() {
  return <Redirect href="/(tabs)/food/nutrition-profile" />;
}
