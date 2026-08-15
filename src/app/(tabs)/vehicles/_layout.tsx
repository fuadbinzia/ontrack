import { AppStack } from '@/components/navigation/app-stack';
import { FeatureThemeProvider } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function VehiclesLayout() {
  return (
    <FeatureThemeProvider feature="vehicles">
      <AppStack>
        <AppStack.Screen name="index" />
        <AppStack.Screen name="[id]" />
        <AppStack.Screen name="[id]/settings" />
        <AppStack.Screen name="new" options={{ presentation: 'modal' }} />
      </AppStack>
    </FeatureThemeProvider>
  );
}
