import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type SkyMotionLayerProps = {
  depth: number;
  energy: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  delayMs?: number;
  /** Horizontal drift amplitude in plate px (0 = tilt-only). */
  driftAmp?: number;
  /** One-way drift duration ms; higher = lazier clouds. */
  driftMs?: number;
  tiltXAmp?: number;
  tiltYAmp?: number;
  driftYAmp?: number;
  children: ReactNode;
};

/**
 * Shared parallax + optional glide wrapper for itinerary day/night sky plates.
 */
export function SkyMotionLayer({
  depth,
  energy,
  tiltX,
  tiltY,
  delayMs = 0,
  driftAmp = 0,
  driftMs = 28000,
  tiltXAmp = 14,
  tiltYAmp = 9,
  driftYAmp = 1.2,
  children,
}: SkyMotionLayerProps) {
  const drift = useSharedValue(0);

  useEffect(() => {
    if (driftAmp <= 0) return;
    drift.value = 0;
    drift.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: driftMs,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: driftMs,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, drift, driftAmp, driftMs]);

  const style = useAnimatedStyle(() => {
    const opacity = interpolate(energy.value, [0, 1], [0.94, 1]);
    const glide =
      driftAmp > 0
        ? interpolate(drift.value, [0, 1], [-driftAmp, driftAmp])
        : 0;
    const glideY =
      driftAmp > 0
        ? interpolate(drift.value, [0, 1], [-driftYAmp, driftYAmp]) * depth
        : 0;
    return {
      opacity,
      transform: [
        { translateX: tiltX.value * tiltXAmp * depth + glide },
        { translateY: tiltY.value * tiltYAmp * depth + glideY },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Animated.View>
  );
}

/** Local alias kept so day/night source contracts still see `MotionLayer`. */
export const MotionLayer = SkyMotionLayer;
