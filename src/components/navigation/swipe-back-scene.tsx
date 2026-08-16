import {
  useFocusEffect,
  useNavigation,
  usePathname,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { goBackOrReplace } from '@/utils/navigation';

import {
  beginTabForward,
  beginTabReturn,
  peekCurrentTabName,
  peekTabForwardName,
  peekTabReturnName,
  peekTabTapFrom,
  peekTabTapLane,
  resolveSwipeBackAction,
  subscribeTabReturn,
  tabSwipeLaneKey,
  useHasTabForward,
  useHasTabReturn,
} from './overview-return';
import {
  canActivateSwipeBack,
  canActivateSwipeForward,
  focusedStackCanPop,
  navigationCanGoBack,
  rememberFocusedStackCanPop,
  swipeTrackedTranslation,
  shouldCommitSwipeBack,
  shouldCommitSwipeForward,
  shouldWrapSwipeBackScene,
  SWIPE_AXIS_SLOP,
  swipePanActiveOffsetX,
} from './swipe-back';
import {
  PAGER_SPRING,
  tabSwipeLane,
  tabSwipeLanes,
  tabSwipeTranslateX,
  tabSwipeX,
} from './tab-swipe';

export function SwipeBackScene({
  children,
  gestureEnabled,
  presentation,
  intent = 'stack',
  tabName,
}: {
  children: ReactNode;
  gestureEnabled?: boolean;
  presentation?: string;
  intent?: 'stack' | 'overview-return';
  tabName?: string;
}): ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const rootState = useRootNavigationState();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const screenWidth = useSharedValue(width);
  useEffect(() => {
    screenWidth.value = width;
  }, [screenWidth, width]);
  const laneKey = useSyncExternalStore(
    subscribeTabReturn,
    tabSwipeLaneKey,
    tabSwipeLaneKey,
  );
  const lane = useMemo(
    () =>
      tabSwipeLane(
        tabName ?? null,
        peekCurrentTabName(),
        peekTabReturnName(),
        peekTabForwardName(),
        peekTabTapFrom(),
        peekTabTapLane(),
      ),
    [laneKey, tabName],
  );

  const hasTabReturn = useHasTabReturn();
  const hasTabForward = useHasTabForward();
  const canDismiss = router.canDismiss();
  const canGoBack =
    intent === 'overview-return'
      ? focusedStackCanPop(rootState)
      : navigationCanGoBack(navigation);
  useEffect(() => {
    if (intent === 'overview-return') {
      rememberFocusedStackCanPop(canGoBack);
    }
  }, [canGoBack, intent]);
  const backEnabled = canActivateSwipeBack({
    gestureEnabled,
    presentation,
    pathname,
    canDismiss,
    canGoBack,
    hasTabReturn,
    intent,
  });
  const forwardEnabled = canActivateSwipeForward({
    gestureEnabled,
    presentation,
    pathname,
    canDismiss,
    canGoBack,
    hasTabForward,
    intent,
  });
  const pager = intent === 'overview-return';
  const tapping = Boolean(peekTabTapFrom());
  const isCurrentLane = !pager || lane === 'current';
  const enabled =
    isCurrentLane && !tapping && (backEnabled || forwardEnabled);
  useFocusEffect(
    useCallback(() => {
      if (!pager) translateX.value = 0;
    }, [pager, translateX]),
  );
  useEffect(() => {
    if (!pager && !enabled) translateX.value = 0;
  }, [enabled, pager, translateX]);

  const goBack = useCallback(() => {
    const action = resolveSwipeBackAction({
      canDismiss: router.canDismiss(),
      canGoBack:
        intent === 'overview-return'
          ? focusedStackCanPop(rootState)
          : navigationCanGoBack(navigation),
      hasTabReturn,
    });
    if (action === 'tab') {
      const href = beginTabReturn();
      if (href) router.navigate(href);
      return;
    }
    if (action === 'pop') {
      goBackOrReplace(router);
    }
  }, [hasTabReturn, intent, navigation, rootState, router]);

  const goForward = useCallback(() => {
    const href = beginTabForward();
    if (href) router.navigate(href);
  }, [router]);

  const panGesture = useMemo(() => {
    const offset = pager ? tabSwipeX : translateX;
    const settle = (
      to: number,
      velocityX: number,
      onRest?: () => void,
    ) => {
      'worklet';
      if (reduceMotion) {
        offset.value = to;
        if (onRest) runOnJS(onRest)();
        return;
      }
      offset.value = withSpring(
        to,
        {
          damping: PAGER_SPRING.damping,
          stiffness: PAGER_SPRING.stiffness,
          mass: PAGER_SPRING.mass,
          overshootClamping: true,
          velocity: velocityX,
        },
        (finished) => {
          if (finished && onRest) runOnJS(onRest)();
        },
      );
    };

    return Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      .activeOffsetX(swipePanActiveOffsetX(backEnabled, forwardEnabled))
      .failOffsetY([-SWIPE_AXIS_SLOP, SWIPE_AXIS_SLOP])
      .onUpdate((event) => {
        if (reduceMotion) return;
        offset.value = swipeTrackedTranslation(
          event.translationX,
          backEnabled,
          forwardEnabled,
        );
      })
      .onEnd((event) => {
        const translationX = swipeTrackedTranslation(
          event.translationX,
          backEnabled,
          forwardEnabled,
        );
        if (
          backEnabled &&
          shouldCommitSwipeBack({
            translationX,
            velocityX: event.velocityX,
            width: screenWidth.value,
          })
        ) {
          settle(screenWidth.value, event.velocityX, goBack);
          return;
        }
        if (
          forwardEnabled &&
          shouldCommitSwipeForward({
            translationX,
            velocityX: event.velocityX,
            width: screenWidth.value,
          })
        ) {
          settle(-screenWidth.value, event.velocityX, goForward);
          return;
        }
        settle(0, event.velocityX);
      });
  }, [
    backEnabled,
    enabled,
    forwardEnabled,
    goBack,
    goForward,
    pager,
    reduceMotion,
    screenWidth,
    translateX,
  ]);

  const sceneStyle = useAnimatedStyle(() => {
    if (!pager) {
      return {
        flex: 1,
        transform: [{ translateX: translateX.value }],
      };
    }
    // Lane + offset both live on the UI thread so a tab tap flips them in
    // the same frame. Deriving the lane from React render state painted the
    // leaving page one frame at translateX = ±width — a blank flash per tap.
    // swipeX feeds the lane too: a tab sitting in both the back and forward
    // stacks parks on whichever side the live drag is about to reveal.
    const lanes = tabSwipeLanes.value;
    const swipeX = tabSwipeX.value;
    return {
      flex: 1,
      transform: [
        {
          translateX: tabSwipeTranslateX(
            tabSwipeLane(
              tabName ?? null,
              lanes.current,
              lanes.back,
              lanes.forward,
              lanes.tapFrom,
              lanes.tapLane,
              swipeX,
            ),
            swipeX,
            screenWidth.value,
          ),
        },
      ],
    };
  }, [pager, tabName]);

  if (!shouldWrapSwipeBackScene({ gestureEnabled, presentation })) {
    return <>{children}</>;
  }

  const scene = (
    <Animated.View
      collapsable={false}
      pointerEvents={isCurrentLane ? 'auto' : 'none'}
      style={[styles.scene, sceneStyle]}>
      {children}
      {pager && enabled && backEnabled ? (
        <AgentTestId
          testID={AgentUiIds.shell.swipeBack}
          label="Swipe back"
          onPress={goBack}
          style={styles.edge}>
          <Animated.View style={styles.edgeFill} />
        </AgentTestId>
      ) : null}
      {pager && enabled && forwardEnabled ? (
        <AgentTestId
          testID={AgentUiIds.shell.swipeForward}
          label="Swipe forward"
          onPress={goForward}
          style={styles.edgeRight}>
          <Animated.View style={styles.edgeFill} />
        </AgentTestId>
      ) : null}
    </Animated.View>
  );

  // Keep the detector mounted even while disabled — swapping the wrapper on
  // enabled flips remounts both pages mid-transition (the load glitch) and
  // races RNGH's native handler attach. The pan itself is `.enabled(enabled)`.
  return <GestureDetector gesture={panGesture}>{scene}</GestureDetector>;
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 28,
    zIndex: 20,
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 28,
    zIndex: 20,
  },
  edgeFill: {
    flex: 1,
  },
});
