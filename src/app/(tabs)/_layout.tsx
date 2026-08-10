import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

import { BottomNavBar } from '@/components/navigation/bottom-nav-bar';
import { useShouldShowWelcome } from '@/features/auth/welcome-preview';
import { usePreferences } from '@/store/preferences';
import { useUI } from '@/store/ui';
import { todayKey } from '@/utils/date';

export default function TabsLayout() {
  const hasOnboarded = usePreferences((s) => s.hasOnboarded);
  const showWelcome = useShouldShowWelcome(hasOnboarded);
  const setSelectedDate = useUI((state) => state.setSelectedDate);
  const router = useRouter();

  // Android hardware back on a tab root otherwise dispatches empty-stack POP
  // → Expo Router LogBox ("not handled by any navigator"). Consume when there
  // is nothing to dismiss/go back to; nested stacks still get default behavior.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canDismiss() || router.canGoBack()) return false;
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (showWelcome) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Keep switches snappy — freezing blurred tabs adds a visible hitch
        // when hopping between sections in the bottom nav rail.
        freezeOnBlur: false,
        lazy: true,
        animation: 'none',
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
        },
        tabBarBackground: () => null,
      }}>
      <Tabs.Screen
        name="(today)"
        listeners={{ tabPress: () => setSelectedDate(todayKey()) }}
      />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="to-do" />
      <Tabs.Screen name="social" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="plants" />
      <Tabs.Screen name="travel" />
      <Tabs.Screen name="vision-board" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="vehicles" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="trackers" />
    </Tabs>
  );
}
