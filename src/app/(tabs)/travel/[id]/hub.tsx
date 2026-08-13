import { Stack, useLocalSearchParams } from 'expo-router';

import { TravelTripHubScreen } from '@/features/travel/travel-trip-hub-screen';
import { useTravelPageStyle } from '@/features/travel/travel-surface';
import { useTheme } from '@/hooks/use-theme';

/** Legacy hub route — redirects to the dedicated Trip Tools page. */
export default function TravelTripHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  const planId = typeof id === 'string' ? id : '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          contentStyle: travelStyle,
        }}
      />
      <TravelTripHubScreen planId={planId} />
    </>
  );
}
