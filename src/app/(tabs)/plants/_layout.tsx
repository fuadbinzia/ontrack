import { AppStack } from '@/components/navigation/app-stack';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function PlantsLayout() {
  return (
    <FeatureThemeProvider feature="plants">
      <PlantsStack />
    </FeatureThemeProvider>
  );
}

function PlantsStack() {
  const theme = useTheme();
  return (
    <AppStack
      screenOptions={{
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <AppStack.Screen name="index" />
      <AppStack.Screen name="[id]" />
      <AppStack.Screen
        name="new"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
      <AppStack.Screen
        name="[id]/edit"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
      <AppStack.Screen
        name="[id]/check-in"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
    </AppStack>
  );
}
