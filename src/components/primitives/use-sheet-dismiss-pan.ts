import { useCallback, useEffect } from 'react';
import { Keyboard } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { durations, easings, springs } from '@/design-system';

type UseSheetDismissPanOptions = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Shared pan-down dismiss for bottom sheets (Modal + in-tree overlays).
 * Attach `panGesture` to the header/grabber slot; apply `sheetStyle` / `scrimStyle`
 * to the card and dim layer; report height via `onSheetLayout`.
 */
export function useSheetDismissPan({ visible, onClose }: UseSheetDismissPanOptions) {
  const reduceMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(480);

  const close = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    dragY.value = 0;
  }, [dragY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragY.value,
      [0, Math.max(sheetHeight.value, 1)],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const onSheetLayout = useCallback(
    (height: number) => {
      if (height > 0) sheetHeight.value = height;
    },
    [sheetHeight],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const threshold = Math.min(160, Math.max(sheetHeight.value * 0.2, 96));
      if (dragY.value > threshold || event.velocityY > 1000) {
        const distance = Math.max(sheetHeight.value, 320);
        if (reduceMotion) {
          runOnJS(close)();
          return;
        }
        dragY.value = withTiming(
          distance,
          { duration: durations.base, easing: easings.exit },
          (finished) => {
            if (finished) runOnJS(close)();
          },
        );
        return;
      }
      dragY.value = withSpring(0, {
        damping: springs.sheet.damping,
        stiffness: springs.sheet.stiffness,
        mass: springs.sheet.mass,
        overshootClamping: true,
      });
    });

  // Tap on the header/grabber dismisses without a child Pressable stealing the pan.
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(close)();
  });
  const headerGesture = Gesture.Exclusive(panGesture, tapGesture);

  return { headerGesture, sheetStyle, scrimStyle, onSheetLayout, close };
}
