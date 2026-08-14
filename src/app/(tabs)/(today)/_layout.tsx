import { Stack } from 'expo-router';

import { motion } from '@/design-system';

export const unstable_settings = {
  anchor: 'index',
};

const CALENDAR_DETAIL_SHEET_ROUTES = [
  'detail/food/[id]',
  'detail/generic/[id]',
  'detail/gym/[id]',
  'detail/movie/[id]',
  'detail/plant/[id]',
  'detail/sleep/[id]',
  'detail/work/[id]',
] as const;

export default function TodayTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: process.env.EXPO_OS === 'android' ? 'fade_from_bottom' : 'default',
        animationDuration: motion.page,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="index" />
      {CALENDAR_DETAIL_SHEET_ROUTES.map((name) => (
        <Stack.Screen
          key={name}
          name={name}
          options={{
            // SheetScaffold owns the glass plate, backdrop, and pan-down gesture.
            presentation: 'transparentModal',
            animation: 'none',
            gestureEnabled: false,
            contentStyle: {
              backgroundColor: 'transparent',
              paddingTop: 0,
            },
          }}
        />
      ))}
    </Stack>
  );
}
