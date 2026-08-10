import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  MotionLayer as SharedMotionLayer,
} from '@/features/travel/travel-sky-motion-layer';
import {
  SKY_VIEW_H,
  SKY_VIEW_W,
} from '@/features/travel/travel-sky-plate';

/** Cool stellar fills — soft blue-white like real night-sky stars (not warm cream). */
export const STAR_FIELD = '#D8E4FF';
const STAR_BRIGHT = '#EAF1FF';

export function starFill(mag: number): string {
  return mag < 1 ? STAR_BRIGHT : STAR_FIELD;
}

/** Night defaults: stable opacity + slightly deeper tilt than day. */
export function MotionLayer({
  driftMs = 32000,
  ...props
}: Omit<
  ComponentProps<typeof SharedMotionLayer>,
  'opacityMode' | 'tiltXAmp' | 'tiltYAmp' | 'driftYAmp'
>) {
  return (
    <SharedMotionLayer
      {...props}
      driftMs={driftMs}
      opacityMode="stable"
      tiltXAmp={16}
      tiltYAmp={10}
      driftYAmp={1}
    />
  );
}

/** Deterministic 0…1 from a small integer seed (no Math in worklets). */
function starSeedUnit(seed: number, salt: number): number {
  const n = (seed * 7919 + salt * 104729) % 10007;
  return (n < 0 ? n + 10007 : n) / 10007;
}

/** Triangle flash 0→1→0 over `[0, 2*width)` of a unit cycle; else 0. */
function unitFlash(t: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  if (t < width) return t / width;
  if (t < width * 2) return 1 - (t - width) / width;
  return 0;
}

/** One shared driver for the whole bright field — phases make flashes feel independent. */
export function useStarTwinkleClock(active: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 5800, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(clock);
    };
  }, [active, clock]);
  return clock;
}

/**
 * Independent-looking opacity flashes via a shared clock + per-star phase.
 * Uses Animated.View (not animated SVG) — Fabric-safe and far cheaper than
 * N× `createAnimatedComponent(Circle)` + per-star `withRepeat` trees.
 */
export function TwinklingStar({
  cx,
  cy,
  r,
  seed,
  baseOpacity,
  color,
  clock,
}: {
  cx: number;
  cy: number;
  r: number;
  seed: number;
  baseOpacity: number;
  color: string;
  clock: SharedValue<number>;
}) {
  const phase = starSeedUnit(seed, 1);
  // Readable sparkle without disco — modest flash vs rest, no halo bloom.
  const flashWidth = 0.06 + starSeedUnit(seed, 3) * 0.08;
  const peak = 0.8 + starSeedUnit(seed, 5) * 0.2;
  // Dim between flashes so the brightening is obvious (was ~0.78 — nearly static).
  const rest = 0.28 + starSeedUnit(seed, 7) * 0.18;
  const doubleFlash = seed % 7 === 0 || seed % 11 === 0;
  const secondBurst = seed % 5 === 0 || seed % 13 === 0;
  const size = Math.max(2.1, r * 2.15);

  const style = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    let flash = unitFlash(t, flashWidth);
    if (secondBurst) {
      flash = Math.max(flash, unitFlash((t + 0.48) % 1, flashWidth * 0.85) * 0.9);
    }
    if (doubleFlash) {
      flash = Math.max(
        flash,
        unitFlash((t + 0.1) % 1, flashWidth * 0.7) * 0.78,
      );
    }
    // Soft always-on shimmer so the field never freezes between sparks.
    const shimmerT = (clock.value * 1.7 + phase * 2.3) % 1;
    const shimmer = unitFlash(shimmerT, 0.48);
    const floor = rest + shimmer * 0.16;
    const bright = floor + flash * peak * (1 - floor);
    return {
      opacity: baseOpacity * bright,
      transform: [{ scale: 0.86 + flash * 0.48 + shimmer * 0.1 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        {
          left: `${(cx / SKY_VIEW_W) * 100}%`,
          top: `${(cy / SKY_VIEW_H) * 100}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function Satellite({
  pathY,
  delayMs,
  duration,
  color,
  tiltY,
}: {
  pathY: number;
  delayMs: number;
  duration: number;
  color: string;
  tiltY: SharedValue<number>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 4000 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, duration, t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.08, 0.9, 1], [0, 0.85, 0.85, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-20, SKY_VIEW_W + 20]) },
      { translateY: pathY + tiltY.value * 6 },
    ],
  }));

  return (
    <Animated.View style={[styles.streak, style]}>
      <Svg width={18} height={8} viewBox="0 0 18 8">
        <Path d="M2 4 H6 M12 4 H16" stroke={color} strokeWidth={1} opacity={0.7} />
        <Circle cx={9} cy={4} r={2.2} fill={color} />
        <Circle cx={9} cy={4} r={1} fill="rgba(255,255,255,0.9)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Occasional meteor streak for clear nights — brighter and more frequent
 * over dark-sky (desert) destinations.
 */
export function ShootingStar({
  startX,
  startY,
  dx,
  dy,
  delayMs,
  pauseMs,
  bright,
}: {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  delayMs: number;
  pauseMs: number;
  bright: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 850, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: pauseMs }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, pauseMs, t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.7, 1], [0, bright, bright * 0.8, 0]),
    transform: [
      { translateX: startX + t.value * dx },
      { translateY: startY + t.value * dy },
      { rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.streak, style]}>
      <Svg width={34} height={4} viewBox="0 0 34 4">
        <Line
          x1={0}
          y1={2}
          x2={30}
          y2={2}
          stroke="rgba(210,228,255,0.5)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Line
          x1={20}
          y1={2}
          x2={32}
          y2={2}
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  streak: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  star: {
    position: 'absolute',
  },
});
