import { Redirect, Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { BackHandler, Platform } from 'react-native';

import { BottomNavBar } from '@/components/navigation/bottom-nav-bar';
import {
  beginTabReturn,
  hasTabReturn as readHasTabReturn,
  rememberFocusedTab,
  resolveSwipeBackAction,
  tabNameFromSegments,
  useHasTabPark,
} from '@/components/navigation/overview-return';
import { getFocusedStackCanPop } from '@/components/navigation/swipe-back';
import { SwipeBackScene } from '@/components/navigation/swipe-back-scene';
import { MORE_TAB_ROUTE } from '@/components/navigation/tab-pins';
import { useShouldShowWelcome } from '@/features/auth/welcome-preview';
import { usePreferences } from '@/store/preferences';
import { useUI } from '@/store/ui';
import { todayKey } from '@/utils/date';

function TabReturnBinder({
  children,
}: {
  children: (hasTabPark: boolean) => ReactNode;
}): ReactElement {
  const hasTabPark = useHasTabPark();
  const segments = useSegments();
  const pathname = usePathname();
  const tabName = tabNameFromSegments(segments);

  useEffect(() => {
    rememberFocusedTab(tabName, pathname);
  }, [pathname, tabName]);

  return <>{children(hasTabPark)}</>;
}

/** Renamed so Fast Refresh remounts the stuck TabsLayout fiber. */
export default function TabsRoot() {
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
      const action = resolveSwipeBackAction({
        canDismiss: router.canDismiss(),
        canGoBack: getFocusedStackCanPop(),
        hasTabReturn: readHasTabReturn(),
      });
      if (action === 'pop') return false;
      if (action === 'tab') {
        const href = beginTabReturn();
        if (href) router.navigate(href);
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (showWelcome) {
    return <Redirect href="/welcome" />;
  }

  return (
    <TabReturnBinder>
      {(hasTabPark) => (
        <Tabs
          initialRouteName="(today)"
          screenLayout={({ children }) => (
            <SwipeBackScene intent="overview-return">{children}</SwipeBackScene>
          )}
          // Battery-first: inactive sections leave the native hierarchy and stop
          // rendering. Screens mount only after the user opens them.
          detachInactiveScreens={!hasTabPark}
          tabBar={(props) => <BottomNavBar {...props} />}
          screenOptions={({ route }) => ({
            headerShown: false,
            // Sections self-dismisses on blur. Keep that one scene live long enough
            // to render null instead of freezing its transparent list over the next tab.
            freezeOnBlur: route.name !== MORE_TAB_ROUTE,
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
          })}>
          <Tabs.Screen name="overview" options={{ lazy: false }} />
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
          <Tabs.Screen name="finance" />
          <Tabs.Screen name="journal" />
          <Tabs.Screen name="food" />
          <Tabs.Screen name="profile" />
          <Tabs.Screen name="trackers" />
        </Tabs>
      )}
    </TabReturnBinder>
  );
}
