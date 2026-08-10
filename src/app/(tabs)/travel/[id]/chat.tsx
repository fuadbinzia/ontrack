import { Stack, useLocalSearchParams } from 'expo-router';

import { TravelChatScreen } from '@/features/travel/travel-chat-screen';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          // Transparent so AppSafeArea atmosphere chrome (status bar + page)
          // is one continuous wash — opaque travelStyle left a blue seam.
          contentStyle: { backgroundColor: 'transparent', paddingTop: 0 },
        }}
      />
      <TravelChatScreen planId={id} />
    </>
  );
}
