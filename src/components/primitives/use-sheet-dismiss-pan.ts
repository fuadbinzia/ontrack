import { useCallback, useLayoutEffect } from 'react';
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
  /** Return false when a guard keeps the sheet mounted (for example, discard confirmation). */
  onClose: () => boolean | void;
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
  const entranceY = useSharedValue(0);
  const entranceOpacity = useSharedValue(0);
  const hasPresented = useSharedValue(false);

  const close = useCallback(() => {
    Keyboard.dismiss();
    const shouldRemainOpen = onClose() === false;
    if (!shouldRemainOpen) return;

    // A guarded close kept the sheet mounted. Restore it only after the caller
    // has opened its prompt; normal closes remain below the viewport through
    // unmount so the settled sheet cannot flash for one frame.
    dragY.value = reduceMotion
      ? 0
      : withSpring(0, {
          damping: springs.sheet.damping,
          stiffness: springs.sheet.stiffness,
          mass: springs.sheet.mass,
          overshootClamping: true,
        });
  }, [dragY, onClose, reduceMotion]);

  useLayoutEffect(() => {
    dragY.value = 0;
    entranceY.value = 0;
    entranceOpacity.value = 0;
    hasPresented.value = false;
  }, [dragY, entranceOpacity, entranceY, hasPresented, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceY.value + dragY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity:
      entranceOpacity.value *
      interpolate(
        dragY.value,
        [0, Math.max(sheetHeight.value, 1)],
        [1, 0],
        Extrapolation.CLAMP,
      ),
  }));

  const onSheetLayout = useCallback(
    (height: number) => {
      if (height <= 0) return;
      sheetHeight.value = height;
      if (hasPresented.value) return;
      hasPresented.value = true;

      if (reduceMotion) {
        entranceY.value = 0;
        entranceOpacity.value = 1;
        return;
      }

      // Keep the native modal/card laid out at its final bottom pin, then reveal
      // it from exactly one measured sheet-height below. Unlike a layout-entry
      // animation, these explicit UI-thread values cannot strand the card off-screen
      // if the modal host drops its first painted frame.
      entranceY.value = height;
      entranceOpacity.value = 0;
      entranceY.value = withSpring(0, {
        damping: springs.sheet.damping,
        stiffness: springs.sheet.stiffness,
        mass: springs.sheet.mass,
        overshootClamping: true,
      });
      entranceOpacity.value = withTiming(1, {
        duration: durations.fast,
        easing: easings.enter,
      });
    },
    [
      entranceOpacity,
      entranceY,
      hasPresented,
      reduceMotion,
      sheetHeight,
    ],
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
