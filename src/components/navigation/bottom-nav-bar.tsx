import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { BottomTabBarHeightCallbackContext } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePageSurfaceBackgroundColor } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { glassMaterials, radii } from '@/design-system';
import { useHomeWeather } from '@/features/daily-tracking/use-home-weather';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useTabPins } from '@/store/tab-pins';
import { useTodos } from '@/store/todos';
import { useUI } from '@/store/ui';
import {
  AgentTestId,
  AgentUiIds,
  isAgentUiEnabled,
  registerAgentUiTarget,
  tabTestIdForRoute,
  unregisterAgentUiTarget,
} from '@/utils/agent-ui';
import { deferAfterPageLoad } from '@/utils/defer-after-page-load';

import { bottomNavBottomPad } from './bottom-nav-inset';
import { BottomNavTabItem } from './bottom-nav-tab-item';
import { isTrackerRouteEnabled, TAB_META } from './bottom-nav-tab-meta';
import {
  MORE_TAB_ROUTE,
  NAV_PIN_LIMIT,
  resolveMoreRetapTarget,
  splitTrackerOrder,
} from './tab-pins';

type BottomNavBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

const MAX_BAR_WIDTH = 720;

export function BottomNavBar({
  state,
  descriptors,
  navigation,
}: BottomNavBarProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const pageSurface = usePageSurfaceBackgroundColor();
  const darkBar = theme.name === 'dark';
  const barWash = darkBar
    ? allowsBlur
      ? glassMaterials.nav.darkFillBlur
      : glassMaterials.nav.darkFillSolid
    : allowsBlur
      ? glassMaterials.nav.lightFillBlur
      : glassMaterials.nav.lightFillSolid;
  // Prefer frosted glass; fall back to page surface only when blur is off
  // and a feature registered an opaque underlay (Travel paper continuity).
  const barBackground =
    !allowsBlur && pageSurface ? pageSurface : 'transparent';
  const router = useRouter();
  const { weather: homeWeather, icon: homeWeatherIcon } = useHomeWeather();
  const todayTabIcon: AppIconName = homeWeatherIcon ?? 'today';
  const todayAccessibilityExtra = homeWeather
    ? `, ${homeWeather.condition}`
    : '';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, layout, s } = useResponsive();
  const setTabBarHeight = useUI((store) => store.setTabBarHeight);
  const onTabBarHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const enabledAddons = useAddons((store) => store.enabled);
  const trackerOrder = useTabPins((store) => store.trackerOrder);
  const pinnedCount = useTabPins((store) => store.pinnedCount);
  const openTaskCount = useTodos(
    (store) => store.tasks.filter((task) => !task.completed).length,
  );

  const enabledNames = useMemo(() => {
    const names = new Set<string>();
    for (const route of state.routes) {
      if (!isTrackerRouteEnabled(route.name, enabledAddons)) continue;
      if (route.name === MORE_TAB_ROUTE) continue;
      names.add(route.name);
    }
    return names;
  }, [enabledAddons, state.routes]);

  const { inNav } = useMemo(
    () => splitTrackerOrder(trackerOrder, enabledNames, pinnedCount),
    [enabledNames, pinnedCount, trackerOrder],
  );

  const barSlots = useMemo(() => {
    const pins = inNav.slice(0, NAV_PIN_LIMIT).map((name) => ({
      kind: 'pin' as const,
      name,
    }));
    return [...pins, { kind: 'more' as const, name: MORE_TAB_ROUTE }];
  }, [inNav]);

  const focusedRouteName = state.routes[state.index]?.name;
  const focusedInBar = barSlots.some((slot) => slot.name === focusedRouteName);
  // Optimistic chrome while the destination tab mounts (lazy screens).
  const [pendingRouteName, setPendingRouteName] = useState<string | null>(null);
  const lastPinRouteRef = useRef<string>(inNav[0] ?? '(today)');
  const fallbackPin = inNav[0] ?? '(today)';

  useEffect(() => {
    useUI.setState({
      tabBarCollapsed: false,
      carouselSwipeClaimed: false,
      carouselPendingRouteName: null,
      carouselBrowse: null,
    });
  }, []);

  useEffect(() => {
    if (!pendingRouteName) return;
    if (focusedRouteName === pendingRouteName) {
      setPendingRouteName(null);
    }
  }, [focusedRouteName, pendingRouteName]);

  // Remember the last bar pin so retapping More can dismiss Trackers to it.
  useEffect(() => {
    if (!focusedRouteName || focusedRouteName === MORE_TAB_ROUTE) return;
    if (
      !barSlots.some(
        (slot) => slot.kind === 'pin' && slot.name === focusedRouteName,
      )
    ) {
      return;
    }
    lastPinRouteRef.current = focusedRouteName;
  }, [barSlots, focusedRouteName]);

  // Agent-ui tab targets — register only after idle so dump/tap bookkeeping
  // never contends with the destination tab’s first paint.
  const agentTabIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!isAgentUiEnabled()) return;
    const names = [...enabledNames, MORE_TAB_ROUTE];
    let cancelled = false;
    const cancel = deferAfterPageLoad(() => {
      if (cancelled) return;
      for (const testID of agentTabIdsRef.current) {
        unregisterAgentUiTarget(testID);
      }
      const registered: string[] = [];
      for (const name of names) {
        const testID = tabTestIdForRoute(name);
        const meta = TAB_META[name];
        if (!testID || !meta) continue;
        registerAgentUiTarget(testID, {
          label: name === 'vision-board' ? 'Vision Board' : meta.label,
          press: () => router.navigate(meta.href),
        });
        registered.push(testID);
      }
      agentTabIdsRef.current = registered;
    });
    return () => {
      cancelled = true;
      cancel();
      for (const testID of agentTabIdsRef.current) {
        unregisterAgentUiTarget(testID);
      }
      agentTabIdsRef.current = [];
    };
  }, [enabledNames, router]);

  // Android system/gesture nav: full inset. iOS home indicator: small pad.
  // Keep in sync with chat dock math (`bottomNavBottomPad`).
  const bottomLabelPad = bottomNavBottomPad(insets.bottom, spacing.sm);
  const barHeight = layout.bottomNavBarBaseHeight + bottomLabelPad;
  const tabCaptionStyle = {
    fontSize: s(9.5),
    lineHeight: s(11),
    width: '100%' as const,
    minWidth: 0,
    flexShrink: 1,
  };
  const barWidth = Math.min(width - layout.screenPadding * 2, MAX_BAR_WIDTH);

  const reportBarHeight = (height: number) => {
    if (height <= 0) return;
    setTabBarHeight(height);
    onTabBarHeightChange?.(height);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { height: barHeight }]}
      onLayout={(event) => reportBarHeight(event.nativeEvent.layout.height)}
    >
      <AgentTestId testID={AgentUiIds.tabs.dock} style={styles.barFill}>
        <View
          pointerEvents="box-none"
          style={[
            styles.barInner,
            {
              height: barHeight,
              maxWidth: MAX_BAR_WIDTH + layout.screenPadding * 2,
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.xxs,
              paddingBottom: bottomLabelPad,
              backgroundColor: barBackground,
              overflow: 'hidden',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: darkBar
                ? glassMaterials.border.darkStrong
                : glassMaterials.border.light,
            },
          ]}
        >
          {Platform.OS === 'android' ? (
            // Android has no BlurView here — a thin barWash (0.42) lets scroll
            // chrome (Profile "Features", timeline titles) read through the dock.
            // Use the solid nav fill + a denser wash so glass still feels cool
            // without ghosting section titles over tab labels.
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: darkBar
                    ? glassMaterials.nav.darkFillSolid
                    : glassMaterials.nav.lightFillSolid,
                  experimental_backgroundImage: darkBar
                    ? 'linear-gradient(180deg, rgba(36,42,54,0.72) 0%, rgba(12,16,24,0.92) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(247,244,238,0.94) 100%)',
                },
              ]}
            />
          ) : (
            <>
              <BlurView
                intensity={allowsBlur ? 48 : 0}
                tint={darkBar ? 'dark' : 'light'}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: barWash }]}
              />
            </>
          )}
          <View
            style={[
              styles.row,
              {
                width: barWidth,
                alignSelf: 'center',
                borderRadius: radii.pill,
                zIndex: 1,
              },
            ]}
          >
            {barSlots.map((slot) => {
              const meta = TAB_META[slot.name];
              if (!meta) return null;
              const route = state.routes.find(
                (item) => item.name === slot.name,
              );
              const navFocused =
                slot.kind === 'more'
                  ? focusedRouteName === MORE_TAB_ROUTE || !focusedInBar
                  : focusedRouteName === slot.name;
              const focused = pendingRouteName
                ? pendingRouteName === slot.name
                : navFocused;
              const badge = slot.name === 'to-do' ? openTaskCount : 0;
              const tabIcon: AppIconName =
                slot.name === '(today)' ? todayTabIcon : meta.icon;
              const accessibilityLabel =
                slot.name === '(today)'
                  ? `${meta.label}${todayAccessibilityExtra}`
                  : slot.name === 'vision-board'
                    ? 'Vision Board'
                    : slot.kind === 'more'
                      ? 'More'
                      : meta.label;

              const selectTab = () => {
                // Accent + dot update on the same frame as the tap; navigate
                // immediately after so lazy mount work doesn't leave chrome stuck.
                if (slot.kind === 'more') {
                  const dismissTo = resolveMoreRetapTarget(
                    focusedRouteName,
                    lastPinRouteRef.current,
                    fallbackPin,
                  );
                  if (dismissTo) {
                    const backMeta = TAB_META[dismissTo];
                    const backRoute = state.routes.find(
                      (item) => item.name === dismissTo,
                    );
                    setPendingRouteName(dismissTo);
                    if (backRoute) {
                      navigation.navigate(backRoute.name, backRoute.params);
                    } else if (backMeta) {
                      router.navigate(backMeta.href);
                    }
                    return;
                  }
                  setPendingRouteName(slot.name);
                  router.navigate(TAB_META.trackers.href);
                  return;
                }
                setPendingRouteName(slot.name);
                if (!route) {
                  router.navigate(meta.href);
                  return;
                }
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) {
                  setPendingRouteName(null);
                  return;
                }
                if (focusedRouteName === route.name) {
                  router.navigate(meta.href);
                } else {
                  navigation.navigate(route.name, route.params);
                }
              };

              return (
                <Pressable
                  key={slot.name}
                  testID={tabTestIdForRoute(slot.name)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={
                    route
                      ? (descriptors[route.key]?.options
                          .tabBarAccessibilityLabel ?? accessibilityLabel)
                      : accessibilityLabel
                  }
                  hitSlop={{ top: 4, bottom: 4 }}
                  onPress={selectTab}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      minHeight: layout.minTapTarget,
                      paddingVertical: spacing.xxs,
                      paddingHorizontal: s(2),
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <BottomNavTabItem
                    selected={focused}
                    icon={tabIcon}
                    label={meta.label}
                    activeColor={theme.accentPrimary}
                    inactiveColor={theme.textSecondary}
                    iconSize={s(20)}
                    captionStyle={tabCaptionStyle}
                    badge={badge}
                    badgeColor={theme.danger}
                    badgeMinWidth={s(20)}
                    badgeHeight={s(18)}
                    badgePadX={s(4)}
                    badgeFontSize={s(10)}
                    badgeLineHeight={s(13)}
                  />
                  {focused ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.dot,
                        {
                          backgroundColor: theme.accentPrimary,
                          width: s(4),
                          height: s(4),
                          borderRadius: s(2),
                          marginTop: s(2),
                        },
                      ]}
                    />
                  ) : (
                    <View style={{ height: s(6) }} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </AgentTestId>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    flex: 1,
    width: '100%',
  },
  barInner: {
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flex: 1,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.72 },
  dot: {},
});
