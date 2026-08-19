import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { GlassPlate } from '@/components/primitives';
import { colorWithAlpha } from '@/design-system';
import {
  DOCK_SEARCH_HALO_ORBIT_MS,
  DOCK_SEARCH_HALO_PAD,
  DOCK_SEARCH_HALO_STROKE,
  DOCK_SEARCH_HALO_TRAIL_RATIO,
  dockSearchHaloArcLength,
  dockSearchHaloSize,
} from '@/features/search/dock-search-layout';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

const FAVICON = require('../../../assets/images/favicon.png');

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
  const haloSize = dockSearchHaloSize(size);
  const stroke = DOCK_SEARCH_HALO_STROKE;
  const radius = (haloSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = dockSearchHaloArcLength(circumference);
  const trail = dockSearchHaloArcLength(circumference, DOCK_SEARCH_HALO_TRAIL_RATIO);
  const accent = theme.accentPrimary;
  const bloom = colorWithAlpha(accent, theme.name === 'dark' ? 0.22 : 0.16);
  const track = colorWithAlpha(accent, theme.name === 'dark' ? 0.42 : 0.32);
  const trailInk = colorWithAlpha(accent, theme.name === 'dark' ? 0.55 : 0.42);

  useEffect(() => {
    if (!live) {
      orbit.value = 0.12;
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

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  return (
    <View
      pointerEvents="none"
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
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            left: -DOCK_SEARCH_HALO_PAD,
            top: -DOCK_SEARCH_HALO_PAD,
          },
        ]}
      >
        <Svg width={haloSize} height={haloSize}>
          <Circle
            cx={haloSize / 2}
            cy={haloSize / 2}
            r={radius}
            stroke={bloom}
            strokeWidth={stroke * 2.6}
            fill="none"
          />
          <Circle
            cx={haloSize / 2}
            cy={haloSize / 2}
            r={radius}
            stroke={track}
            strokeWidth={stroke * 0.7}
            fill="none"
          />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={haloSize} height={haloSize}>
            <Circle
              cx={haloSize / 2}
              cy={haloSize / 2}
              r={radius}
              stroke={trailInk}
              strokeWidth={stroke * 1.45}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${trail} ${circumference}`}
            />
            <Circle
              cx={haloSize / 2}
              cy={haloSize / 2}
              r={radius}
              stroke={accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${arc} ${circumference}`}
            />
          </Svg>
        </Animated.View>
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
