import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
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
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

import { SKY_PLATE_VIEWBOX, SKY_VIEW_W } from '@/features/travel/travel-sky-plate';
import type { TiltSkyMotion } from '@/features/travel/use-tilt-sky-motion';

export { destinationShowsAurora } from '@/features/travel/travel-sky-aurora-destinations';

/** Steady veil strength — night brightness, not a looping pulse. */
export function auroraVeilOpacity(muted?: boolean): number {
  return muted ? 0.28 : 0.55;
}

/**
 * Soft aurora curtains for Iceland (and kin) night headers.
 * Green/teal with a violet edge — restrained drift, not a brightness cycle.
 */
export function TravelSkyAurora({
  statusBand,
  motion,
  muted,
  liveFx = true,
}: {
  statusBand: number;
  motion: TiltSkyMotion;
  /** Dim under clouds / rain. */
  muted?: boolean;
  /** When false, hold a static veil (no drift). */
  liveFx?: boolean;
}) {
  const drift = useSharedValue(0.5);
  const veil = auroraVeilOpacity(muted);

  useEffect(() => {
    if (!liveFx) {
      cancelAnimation(drift);
      drift.value = 0.5;
      return;
    }
    drift.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(drift);
  }, [drift, liveFx]);

  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          interpolate(drift.value, [0, 1], [-6, 8]) + motion.tiltX.value * 5,
      },
      { translateY: motion.tiltY.value * 3 },
    ],
  }));

  // Reach into the status-bar band so the green/teal veil continues behind the
  // clock (celestial discs stay cleared separately via SKY_CELESTIAL_CLEARANCE).
  const y0 = Math.max(0, statusBand * 0.2);
  const y1 = statusBand + 52;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: veil }, style]}
      pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={SKY_PLATE_VIEWBOX}
        preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="auroraGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="rgba(120,255,190,0.55)" />
            <Stop offset="45%" stopColor="rgba(60,220,160,0.28)" />
            <Stop offset="100%" stopColor="rgba(40,180,140,0)" />
          </LinearGradient>
          <LinearGradient id="auroraTeal" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="rgba(100,240,220,0.4)" />
            <Stop offset="50%" stopColor="rgba(50,200,190,0.18)" />
            <Stop offset="100%" stopColor="rgba(40,160,170,0)" />
          </LinearGradient>
          <LinearGradient id="auroraViolet" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="rgba(180,140,255,0.28)" />
            <Stop offset="55%" stopColor="rgba(120,90,220,0.12)" />
            <Stop offset="100%" stopColor="rgba(80,60,160,0)" />
          </LinearGradient>
        </Defs>

        {/* Broad veil */}
        <Ellipse
          cx={SKY_VIEW_W * 0.42}
          cy={y0 + 18}
          rx={190}
          ry={36}
          fill="url(#auroraGreen)"
          opacity={0.85}
        />

        {/*
          Curtain ribbons — start/end well past both plate edges so the
          straight closure edges never show (no rectangular cuts on screen);
          vertical gradients fade the fills to zero before the bottom edge.
        */}
        <Path
          d={`M-50 ${y1} C 20 ${y0}, 110 ${y0 + 40}, 160 ${y0 + 8} C 210 ${y0 - 10}, 290 ${y0 + 36}, 410 ${y0 + 4} L 410 ${y1 + 20} L -50 ${y1 + 20} Z`}
          fill="url(#auroraTeal)"
          opacity={0.7}
        />
        <Path
          d={`M-40 ${y1 + 8} C 60 ${y0 + 6}, 170 ${y0 + 44}, 220 ${y0 + 12} C 270 ${y0 - 4}, 330 ${y0 + 30}, 420 ${y0 + 10} L 420 ${y1 + 24} L -40 ${y1 + 24} Z`}
          fill="url(#auroraViolet)"
          opacity={0.55}
        />
        <Path
          d={`M-60 ${y1 - 4} C 30 ${y0 + 14}, 100 ${y0 - 2}, 170 ${y0 + 22} C 230 ${y0 + 42}, 290 ${y0 + 2}, 420 ${y0 + 18} L 420 ${y1 + 16} L -60 ${y1 + 16} Z`}
          fill="url(#auroraGreen)"
          opacity={0.45}
        />
      </Svg>
    </Animated.View>
  );
}
