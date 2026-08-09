import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
    Symbol,
    usePageSurfaceBackgroundColor,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { glassMaterials, motion, radii } from '@/design-system';
import { palette } from '@/design-system/colors';
import { useHomeWeather } from '@/features/daily-tracking/use-home-weather';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useTabRecency } from '@/store/tab-recency';
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

import {
    canonicalPositionForRoute,
    centerIndexForRail,
    rebasePosition,
    routeIndexForPosition,
} from './bottom-nav-bar-motion';
import { BottomNavTabItem } from './bottom-nav-tab-item';
import { TAB_META } from './bottom-nav-tab-meta';
import { orderRoutesByRecency } from './tab-recency';

type BottomNavBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

/** Middle carousel tabs; outer rail slots are fixed prev/next arrows. */
const VISIBLE_TAB_COUNT = 3;
const RAIL_SLOT_COUNT = VISIBLE_TAB_COUNT + 2;
const TRACK_REPEAT_COUNT = 5;
const MAX_CAROUSEL_WIDTH = 720;
const VELOCITY_PROJECTION_SECONDS = 0.2;
const MAX_FLING_ITEMS = 5;
/** Soft settle for pan snaps and rail arrow nudges. */
const SNAP_SPRING = {
  damping: 22,
  stiffness: 230,
  mass: 0.78,
} as const;

export function BottomNavBar({
  state,
  descriptors,
  navigation,
}: BottomNavBarProps) {
  'use no memo';
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
  const carouselBrowse = useUI((store) => store.carouselBrowse);
  const pendingRouteName = useUI(
    (store) => store.carouselPendingRouteName,
  );
  const setCarouselBrowse = useUI((store) => store.setCarouselBrowse);
  const setTabBarHeight = useUI((store) => store.setTabBarHeight);
  const enabledAddons = useAddons((store) => store.enabled);
  const lastFocusedAt = useTabRecency((store) => store.lastFocusedAt);
  const recordTabFocus = useTabRecency((store) => store.recordTabFocus);
  const openTaskCount = useTodos(
    (store) => store.tasks.filter((task) => !task.completed).length,
  );
  const visibleRoutes = useMemo(() => {
    const enabled = state.routes.filter((route) => {
      if (route.name === 'workouts') return enabledAddons.fitness;
      if (route.name === 'plants') return enabledAddons.plants;
      if (route.name === 'travel') return enabledAddons.travel;
      if (route.name === 'vision-board') return enabledAddons['vision-board'];
      if (route.name === 'games') return enabledAddons.games;
      if (route.name === 'vehicles') return enabledAddons.vehicles;
      if (route.name === 'food') return enabledAddons.food;
      if (route.name === 'health') {
        return process.env.EXPO_OS === 'ios' && enabledAddons.health;
      }
      return route.name in TAB_META;
    });
    return orderRoutesByRecency(enabled, lastFocusedAt);
  }, [enabledAddons, lastFocusedAt, state.routes]);

  useEffect(() => {
    // Locked-open nav + clear any stuck swipe/collapse flags from older builds
    // or interrupted springs (stuck claim blocks every tab press).
    useUI.setState({
      tabBarCollapsed: false,
      carouselSwipeClaimed: false,
      carouselPendingRouteName: null,
    });
  }, []);

  const focusedRouteName = state.routes[state.index]?.name;
  // Rail chrome after the destination tab has loaded — never during navigate.
  // Recency reshuffle remounts the infinite track; neighbor preload mounts
  // other screens. Both must wait for page settle + InteractionManager idle.
  useEffect(() => {
    if (pendingRouteName) return;
    if (!focusedRouteName || !(focusedRouteName in TAB_META)) return;
    const routeName = focusedRouteName;
    return deferAfterPageLoad(() => {
      if (useUI.getState().carouselPendingRouteName) return;
      if (useUI.getState().carouselSwipeClaimed) return;
      recordTabFocus(routeName);
    });
  }, [focusedRouteName, pendingRouteName, recordTabFocus]);

  // Agent-ui tab targets — register only after the page is idle so dump/tap
  // bookkeeping never contends with the destination tab’s first paint.
  const agentTabIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!isAgentUiEnabled()) return;
    if (pendingRouteName) return;
    const routes = visibleRoutes;
    let cancelled = false;
    const cancel = deferAfterPageLoad(() => {
      if (cancelled) return;
      if (useUI.getState().carouselPendingRouteName) return;
      for (const testID of agentTabIdsRef.current) {
        unregisterAgentUiTarget(testID);
      }
      const registered: string[] = [];
      for (const route of routes) {
        const testID = tabTestIdForRoute(route.name);
        const meta = TAB_META[route.name];
        if (!testID || !meta) continue;
        registerAgentUiTarget(testID, {
          label:
            route.name === 'vision-board' ? 'Vision Board' : meta.label,
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
  }, [pendingRouteName, router, visibleRoutes]);

  const selectedRoute = state.routes[state.index];
  const selectedVisibleIndex = visibleRoutes.findIndex(
    (route) => route.key === selectedRoute?.key,
  );

  // Preload left/right rail neighbors only after the focused tab has loaded.
  const neighborRouteKey = useMemo(() => {
    if (selectedVisibleIndex < 0) return '';
    return [selectedVisibleIndex - 1, selectedVisibleIndex + 1]
      .map((index) => visibleRoutes[index]?.name ?? '')
      .join('|');
  }, [selectedVisibleIndex, visibleRoutes]);

  useEffect(() => {
    if (pendingRouteName) return;
    if (!neighborRouteKey) return;
    const names = neighborRouteKey.split('|').filter(Boolean);
    if (names.length === 0) return;
    const routes = visibleRoutes;
    // Extra delay past recency reshuffle so preload doesn’t mount neighbors
    // in the same idle window as the rail remount.
    return deferAfterPageLoad(() => {
      if (useUI.getState().carouselPendingRouteName) return;
      if (useUI.getState().carouselSwipeClaimed) return;
      for (const name of names) {
        const route = routes.find((item) => item.name === name);
        if (!route) continue;
        try {
          navigation.preload(route.name, route.params);
        } catch {
          // Older navigators / incomplete preload — ignore.
        }
      }
    }, motion.page + motion.layout);
  }, [navigation, neighborRouteKey, pendingRouteName, visibleRoutes]);
  const carouselWidth = Math.min(
    width - layout.screenPadding * 2,
    MAX_CAROUSEL_WIDTH,
  );
  // Inset from the pill’s rounded ends so outer and inner gutters match.
  const capsuleInset = Math.max(spacing.xs, s(6));
  const itemWidth =
    (carouselWidth - capsuleInset * 2) / RAIL_SLOT_COUNT;
  const browsedIndex = visibleRoutes.findIndex(
    (route) =>
      carouselBrowse?.anchorRouteName === selectedRoute?.name &&
      route.name === carouselBrowse.centerRouteName,
  );
  const selectedIndex = selectedVisibleIndex < 0 ? 0 : selectedVisibleIndex;
  const initialCenterIndex = browsedIndex < 0 ? selectedIndex : browsedIndex;
  const positionItems = useSharedValue(
    canonicalPositionForRoute(initialCenterIndex, visibleRoutes.length),
  );
  const gestureStartItems = useSharedValue(0);
  // Bumps on every selection/nudge/pan snap so interrupted springs never clear
  // a newer in-flight move (that race caused multi-item “fast scroll” glitches).
  const motionEpoch = useSharedValue(0);
  const trackItemCount = visibleRoutes.length * TRACK_REPEAT_COUNT;
  const centerSlot = Math.floor(trackItemCount / 2);
  const displayedRoutes = Array.from({ length: trackItemCount }, (_, slot) => {
    const offset = slot - centerSlot;
    const routeIndex =
      ((offset % visibleRoutes.length) + visibleRoutes.length) %
      visibleRoutes.length;
    return visibleRoutes[routeIndex];
  });
  const routeNames = visibleRoutes.map((route) => route.name);
  const routeCount = visibleRoutes.length;
  const baseTranslateX =
    (Math.floor(VISIBLE_TAB_COUNT / 2) - centerSlot) * itemWidth;

  // Suppress the press that fires when a horizontal swipe ends on a tab.
  const suppressPressAfterPan = useRef(false);
  // Logical snap target while an arrow spring is in flight so rapid taps
  // step from the destination, not a mid-animation fractional offset.
  const pendingNudgeTarget = useRef<number | null>(null);
  const setSwipeClaimed = (claimed: boolean) => {
    useUI.getState().setCarouselSwipeClaimed(claimed);
  };
  const releaseSwipeClaim = () => {
    setTimeout(() => {
      setSwipeClaimed(false);
      suppressPressAfterPan.current = false;
    }, 80);
  };
  const markPanMoved = () => {
    suppressPressAfterPan.current = true;
  };
  const commitBrowse = (routeName: string) => {
    setCarouselBrowse({
      anchorRouteName: selectedRoute.name,
      centerRouteName: routeName,
    });
  };
  // Clear optimistic selection only after navigation has focused the tab.
  // Stay at canonical 0 — do not chase the tapped route’s pre-reshuffle side
  // index (that scrolls Profile→Today). Recency rearrange runs after settle.
  useLayoutEffect(() => {
    if (!pendingRouteName) return;
    if (selectedRoute?.name !== pendingRouteName) return;
    if (routeCount <= 0) return;
    positionItems.value = canonicalPositionForRoute(0, routeCount);
    useUI.setState({
      carouselBrowse: null,
      carouselPendingRouteName: null,
      carouselSwipeClaimed: false,
    });
  }, [pendingRouteName, positionItems, routeCount, selectedRoute?.name]);
  const finishBrowseAtPosition = (targetItems: number, epoch: number) => {
    if (motionEpoch.value !== epoch) return;
    if (routeCount <= 0) return;
    pendingNudgeTarget.current = null;
    const routeIndex = routeIndexForPosition(targetItems, routeCount);
    positionItems.value = rebasePosition(
      targetItems,
      routeIndex,
      routeCount,
    );
    commitBrowse(routeNames[routeIndex]);
  };
  const nudgeCarousel = (direction: -1 | 1) => {
    const epoch = motionEpoch.value + 1;
    motionEpoch.value = epoch;
    const base =
      pendingNudgeTarget.current ?? Math.round(positionItems.value);
    const targetItems = base + direction;
    pendingNudgeTarget.current = targetItems;
    positionItems.value = withSpring(
      targetItems,
      SNAP_SPRING,
      (finished) => {
        if (!finished || motionEpoch.value !== epoch) return;
        scheduleOnRN(finishBrowseAtPosition, targetItems, epoch);
      },
    );
  };
  const clearPendingNudge = () => {
    pendingNudgeTarget.current = null;
  };

  // Fail quickly on taps so tab Pressables aren’t held in “possible” by the pan.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .onStart(() => {
      motionEpoch.value += 1;
      gestureStartItems.value = positionItems.value;
      scheduleOnRN(clearPendingNudge);
      scheduleOnRN(setSwipeClaimed, true);
    })
    .onUpdate((event) => {
      if (Math.abs(event.translationX) >= 12) {
        scheduleOnRN(markPanMoved);
      }
      positionItems.value =
        gestureStartItems.value + event.translationX / itemWidth;
    })
    .onEnd((event) => {
      const epoch = motionEpoch.value + 1;
      motionEpoch.value = epoch;
      const velocityItems = event.velocityX / itemWidth;
      const projectedItems =
        positionItems.value + velocityItems * VELOCITY_PROJECTION_SECONDS;
      const projectedDelta = projectedItems - gestureStartItems.value;
      const boundedDelta = Math.max(
        -MAX_FLING_ITEMS,
        Math.min(MAX_FLING_ITEMS, projectedDelta),
      );
      const targetItems =
        gestureStartItems.value + Math.round(boundedDelta);

      positionItems.value = withSpring(
        targetItems,
        {
          ...SNAP_SPRING,
          velocity: velocityItems,
        },
        (finished) => {
          if (!finished || motionEpoch.value !== epoch) return;
          scheduleOnRN(finishBrowseAtPosition, targetItems, epoch);
        },
      );
    })
    .onFinalize(() => {
      scheduleOnRN(releaseSwipeClaim);
    });
  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: baseTranslateX + positionItems.value * itemWidth,
      },
    ],
  }));

  const routeOrderKey = routeNames.join('|');
  const prevRouteOrderKeyRef = useRef(routeOrderKey);
  // Recency reorder remaps slots. Keep the pending/selected route centered —
  // never `selectedIndex` alone (mid-handoff the prior tab still “selected”
  // but now sits left/right; chasing it scrolls then snaps).
  if (prevRouteOrderKeyRef.current !== routeOrderKey && routeCount > 0) {
    prevRouteOrderKeyRef.current = routeOrderKey;
    motionEpoch.value += 1;
    pendingNudgeTarget.current = null;
    const centerIndex = centerIndexForRail(
      visibleRoutes,
      pendingRouteName,
      selectedRoute?.name,
    );
    positionItems.value = canonicalPositionForRoute(centerIndex, routeCount);
  }

  useLayoutEffect(() => {
    if (pendingRouteName) return;
    if (carouselBrowse?.anchorRouteName === selectedRoute.name) return;
    if (routeCount <= 0) return;
    // Focused tab is index 0 after recency arrange. Before that records, stay
    // at 0 — chasing the pre-reshuffle side index slides the rail again.
    const target = canonicalPositionForRoute(0, routeCount);
    if (Math.round(positionItems.value) === Math.round(target)) {
      positionItems.value = target;
      return;
    }
    motionEpoch.value += 1;
    pendingNudgeTarget.current = null;
    positionItems.value = target;
  }, [
    carouselBrowse,
    pendingRouteName,
    positionItems,
    motionEpoch,
    selectedRoute?.name,
    routeCount,
    routeOrderKey,
  ]);

  // Pinned bar, always expanded. Dock width must match carouselWidth math
  // (screen padding + max width) so the infinite track clips and swipes correctly.
  const bottomLabelPad = insets.bottom > 0 ? 6 : spacing.sm;
  // Center discs on the full tab chrome (glyph + label), not the icon row alone —
  // a caption stand-in would re-lock arrows to the glyph baseline and look high.
  const arrowButtonSize = Math.max(28, s(30));
  const arrowIconSize = Math.max(16, s(17));
  const tabCaptionStyle = {
    fontSize: s(9.5),
    lineHeight: s(11),
    width: '100%' as const,
    minWidth: 0,
    flexShrink: 1,
  };
  const dark = theme.name === 'dark';
  // Frosted discs — match bar glass (BlurView underlay; never nest remounting chrome).
  const arrowIconColor = dark ? theme.textSecondary : palette.ink1;

  const renderRailArrow = (
    direction: 'prev' | 'next',
  ) => {
    const isPrev = direction === 'prev';
    return (
      <AgentTestId
        testID={
          isPrev
            ? AgentUiIds.tabs.carouselPrev
            : AgentUiIds.tabs.carouselNext
        }
        label={isPrev ? 'Previous tabs' : 'Next tabs'}
        onPress={() => nudgeCarousel(isPrev ? 1 : -1)}
        style={[styles.railArrow, { width: itemWidth }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPrev ? 'Previous tabs' : 'Next tabs'}
          hitSlop={4}
          onPress={() => nudgeCarousel(isPrev ? 1 : -1)}
          style={({ pressed }) => [
            styles.railArrowHit,
            {
              width: itemWidth,
              minHeight: layout.minTapTarget,
              paddingVertical: spacing.xxs,
              paddingHorizontal: s(2),
            },
            pressed && styles.railArrowPressed,
          ]}>
          <View
            style={[
              styles.railArrowGlyph,
              {
                width: arrowButtonSize,
                height: arrowButtonSize,
                borderRadius: arrowButtonSize / 2,
                // Neutral glass — avoid cool navy tints that seam on warm pages.
                backgroundColor: dark
                  ? 'rgba(0, 0, 0, 0.28)'
                  : 'rgba(255, 255, 255, 0.36)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: dark
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(255,255,255,0.65)',
                overflow: 'hidden',
              },
            ]}>
            <BlurView
              intensity={allowsBlur ? (dark ? 40 : 52) : 0}
              tint={dark ? 'dark' : 'light'}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <Symbol
              name={isPrev ? 'chevron-left' : 'chevron-right'}
              size={arrowIconSize}
              color={arrowIconColor}
            />
          </View>
        </Pressable>
      </AgentTestId>
    );
  };

  // Frosted dock over page atmosphere (sibling BlurView — never nest
  // remounting chrome inside BlurView). Android uses a translucent wash.
  return (
    <AgentTestId testID={AgentUiIds.tabs.dock}>
      <View
        onLayout={(event) =>
          setTabBarHeight(event.nativeEvent.layout.height)
        }
        pointerEvents="box-none"
        style={[
          styles.bar,
          {
            height: layout.bottomNavBarBaseHeight + bottomLabelPad,
            maxWidth: MAX_CAROUSEL_WIDTH + layout.screenPadding * 2,
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
        ]}>
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: barWash,
                experimental_backgroundImage: darkBar
                  ? 'linear-gradient(180deg, rgba(36,42,54,0.55) 0%, rgba(12,16,24,0.72) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(247,244,238,0.78) 100%)',
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
            styles.capsule,
            {
              backgroundColor: 'transparent',
              zIndex: 1,
            },
          ]}>
        <View
          style={[
            styles.railEdge,
            {
              left: capsuleInset,
              width: itemWidth,
            },
          ]}>
          {renderRailArrow('prev')}
        </View>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            collapsable={false}
            style={[styles.capsuleClip, { width: itemWidth * VISIBLE_TAB_COUNT }]}>
            <Animated.View
              style={[
                styles.carouselTrack,
                { width: itemWidth * trackItemCount },
                trackStyle,
              ]}>
              {displayedRoutes.map((route, slotIndex) => {
          const meta = TAB_META[route.name];
          const focused = selectedRoute?.key === route.key;
          const visuallySelected = pendingRouteName
            ? pendingRouteName === route.name
            : focused;
          const badge = route.name === 'to-do' ? openTaskCount : 0;

          const tabIcon: AppIconName =
            route.name === '(today)' ? todayTabIcon : meta.icon;
          const accessibilityLabel =
            descriptors[route.key].options.tabBarAccessibilityLabel ??
            (route.name === '(today)'
              ? `${meta.label}${todayAccessibilityExtra}`
              : route.name === 'vision-board'
                ? 'Vision Board'
                : meta.label);

          const selectTab = () => {
            // Only ignore the synthetic press at the end of a pan — never a
            // stuck global claim flag (that made the whole bar untappable).
            if (suppressPressAfterPan.current) {
              suppressPressAfterPan.current = false;
              return;
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!event.defaultPrevented) {
              // Cancel any in-flight browse spring so it can't overwrite this.
              motionEpoch.value += 1;
              pendingNudgeTarget.current = null;
              // Navigate first; defer recency reshuffle until after the page
              // settles (see effect). Reshuffling here remounted the whole
              // repeat track and stalled tab loads.
              useUI.setState({
                carouselPendingRouteName: route.name,
                carouselSwipeClaimed: false,
                carouselBrowse: null,
              });
              positionItems.value = canonicalPositionForRoute(0, routeCount);
              // Direct tab jump when switching; href navigate when re-selecting
              // so nested stacks pop to root. Pending selection stays until
              // `selectedRoute` matches (see effect above) so the accent never
              // snaps back to the previous tab for a frame.
              if (focused) {
                router.navigate(TAB_META[route.name].href);
              } else {
                navigation.navigate(route.name, route.params);
              }
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={`${route.key}-${slotIndex}`}
              testID={tabTestIdForRoute(route.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={accessibilityLabel}
              hitSlop={{ top: 4, bottom: 4 }}
              onLongPress={onLongPress}
              onPress={selectTab}
              style={({ pressed }) => [
                styles.tab,
                {
                  width: itemWidth,
                  minHeight: layout.minTapTarget,
                  paddingVertical: spacing.xxs,
                  paddingHorizontal: s(2),
                },
                pressed && styles.pressed,
              ]}>
              <BottomNavTabItem
                selected={visuallySelected}
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
            </Pressable>
          );
              })}
            </Animated.View>
            {/* Stationary center mark — icons slide under this; never per-tab. */}
            <View
              pointerEvents="none"
              style={[
                styles.centerIndicator,
                { backgroundColor: theme.accentPrimary },
              ]}
            />
          </Animated.View>
        </GestureDetector>
        <View
          style={[
            styles.railEdge,
            {
              right: capsuleInset,
              width: itemWidth,
            },
          ]}>
          {renderRailArrow('next')}
        </View>
      </View>
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    width: '100%',
    alignSelf: 'center',
  },
  capsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  capsuleClip: {
    overflow: 'hidden',
  },
  // Fixed under the middle of the 3-tab window — track slides; this does not.
  centerIndicator: {
    position: 'absolute',
    bottom: 3,
    left: '50%',
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: radii.pill,
  },
  // Pin chevrons to equal insets so the 3-tab window stays true-center
  // even if slot widths round unevenly.
  railEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railArrow: {
    minWidth: 0,
    width: '100%',
    height: '100%',
  },
  // Fill the rail column and center the disc on icon+label (tabs use the
  // same stretched height with a centered glyph+caption stack).
  railArrowHit: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  railArrowGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  railArrowPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  carouselTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 0,
  },
  pressed: {
    opacity: 0.58,
  },
});
