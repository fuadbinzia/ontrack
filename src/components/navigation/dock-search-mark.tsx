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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { GlassPlate } from '@/components/primitives/glass-plate';
import { colorWithAlpha } from '@/design-system/glass';
import {
  DOCK_SEARCH_HALO_LAYERS,
  DOCK_SEARCH_HALO_ORBIT_MS,
  DOCK_SEARCH_HALO_STROKE,
  dockSearchHaloAmbientAlpha,
  dockSearchHaloCanvasSize,
  dockSearchHaloGlowStops,
  dockSearchHaloInset,
  dockSearchHaloViewRingSize,
  dockSearchHaloViewTrailDeg,
} from '@/features/search/dock-search-layout';
import { useTheme } from '@/hooks/use-theme';

const FAVICON = require('../../../assets/images/favicon.png');
const HALO_GLOW_ID = 'dockSearchHaloGlow';

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
  const orbit = useSharedValue(0);
  // One cheap View rotate — skip heavy loop gates and animated SVG.
  // Android Svg ignores parent transforms and Fabric often skips dashoffset.
  const live = circulating && !reduceMotion;
  const canvas = dockSearchHaloCanvasSize(size);
  const inset = dockSearchHaloInset();
  const stroke = DOCK_SEARCH_HALO_STROKE;
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
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [live, orbit]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
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
        </Svg>
        {live ? (
          <Animated.View
            pointerEvents="none"
            collapsable={false}
            renderToHardwareTextureAndroid
            style={[StyleSheet.absoluteFill, spinStyle]}
          >
            {DOCK_SEARCH_HALO_LAYERS.map((layer, index) => {
              const width = stroke * layer.strokeScale;
              const ring = dockSearchHaloViewRingSize(size, width);
              const ink = colorWithAlpha(
                accent,
                dark ? layer.alphaDark : layer.alphaLight,
              );
              return (
                <View
                  key={layer.ratio}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: ring,
                    height: ring,
                    left: (canvas - ring) / 2,
                    top: (canvas - ring) / 2,
                    borderRadius: ring / 2,
                    borderWidth: width,
                    borderColor: 'transparent',
                    borderTopColor: ink,
                    ...(index === 0 ? { borderRightColor: ink } : null),
                    transform: [
                      { rotate: `${dockSearchHaloViewTrailDeg(index)}deg` },
                    ],
                  }}
                />
              );
            })}
          </Animated.View>
        ) : null}
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
