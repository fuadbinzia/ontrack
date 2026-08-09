import { Stack } from 'expo-router';

import { motion } from '@/design-system';
import { FeatureThemeProvider } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function FoodLayout() {
  return (
    <FeatureThemeProvider feature="food">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: process.env.EXPO_OS === 'android' ? 'fade_from_bottom' : 'default',
          animationDuration: motion.page,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        <Stack.Screen name="index" />
      </Stack>
    </FeatureThemeProvider>
  );
}
