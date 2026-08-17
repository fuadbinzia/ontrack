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
  AUTH_COPY_SCALE_MIN,
  AUTH_ORBIT_ELLIPSE,
  AUTH_ORBIT_GUIDES,
  AUTH_ORBIT_TABS,
  AUTH_PLANET_ICON_GAP_FRAC,
  authCopyFramePx,
  authCopyMaxHeightFrac,
  authOrbitLabelStyle,
  authOrbitNodesForTabs,
} from './auth-constellation-layout';
import { settleAuthCanvasExtent } from './auth-canvas-extent';

/** Matches `styles.hero` in `auth-screen.tsx` so the bleed stays symmetric. */
export const HERO_MAX_WIDTH = 620;

/** Slow revolution so labels stay readable while the ring feels alive. */
const ORBIT_MS = 240000;
const BREATHE_MS = 4200;

const CopyScaleContext = createContext(1);

/**
 * Type scale for hero copy, so the headline shrinks with the canvas instead of
 * being clipped when the page has to fit a short window without scrolling.
 */
export function useAuthCopyScale(): number {
  return useContext(CopyScaleContext);
}

function ConstellationNode({
  label,
  icon,
  deg,
  well,
  slot,
  width,
  height,
  orbit,
}: {
  label: string;
  icon: AppIconName;
  deg: number;
  well: number;
  slot: number;
  width: number;
  height: number;
  orbit: SharedValue<number>;
}) {
  const theme = useTheme();
  const { typography } = useResponsive();
  const { cx, cy, rx, ry } = AUTH_ORBIT_ELLIPSE;
  const labelStyle = authOrbitLabelStyle(slot, typography.caption);

  // Ride the ellipse around the copy. Labels stay upright — only position
  // advances with orbit. No entrance animation: bootstrap mounts skip
  // Reanimated `entering`, which would strand nodes hidden.
  const style = useAnimatedStyle(() => {
    const theta = ((deg + orbit.value * 360) * Math.PI) / 180;
    return {
      left: (cx + rx * Math.cos(theta)) * width,
      top: (cy + ry * Math.sin(theta)) * height,
    };
  });

  return (
    <Animated.View
      style={[
        styles.node,
        {
          width: slot,
          marginLeft: -slot / 2,
          marginTop: -well / 2,
        },
        style,
      ]}>
      <GlassIconWell size={well} borderRadius={well / 2}>
        <Symbol name={icon} size={well * 0.46} color={theme.textSecondary} />
      </GlassIconWell>
      <AppText
        variant="caption"
        color="secondary"
        align="center"
        numberOfLines={1}
        style={labelStyle}>
        {label}
      </AppText>
    </Animated.View>
  );
}

function Planet({
  width,
  height,
  well,
  breathe,
  animate,
}: {
  width: number;
  height: number;
  well: number;
  breathe: SharedValue<number>;
  animate: boolean;
}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  // Planet stays inside the orbit: satellite centres ride `orbitPx`, wells
  // reach inward by ~half well — leave that plus a gap so icons never kiss.
  const orbitPx = Math.min(
    width * AUTH_ORBIT_ELLIPSE.rx,
    height * AUTH_ORBIT_ELLIPSE.ry,
  );
  const gap = Math.min(width, height) * AUTH_PLANET_ICON_GAP_FRAC;
  const diameter = Math.max(0, (orbitPx - well / 2 - gap) * 2);
  const bloom = diameter * 1.35;


  const cx = width * AUTH_ORBIT_ELLIPSE.cx;
  const cy = height * AUTH_ORBIT_ELLIPSE.cy;

  const limb = colorWithAlpha(theme.accentPrimary, dark ? 0.5 : 0.38);
  const core = dark ? 'rgba(20, 28, 34, 0.72)' : 'rgba(241, 244, 245, 0.55)';
  const halo = colorWithAlpha(theme.accentPrimary, dark ? 0.22 : 0.16);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.78 + breathe.value * 0.22 : 1,
    transform: [{ scale: animate ? 1 + breathe.value * 0.03 : 1 }],
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
 * The signed-out hero: every onTrack surface as a satellite orbiting the
 * welcome copy — one ring, one idea.
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
  // column so the ring does not drift away from the copy.
  const width = Math.min(windowWidth, HERO_MAX_WIDTH + bleed * 2);
  // The canvas takes whatever the provider card leaves. Until first layout,
  // fall back to a window fraction so the sky paints on the very first frame.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const height =
    measuredHeight || Math.min(470, Math.max(280, windowHeight * 0.38));
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setMeasuredHeight((prev) => settleAuthCanvasExtent(prev, next));
  }, []);
  const well = Math.min(48, Math.max(30, height * 0.115));
  const slot = well * 1.95;
  const copyFrame = authCopyFramePx(width, height, well);
  const copyMaxHeight = Math.min(
    copyFrame.height,
    height * authCopyMaxHeightFrac(well / height),
  );
  const copyScale = Math.min(
    1,
    Math.max(AUTH_COPY_SCALE_MIN, height / AUTH_COPY_BASE_HEIGHT),
    Math.max(
      AUTH_COPY_SCALE_MIN,
      copyMaxHeight / (AUTH_COPY_BASE_HEIGHT * AUTH_COPY_SCALE_MIN),
    ),
  );

  const orbit = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (!drifting) {
      orbit.value = withTiming(0, {
        duration: 0,
        reduceMotion: ReduceMotion.System,
      });
      breathe.value = withTiming(0, {
        duration: 0,
        reduceMotion: ReduceMotion.System,
      });
      return;
    }
    orbit.value = 0;
    orbit.value = withRepeat(
      withTiming(1, {
        duration: ORBIT_MS,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, {
        duration: BREATHE_MS,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [breathe, drifting, orbit]);

  const nodes = useMemo(() => {
    const tabs = AUTH_ORBIT_TABS.filter(
      (node) => !(node.dropWhenCompact && widthClass === 'compact'),
    );
    return authOrbitNodesForTabs(tabs).map((node) => ({
      ...node,
      meta: TAB_META[node.tab],
    }));
  }, [widthClass]);

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
      <Planet
        width={width}
        height={height}
        well={well}
        breathe={breathe}
        animate={drifting}
      />
      <View
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={StyleSheet.absoluteFill}>
        {AUTH_ORBIT_GUIDES.map((guide, index) => {
          const w = guide.rx * width * 2;
          const h = guide.ry * height * 2;
          return (
            <View
              key={`orbit-${index}`}
              style={[
                styles.orbit,
                {
                  left: guide.cx * width - w / 2,
                  top: guide.cy * height - h / 2,
                  width: w,
                  height: h,
                  borderRadius: '50%',
                  borderColor: orbitColor,
                },
              ]}
            />
          );
        })}
        {nodes.map((node) =>
          node.meta ? (
            <ConstellationNode
              key={node.tab}
              label={node.meta.label}
              icon={node.meta.icon}
              deg={node.deg}
              well={well}
              slot={slot}
              width={width}
              height={height}
              orbit={orbit}
            />
          ) : null,
        )}
      </View>
      <View
        style={[
          styles.copy,
          {
            left: copyFrame.left,
            top: copyFrame.top,
            width: copyFrame.width,
            maxHeight: copyMaxHeight,
            gap: spacing.xs * copyScale,
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
  limb: {
    borderWidth: 1,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  orbit: { position: 'absolute', borderWidth: 1, borderStyle: 'dotted' },
  node: { position: 'absolute', alignItems: 'center', gap: 3 },
  copy: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
