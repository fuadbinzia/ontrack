import { Redirect } from 'expo-router';

/** Legacy Profile stack path → Food. */
export default function NutritionProfileMovedRedirect() {
  return <Redirect href="/(tabs)/food/nutrition-profile" />;
}
