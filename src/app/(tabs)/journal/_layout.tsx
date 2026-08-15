import { Stack } from 'expo-router';

import { motion } from '@/design-system';

export const unstable_settings = {
  anchor: 'index',
};

export default function JournalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: process.env.EXPO_OS === 'android' ? 'fade_from_bottom' : 'default',
        animationDuration: motion.page,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[date]" />
    </Stack>
  );
}
