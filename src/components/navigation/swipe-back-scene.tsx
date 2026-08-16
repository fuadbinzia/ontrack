import {
  useFocusEffect,
  useNavigation,
  usePathname,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { easings, springs } from '@/design-system';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { goBackOrReplace } from '@/utils/navigation';

import {
  beginTabForward,
  beginTabReturn,
  resolveSwipeBackAction,
  useHasTabForward,
  useHasTabReturn,
} from './overview-return';
import {
  canActivateSwipeBack,
  canActivateSwipeForward,
  focusedStackCanPop,
  navigationCanGoBack,
  OVERVIEW_RETURN_DRAG_RATIO,
  overviewReturnCommitMs,
  overviewReturnDragProgress,
  overviewReturnOpacity,
  overviewReturnShiftX,
  rememberFocusedStackCanPop,
  shouldCommitSwipeBack,
  shouldCommitSwipeForward,
  shouldWrapSwipeBackScene,
  swipeBackFollowsScene,
} from './swipe-back';

export function SwipeBackScene({
  children,
  gestureEnabled,
  presentation,
  intent = 'stack',
}: {
  children: ReactNode;
  gestureEnabled?: boolean;
  presentation?: string;
  intent?: 'stack' | 'overview-return';
}): ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const rootState = useRootNavigationState();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const screenWidth = useSharedValue(width);
  screenWidth.value = width;

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
  const enabled = backEnabled || forwardEnabled;
  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
    }, [translateX]),
  );
  useEffect(() => {
    if (!enabled) translateX.value = 0;
  }, [enabled, translateX]);

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
    const cancel = () => {
      'worklet';
      if (reduceMotion) {
        translateX.value = 0;
        return;
      }
      translateX.value = withSpring(0, {
        damping: springs.gentle.damping,
        stiffness: springs.gentle.stiffness,
        mass: springs.gentle.mass,
        overshootClamping: true,
      });
    };
    const commitTab = (
      direction: 1 | -1,
      velocityX: number,
      onCommit: () => void,
    ) => {
      'worklet';
      if (reduceMotion) {
        translateX.value = 0;
        runOnJS(onCommit)();
        return;
      }
      const duration = overviewReturnCommitMs(velocityX);
      if (!swipeBackFollowsScene(intent)) {
        translateX.value = withTiming(
          direction * screenWidth.value * OVERVIEW_RETURN_DRAG_RATIO,
          { duration, easing: easings.standard },
          (finished) => {
            if (finished) runOnJS(onCommit)();
          },
        );
        return;
      }
      translateX.value = withTiming(
        direction * screenWidth.value,
        { duration, easing: easings.standard },
        (finished) => {
          if (finished) runOnJS(onCommit)();
        },
      );
    };

    const backPan = Gesture.Pan()
      .enabled(backEnabled)
      .activeOffsetX([-1e5, 16])
      .failOffsetY([-20, 20])
      .onUpdate((event) => {
        if (reduceMotion) return;
        translateX.value = Math.max(0, event.translationX);
      })
      .onEnd((event) => {
        if (
          shouldCommitSwipeBack({
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: screenWidth.value,
          })
        ) {
          commitTab(1, event.velocityX, goBack);
          return;
        }
        cancel();
      });

    const forwardPan = Gesture.Pan()
      .enabled(forwardEnabled)
      .hitSlop({ left: -(Math.max(width, 36) - 36) })
      .activeOffsetX([-16, 1e5])
      .failOffsetY([-20, 20])
      .onUpdate((event) => {
        if (reduceMotion) return;
        translateX.value = Math.min(0, event.translationX);
      })
      .onEnd((event) => {
        if (
          shouldCommitSwipeForward({
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: screenWidth.value,
          })
        ) {
          commitTab(-1, event.velocityX, goForward);
          return;
        }
        cancel();
      });

    if (!forwardEnabled) return backPan;
    if (!backEnabled) return forwardPan;
    return Gesture.Race(backPan, forwardPan);
  }, [
    backEnabled,
    forwardEnabled,
    goBack,
    goForward,
    intent,
    reduceMotion,
    screenWidth,
    translateX,
    width,
  ]);

  const sceneStyle = useAnimatedStyle(() => {
    if (!swipeBackFollowsScene(intent)) {
      const progress = overviewReturnDragProgress(
        translateX.value,
        screenWidth.value,
      );
      const shift =
        overviewReturnShiftX(progress) * (translateX.value < 0 ? -1 : 1);
      return {
        flex: 1,
        opacity: overviewReturnOpacity(progress),
        transform: [{ translateX: shift }],
      };
    }
    return {
      flex: 1,
      transform: [{ translateX: translateX.value }],
    };
  });

  if (!shouldWrapSwipeBackScene({ gestureEnabled, presentation })) {
    return <>{children}</>;
  }
  // Keep iOS native stack pop unwrapped; only mount the JS pan when it can win.
  if (intent === 'overview-return' && !enabled) {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View collapsable={false} style={[styles.scene, sceneStyle]}>
        {children}
        {intent === 'overview-return' && backEnabled ? (
          <AgentTestId
            testID={AgentUiIds.shell.swipeBack}
            label="Swipe back"
            onPress={goBack}
            style={styles.edge}>
            <Animated.View style={styles.edgeFill} />
          </AgentTestId>
        ) : null}
        {intent === 'overview-return' && forwardEnabled ? (
          <AgentTestId
            testID={AgentUiIds.shell.swipeForward}
            label="Swipe forward"
            onPress={goForward}
            style={styles.edgeRight}>
            <Animated.View style={styles.edgeFill} />
          </AgentTestId>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
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
