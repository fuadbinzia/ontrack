import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlassPlate } from '@/components/primitives';
import { colorWithAlpha } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { authPalette } from './auth-palette';

const ORBIT_MS = 3200;

/**
 * onTrack lens mark — a mist disc holding a tilted orbit ring and the
 * ink bead that rides it. Dusty-blue shell mark (mock), not app-wide copper.
 */
export function AuthBrandMark({ size }: { size?: number }) {
  const theme = useTheme();
  const { s } = useResponsive();
  const { allowsLoopMotion } = usePerformanceTier();
  const live = allowsLoopMotion;

  const box = size ?? Math.max(40, s(44));
  const ring = box * 0.58;
  const bead = Math.max(5, box * 0.17);
  const rx = ring * 0.5;
  const ry = ring * 0.5 * 0.82;
  const tiltRad = (-24 * Math.PI) / 180;
  const ink = theme.name === 'dark' ? authPalette.nightDust : authPalette.ink;
  const rim = theme.name === 'dark' ? authPalette.nightFog : authPalette.dust;

  const orbit = useSharedValue(0.12);

  useEffect(() => {
    if (!live) {
      orbit.value = 0.12;
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
  }, [live, orbit]);

  const beadStyle = useAnimatedStyle(() => {
    const theta = orbit.value * Math.PI * 2;
    const x = rx * Math.cos(theta);
    const y = ry * Math.sin(theta);
    const cos = Math.cos(tiltRad);
    const sin = Math.sin(tiltRad);
    return {
      transform: [
        { translateX: x * cos - y * sin },
        { translateY: x * sin + y * cos },
      ],
    };
  });

  return (
    <GlassPlate
      mist
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.disc,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          borderColor: colorWithAlpha(rim, 0.4),
        },
      ]}>
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: colorWithAlpha(ink, 0.78),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bead,
          {
            width: bead,
            height: bead,
            borderRadius: bead / 2,
            marginLeft: -bead / 2,
            marginTop: -bead / 2,
            backgroundColor: ink,
          },
          beadStyle,
        ]}
      />
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  ring: { borderWidth: 1, transform: [{ rotate: '-24deg' }, { scaleY: 0.82 }] },
  bead: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
