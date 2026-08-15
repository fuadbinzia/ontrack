import { useNavigation, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
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

import { durations, easings, springs } from '@/design-system';
import { goBackOrReplace } from '@/utils/navigation';

import {
  canActivateSwipeBack,
  shouldCommitSwipeBack,
  shouldWrapSwipeBackScene,
} from './swipe-back';

export function SwipeBackScene({
  children,
  gestureEnabled,
  presentation,
}: {
  children: ReactNode;
  gestureEnabled?: boolean;
  presentation?: string;
}): ReactElement {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const screenWidth = useSharedValue(width);
  screenWidth.value = width;

  const enabled = canActivateSwipeBack({
    gestureEnabled,
    presentation,
    pathname,
    canDismiss: router.canDismiss(),
    canGoBack: navigation.canGoBack(),
  });

  const goBack = useCallback(() => {
    goBackOrReplace(router);
  }, [router]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-1e5, 16])
        .failOffsetY([-20, 20])
        .onUpdate((event) => {
          if (reduceMotion) return;
          translateX.value = Math.max(0, event.translationX);
        })
        .onEnd((event) => {
          const commit = shouldCommitSwipeBack({
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: screenWidth.value,
          });
          if (!commit) {
            if (reduceMotion) {
              translateX.value = 0;
              return;
            }
            translateX.value = withSpring(0, {
              damping: springs.stiff.damping,
              stiffness: springs.stiff.stiffness,
              mass: springs.stiff.mass,
              overshootClamping: true,
            });
            return;
          }
          if (reduceMotion) {
            translateX.value = 0;
            runOnJS(goBack)();
            return;
          }
          translateX.value = withTiming(
            screenWidth.value,
            { duration: durations.base, easing: easings.exit },
            (finished) => {
              if (finished) runOnJS(goBack)();
            },
          );
        }),
    [enabled, goBack, reduceMotion, screenWidth, translateX],
  );

  const sceneStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  if (!shouldWrapSwipeBackScene({ gestureEnabled, presentation })) {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View collapsable={false} style={[styles.scene, sceneStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
});
