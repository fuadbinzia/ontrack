import { Stack, useLocalSearchParams } from 'expo-router';

import { TravelTripToolsScreen } from '@/features/travel/travel-trip-tools-screen';

export default function TravelTripToolsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === 'string' ? id : '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent', paddingTop: 0 },
        }}
      />
      <TravelTripToolsScreen planId={planId} />
    </>
  );
}
