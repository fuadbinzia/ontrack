import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { GlassPlate } from '@/components/primitives/glass-plate';
import { colorWithAlpha } from '@/design-system/glass';
import {
  DOCK_SEARCH_HALO_LAYERS,
  DOCK_SEARCH_HALO_ORBIT_MS,
  DOCK_SEARCH_HALO_STROKE,
  dockSearchHaloAmbientAlpha,
  dockSearchHaloArcLength,
  dockSearchHaloCanvasSize,
  dockSearchHaloDashOffset,
  dockSearchHaloGlowStops,
  dockSearchHaloInset,
  dockSearchHaloRadius,
} from '@/features/search/dock-search-layout';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

const FAVICON = require('../../../assets/images/favicon.png');
const HALO_GLOW_ID = 'dockSearchHaloGlow';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DockSearchMark({
  size,
  lift,
  circulating,
}: {
  size: number;
  lift: number;
  circulating: boolean;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const orbit = useSharedValue(0);
  const live = circulating && allowsLoopMotion && !reduceMotion;
  const canvas = dockSearchHaloCanvasSize(size);
  const inset = dockSearchHaloInset();
  const radius = dockSearchHaloRadius(size);
  const stroke = DOCK_SEARCH_HALO_STROKE;
  const circumference = 2 * Math.PI * radius;
  const accent = theme.accentPrimary;
  const dark = theme.name === 'dark';
  const ambient = dockSearchHaloAmbientAlpha(dark);
  const glowStops = dockSearchHaloGlowStops(size);

  useEffect(() => {
    if (!live) {
      orbit.value = 0;
      return;
    }
    orbit.value = 0;
    orbit.value = withRepeat(
      withTiming(1, {
        duration: DOCK_SEARCH_HALO_ORBIT_MS,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [live, orbit]);

  const cometProps = useAnimatedProps(() => ({
    strokeDashoffset: dockSearchHaloDashOffset(orbit.value, circumference),
  }));

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          transform: [{ translateY: -lift }],
        },
      ]}
    >
      <View
        collapsable={false}
        style={[
          styles.halo,
          {
            width: canvas,
            height: canvas,
            left: -inset,
            top: -inset,
          },
        ]}
      >
        <Svg width={canvas} height={canvas}>
          <Defs>
            <RadialGradient id={HALO_GLOW_ID} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={accent} stopOpacity={0} />
              <Stop
                offset={`${glowStops.innerPct}%`}
                stopColor={accent}
                stopOpacity={0}
              />
              <Stop
                offset={`${glowStops.peakPct}%`}
                stopColor={accent}
                stopOpacity={ambient}
              />
              <Stop offset="100%" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={canvas / 2}
            cy={canvas / 2}
            r={canvas / 2}
            fill={`url(#${HALO_GLOW_ID})`}
          />
          {live
            ? DOCK_SEARCH_HALO_LAYERS.map((layer) => (
                <AnimatedCircle
                  key={layer.ratio}
                  cx={canvas / 2}
                  cy={canvas / 2}
                  r={radius}
                  stroke={colorWithAlpha(
                    accent,
                    dark ? layer.alphaDark : layer.alphaLight,
                  )}
                  strokeWidth={stroke * layer.strokeScale}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={[
                    dockSearchHaloArcLength(circumference, layer.ratio),
                    circumference,
                  ]}
                  strokeDashoffset={0}
                  animatedProps={cometProps}
                />
              ))
            : null}
        </Svg>
      </View>
      <GlassPlate
        airy
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
      >
        <Image
          source={FAVICON}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      </GlassPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  halo: {
    position: 'absolute',
  },
});
