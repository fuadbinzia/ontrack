import { Redirect, Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import {
    BottomNavDockHost,
    renderBottomNavBar,
} from '@/components/navigation/bottom-nav-dock';
import { BOTTOM_NAV_Z_INDEX } from '@/components/navigation/bottom-nav-inset';
import {
    beginTabReturn,
    hasTabReturn as readHasTabReturn,
    rememberFocusedTab,
    resolveSwipeBackAction,
    tabNameFromSegments,
} from '@/components/navigation/overview-return';
import { getFocusedStackCanPop } from '@/components/navigation/swipe-back';
import { SwipeBackScene } from '@/components/navigation/swipe-back-scene';
import { schedulePreloadTabLanes } from '@/components/navigation/tab-lane-preload';
import { MORE_TAB_ROUTE } from '@/components/navigation/tab-pins';
import {
    TAB_SCENE_KEEP_PAINTED_SPEC,
    tabSceneKeepPainted,
} from '@/components/navigation/tab-scene-visibility';
import { useShouldShowWelcome } from '@/features/auth/welcome-preview';
import { useOverviewAffinity } from '@/store/overview-affinity';
import { usePreferences } from '@/store/preferences';
import { useUI } from '@/store/ui';
import { todayKey } from '@/utils/date';

function TabReturnBinder({ children }: { children: ReactNode }): ReactElement {
  const segments = useSegments();
  const pathname = usePathname();
  const tabName = tabNameFromSegments(segments);

  useEffect(() => {
    rememberFocusedTab(tabName, pathname);
  }, [pathname, tabName]);

  useEffect(() => {
    if (tabName) useOverviewAffinity.getState().recordVisit(tabName);
  }, [tabName]);

  return <>{children}</>;
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
      <View collapsable={false} style={styles.shell}>
        <Tabs
        initialRouteName="(today)"
        screenLayout={({ children, route }) => (
          <SwipeBackScene intent="overview-return" tabName={route.name}>
            {children}
          </SwipeBackScene>
        )}
        // Keep this boolean stable. Toggling detach/freeze on tab park remounts
        // the page that just opened (load → flash → show again).
        detachInactiveScreens={false}
        // Publish into BottomNavDockHost (sibling). Rendering the bar inside
        // BottomTabView lets ScreenContainer cover it after scenes paint.
        tabBar={renderBottomNavBar}
        // Swipe lanes must exist before a gesture reveals them: lazy tabs
        // unmount on navigator remounts even though lane history survives.
        // Bounded to the two lane neighbors — see tab-lane-preload.ts.
        screenListeners={({ navigation }) => ({
          state: () => schedulePreloadTabLanes(navigation),
        })}
        screenOptions={({ route }) => ({
          headerShown: false,
          // Sections self-dismisses on blur. Keep that one scene live long enough
          // to render null instead of freezing its transparent list over the next tab.
          freezeOnBlur: route.name !== MORE_TAB_ROUTE,
          lazy: true,
          // Parked tabs must stay painted (display: flex) so the swipe pager
          // slides real pixels — see tab-scene-visibility.ts. An explicit
          // 'none' tab animation here blanks parked lanes (display: none).
          transitionSpec: TAB_SCENE_KEEP_PAINTED_SPEC,
          sceneStyleInterpolator: tabSceneKeepPainted,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: BOTTOM_NAV_Z_INDEX,
            elevation: BOTTOM_NAV_Z_INDEX,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
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
        <BottomNavDockHost />
      </View>
    </TabReturnBinder>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
