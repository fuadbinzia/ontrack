import { AppStack } from '@/components/navigation/app-stack';
import { FeatureThemeProvider } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function FoodLayout() {
  return (
    <FeatureThemeProvider feature="food">
      <AppStack>
        <AppStack.Screen name="index" />
      </AppStack>
    </FeatureThemeProvider>
  );
}
