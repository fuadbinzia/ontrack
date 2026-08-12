import { Stack } from 'expo-router';

import { motion } from '@/design-system';

export const unstable_settings = {
  anchor: 'index',
};

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: process.env.EXPO_OS === 'android' ? 'fade_from_bottom' : 'default',
        animationDuration: motion.page,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
      <Stack.Screen name="bills" />
      <Stack.Screen name="buckets" />
      <Stack.Screen name="entities" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="tax" />
    </Stack>
  );
}
