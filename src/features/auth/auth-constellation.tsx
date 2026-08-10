import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    View,
    useWindowDimensions,
    type LayoutChangeEvent,
} from 'react-native';
import Animated, {
    Easing,
    ReduceMotion,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';

import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import { AppText, GlassIconWell, Symbol } from '@/components/primitives';
import { colorWithAlpha, type AppIconName } from '@/design-system';
import { useLiveFxReady, usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import {
  AUTH_COPY_BASE_HEIGHT,
  AUTH_COPY_TOP,
  AUTH_COPY_WIDTH,
  AUTH_ORBIT_NODES,
  authCopyMaxHeightFrac,
} from './auth-constellation-layout';
import { settleAuthCanvasExtent } from './auth-canvas-extent';

/** Matches `styles.hero` in `auth-screen.tsx` so the bleed stays symmetric. */
export const HERO_MAX_WIDTH = 620;

/** Whole-group sway, in degrees, at the extremes of the drift cycle. */
const SWAY_DEG = 2.4;
const SWAY_MS = 7600;

const CopyScaleContext = createContext(1);

/**
 * Type scale for hero copy, so the headline shrinks with the canvas instead of
 * being clipped when the page has to fit a short window without scrolling.
 */
export function useAuthCopyScale(): number {
  return useContext(CopyScaleContext);
}

/** Dotted guides: `[cx, cy, rx, ry]` in canvas fractions. */
const ORBITS: readonly (readonly [number, number, number, number])[] = [
  [0.68, 0.4, 0.42, 0.34],
  [0.58, 0.5, 0.31, 0.34],
  [0.58, 0.3, 0.56, 0.58],
];

function ConstellationNode({
  label,
  icon,
  x,
  y,
  well,
  slot,
  width,
  height,
  sway,
}: {
  label: string;
  icon: AppIconName;
  x: number;
  y: number;
  well: number;
  slot: number;
  width: number;
  height: number;
  sway: SharedValue<number>;
}) {
  const theme = useTheme();

  // Counter-rotate by the group's sway so glyphs and labels stay upright
  // while the orbit drifts. Deliberately no entrance animation: this screen
  // mounts during app bootstrap, where Reanimated skips `entering`, which
  // would strand every node at its hidden initial state.
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-sway.value * SWAY_DEG}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: x * width,
          top: y * height,
          width: slot,
          marginLeft: -slot / 2,
          marginTop: -well / 2,
        },
        style,
      ]}>
      <GlassIconWell size={well} borderRadius={well / 2}>
        <Symbol name={icon} size={well * 0.46} color={theme.textSecondary} />
      </GlassIconWell>
      <AppText variant="caption" color="secondary" align="center" fit>
        {label}
      </AppText>
    </Animated.View>
  );
}

function Planet({
  width,
  height,
  sway,
  animate,
}: {
  width: number;
  height: number;
  sway: SharedValue<number>;
  animate: boolean;
}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  // Height-clamped so a compressed canvas keeps a sphere, not a clipped arc.
  const diameter = Math.min(width * 0.68, height * 0.82);
  const bloom = diameter * 1.45;
  const cx = width * 0.7;
  const cy = height * 0.44;

  const limb = colorWithAlpha(theme.accentPrimary, dark ? 0.5 : 0.38);
  const core = dark ? 'rgba(10,9,14,0.72)' : 'rgba(255,251,244,0.5)';
  const halo = colorWithAlpha(theme.accentPrimary, dark ? 0.22 : 0.16);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.78 + sway.value * 0.22 : 1,
    transform: [{ scale: animate ? 1 + sway.value * 0.03 : 1 }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            left: cx - bloom / 2,
            top: cy - bloom / 2,
            width: bloom,
            height: bloom,
            borderRadius: bloom / 2,
            experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${halo} 0%, transparent 68%)`,
          },
          bloomStyle,
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            left: cx - diameter / 2,
            top: cy - diameter / 2,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            experimental_backgroundImage: `radial-gradient(circle at 72% 68%, ${limb} 0%, ${halo} 22%, ${core} 58%, ${core} 100%)`,
          },
        ]}
      />
      {/* Lit limb — a rim arc rather than a full ring, so the sphere reads
          as lit from the lower right the way the sky implies. */}
      <View
        pointerEvents="none"
        style={[
          styles.absolute,
          styles.limb,
          {
            left: cx - diameter / 2,
            top: cy - diameter / 2,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderBottomColor: colorWithAlpha(theme.accentPrimary, 0.55),
            borderRightColor: colorWithAlpha(theme.accentPrimary, 0.4),
          },
        ]}
      />
    </>
  );
}

/**
 * The signed-out hero: every onTrack surface as a lit satellite around one
 * planet, with the welcome copy sharing the same field.
 */
export function AuthConstellation({
  children,
  bleed = 0,
}: PropsWithChildren<{ bleed?: number }>) {
  const theme = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { spacing, widthClass } = useResponsive();
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const drifting = useLiveFxReady(allowsLoopMotion && !reduceMotion);

  // Bleed to the display edge on phones; on tablets stay inside the hero
  // column so the planet does not drift away from the copy.
  const width = Math.min(windowWidth, HERO_MAX_WIDTH + bleed * 2);
  // The canvas takes whatever the provider card leaves. Until first layout,
  // fall back to a window fraction so the sky paints on the very first frame.
  // Track the live slot afterward — a taller card must compress the orbit
  // (busy/error chrome floats above the plate and does not own this height).
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const height =
    measuredHeight || Math.min(470, Math.max(280, windowHeight * 0.38));
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setMeasuredHeight((prev) => settleAuthCanvasExtent(prev, next));
  }, []);
  const well = Math.min(48, Math.max(30, height * 0.115));
  const slot = well * 1.95;
  const copyMaxHeight = height * authCopyMaxHeightFrac(well / height);
  // Take the tighter of canvas height vs. the clear band under the intro so a
  // compressed upgrade hero cannot run "your devices" into Games.
  const copyScale = Math.min(
    1,
    Math.max(0.62, height / AUTH_COPY_BASE_HEIGHT),
    Math.max(0.62, copyMaxHeight / (AUTH_COPY_BASE_HEIGHT * 0.55)),
  );

  const sway = useSharedValue(0);
  useEffect(() => {
    if (!drifting) {
      sway.value = withTiming(0, {
        duration: 0,
        reduceMotion: ReduceMotion.System,
      });
      return;
    }
    // Ease out to +1, then yo-yo ±1 forever. A non-reversed sequence that
    // ended at -1 used to snap back to 0 on every withRepeat restart.
    sway.value = withSequence(
      withTiming(1, {
        duration: SWAY_MS / 2,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.System,
      }),
      withRepeat(
        withTiming(-1, {
          duration: SWAY_MS,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [drifting, sway]);

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * SWAY_DEG}deg` }],
  }));

  const nodes = useMemo(
    () =>
      AUTH_ORBIT_NODES.filter(
        (node) => !(node.dropWhenCompact && widthClass === 'compact'),
      ).map((node) => ({
        ...node,
        meta: TAB_META[node.tab],
      })),
    [widthClass],
  );

  const orbitColor = colorWithAlpha(
    theme.accentPrimary,
    theme.name === 'dark' ? 0.24 : 0.28,
  );
  const summary = `onTrack keeps ${nodes
    .map((node) => node.meta?.label)
    .filter(Boolean)
    .join(', ')} in one rhythm.`;

  return (
    <View
      onLayout={onLayout}
      style={[styles.canvas, { width, marginHorizontal: -bleed }]}>
      <Planet width={width} height={height} sway={sway} animate={drifting} />
      <Animated.View
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={[StyleSheet.absoluteFill, groupStyle]}>
        {ORBITS.map(([cx, cy, rx, ry], index) => (
          <View
            key={`orbit-${index}`}
            style={[
              styles.orbit,
              {
                left: cx * width - rx * width,
                top: cy * height - ry * height,
                width: rx * width * 2,
                height: ry * height * 2,
                borderRadius: rx * width,
                borderColor: orbitColor,
              },
            ]}
          />
        ))}
        {nodes.map((node) =>
          node.meta ? (
            <ConstellationNode
              key={node.tab}
              label={node.meta.label}
              icon={node.meta.icon}
              x={node.x}
              y={node.y}
              well={well}
              slot={slot}
              width={width}
              height={height}
              sway={sway}
            />
          ) : null,
        )}
      </Animated.View>
      <View
        style={[
          styles.copy,
          {
            left: bleed,
            top: height * AUTH_COPY_TOP,
            width: width * AUTH_COPY_WIDTH,
            maxHeight: copyMaxHeight,
            gap: spacing.sm * copyScale,
          },
        ]}>
        <CopyScaleContext.Provider value={copyScale}>
          {children}
        </CopyScaleContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 0, alignSelf: 'center', overflow: 'hidden' },
  absolute: { position: 'absolute' },
  limb: { borderWidth: 1, borderTopColor: 'transparent', borderLeftColor: 'transparent' },
  orbit: { position: 'absolute', borderWidth: 1, borderStyle: 'dotted' },
  node: { position: 'absolute', alignItems: 'center', gap: 3 },
  copy: { position: 'absolute' },
});
