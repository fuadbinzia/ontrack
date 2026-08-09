import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    Easing,
    ReduceMotion,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import {
    usePageSurfaceBackground,
    useSafeAreaChrome,
    useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { glassMaterials } from '@/design-system';
import { useLiveFxReady, usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

const TWINKLE_MS = 3800;

/**
 * Deterministic star field — seeded so the sky never reshuffles between
 * renders (a random layout would jitter on every theme toggle).
 * `[xFraction, yFraction, sizeFactor, opacity, phase]`.
 */
const STARS: readonly (readonly [number, number, number, number, 0 | 1])[] = [
  [0.06, 0.05, 1, 0.5, 0],
  [0.14, 0.13, 0.7, 0.34, 1],
  [0.23, 0.04, 1.3, 0.62, 0],
  [0.31, 0.19, 0.7, 0.3, 1],
  [0.39, 0.08, 0.9, 0.44, 0],
  [0.47, 0.23, 1.5, 0.7, 1],
  [0.55, 0.03, 0.7, 0.32, 0],
  [0.63, 0.17, 1, 0.5, 1],
  [0.72, 0.06, 0.8, 0.38, 0],
  [0.81, 0.21, 1.2, 0.58, 1],
  [0.89, 0.09, 0.7, 0.3, 0],
  [0.96, 0.27, 1, 0.46, 1],
  [0.04, 0.31, 0.8, 0.36, 1],
  [0.12, 0.44, 1.1, 0.52, 0],
  [0.27, 0.36, 0.7, 0.28, 1],
  [0.35, 0.52, 0.9, 0.4, 0],
  [0.58, 0.41, 0.7, 0.3, 1],
  [0.68, 0.55, 1, 0.44, 0],
  [0.85, 0.38, 0.8, 0.34, 1],
  [0.93, 0.5, 1.2, 0.54, 0],
  [0.03, 0.58, 1, 0.42, 0],
  [0.17, 0.66, 0.7, 0.26, 1],
  [0.29, 0.74, 0.9, 0.38, 0],
  [0.44, 0.63, 0.7, 0.24, 1],
  [0.51, 0.81, 1.1, 0.46, 0],
  [0.66, 0.71, 0.8, 0.3, 1],
  [0.77, 0.86, 1, 0.4, 0],
  [0.88, 0.68, 0.7, 0.26, 1],
  [0.97, 0.79, 0.9, 0.34, 0],
  [0.09, 0.88, 0.8, 0.3, 1],
  [0.22, 0.95, 1, 0.36, 0],
  [0.6, 0.93, 0.7, 0.24, 1],
];

/** Pale top of the sign-in sky (status-bar shell match). */
function authAtmosphereTopColor(appearance: 'light' | 'dark'): string {
  return appearance === 'dark'
    ? glassMaterials.atmosphere.darkTop
    : glassMaterials.atmosphere.lightBottom;
}

/** Warm floor the provider card floats on (bottom dock match). */
function authAtmosphereBottomColor(appearance: 'light' | 'dark'): string {
  return appearance === 'dark'
    ? glassMaterials.atmosphere.darkBottom
    : glassMaterials.atmosphere.lightTop;
}

function Starfield({ live }: { live: boolean }) {
  const { width, height } = useWindowDimensions();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!live) {
      phase.value = withTiming(0, { duration: 0 });
      return;
    }
    phase.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: TWINKLE_MS,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        withTiming(0, {
          duration: TWINKLE_MS,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [live, phase]);

  // Two counter-phased layers keep 30+ stars alive on two animated styles.
  const layerA = useAnimatedStyle(() => ({ opacity: 0.62 + phase.value * 0.38 }));
  const layerB = useAnimatedStyle(() => ({ opacity: 1 - phase.value * 0.38 }));

  const stars = useMemo(
    () =>
      STARS.map(([x, y, size, opacity, layer], index) => {
        const dot = Math.max(1, size * 1.6);
        return {
          key: `star-${index}`,
          layer,
          style: {
            left: x * width,
            top: y * height,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            opacity,
          },
        };
      }),
    [height, width],
  );

  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layerA]}>
        {stars
          .filter((star) => star.layer === 0)
          .map((star) => (
            <View key={star.key} style={[styles.star, star.style]} />
          ))}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layerB]}>
        {stars
          .filter((star) => star.layer === 1)
          .map((star) => (
            <View key={star.key} style={[styles.star, star.style]} />
          ))}
      </Animated.View>
    </>
  );
}

/** Sky art only — mounted on the app shell, never inside route content. */
function AuthSky() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const twinkle = useLiveFxReady(allowsLoopMotion && !reduceMotion);

  const a = glassMaterials.atmosphere;
  const dark = theme.name === 'dark';
  // Light sky reads palest at the top so the wordmark sits on clean paper and
  // the card lands on warmer cream with enough chroma to frost.
  const colors = dark
    ? ([a.darkTop, a.darkMid, a.darkBottom] as const)
    : ([a.lightBottom, a.lightMid, a.lightTop] as const);
  const orb = dark ? a.darkOrb : a.lightOrb;
  const cool = dark ? a.darkCool : a.lightCool;
  const orbSize = Math.max(width, height) * 0.78;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...colors]}
        locations={[0, 0.46, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {dark ? <Starfield live={twinkle} /> : null}
      <View
        style={[
          styles.orb,
          {
            width: orbSize,
            height: orbSize,
            top: -orbSize * 0.3,
            right: -orbSize * 0.4,
            experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${orb} 0%, transparent 74%)`,
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          {
            width: orbSize * 0.9,
            height: orbSize * 0.9,
            bottom: -orbSize * 0.44,
            left: -orbSize * 0.38,
            experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${cool} 0%, transparent 76%)`,
          },
        ]}
      />
      <LinearGradient
        colors={
          dark
            ? ['rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.3)']
            : [
                'rgba(255,255,255,0.5)',
                'rgba(255,255,255,0.14)',
                'transparent',
                'rgba(80,55,35,0.05)',
              ]
        }
        locations={dark ? [0, 0.38, 1] : [0, 0.26, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Full-bleed cosmic wash for the signed-out shell.
 * Page atmosphere (not chrome) — an allowed opaque surface under the frost.
 *
 * The sky mounts on the app shell (window y=0) instead of inside the route so
 * the gradient, stars, and orbs run behind the status bar as one plane — a
 * route-level wash would start at the top inset and leave a flat band there.
 */
export function AuthAtmosphere({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const sky = useMemo(() => <AuthSky />, []);

  useSafeAreaChrome(authAtmosphereTopColor(theme.name), { priority: 1 });
  useSafeAreaChromeOverlay(sky, height, { priority: 1 });
  usePageSurfaceBackground(authAtmosphereBottomColor(theme.name));

  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  orb: { position: 'absolute' },
  star: { position: 'absolute', backgroundColor: '#EAF1FF' },
});
