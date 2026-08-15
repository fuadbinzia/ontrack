import { Stack } from 'expo-router';

import { motion } from '@/design-system';
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
    <Stack
      screenOptions={{
        headerShown: false,
        animation: process.env.EXPO_OS === 'android' ? 'fade_from_bottom' : 'default',
        animationDuration: motion.page,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
      <Stack.Screen
        name="[id]/edit"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
      <Stack.Screen
        name="[id]/check-in"
        options={{
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.backgroundPrimary },
        }}
      />
    </Stack>
  );
}
