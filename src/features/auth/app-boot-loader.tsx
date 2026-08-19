import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/primitives/app-text';
import { GlassPlate } from '@/components/primitives/glass-plate';
import { colorWithAlpha } from '@/design-system/glass';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

const ORBIT_MS = 2400;
const BREATHE_MS = 1400;

/**
 * First-paint boot composition — the onTrack lens comes alive (orbiting bead +
 * soft breathe) over ScreenAtmosphere. Brand-first; no paper capsule.
 */
export function AppBootLoader() {
  const theme = useTheme();
  const { s, spacing } = useResponsive();
  const { allowsLoopMotion } = usePerformanceTier();
  const live = allowsLoopMotion;

  const box = Math.max(72, s(84));
  const ring = box * 0.58;
  const bead = Math.max(6, box * 0.15);
  const rx = ring * 0.5;
  const ry = ring * 0.5 * 0.82;
  const tiltRad = (-24 * Math.PI) / 180;

  const orbit = useSharedValue(0);
  const breathe = useSharedValue(0);
  const labelPulse = useSharedValue(0.72);

  useEffect(() => {
    if (!live) {
      orbit.value = 0.12;
      breathe.value = 0;
      labelPulse.value = 1;
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
      withSequence(
        withTiming(1, {
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        withTiming(0, {
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
    labelPulse.value = 0.72;
    labelPulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        withTiming(0.72, {
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [breathe, labelPulse, live, orbit]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.04 }],
  }));

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

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelPulse.value,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading onTrack…"
      style={[styles.root, { gap: spacing.md }]}>
      <Animated.View style={discStyle}>
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
              borderColor: colorWithAlpha(theme.accentPrimary, 0.36),
            },
          ]}>
          <View
            style={[
              styles.ring,
              {
                width: ring,
                height: ring,
                borderRadius: ring / 2,
                borderColor: colorWithAlpha(theme.accentPrimary, 0.78),
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
                backgroundColor: theme.accentPrimary,
              },
              beadStyle,
            ]}
          />
        </GlassPlate>
      </Animated.View>

      <View style={[styles.copy, { gap: spacing.xs }]}>
        <AppText
          variant="title"
          color="primary"
          align="center"
          style={{ letterSpacing: s(2.8) }}
          fit>
          onTrack
        </AppText>
        <Animated.View style={labelStyle}>
          <AppText variant="callout" color="secondary" align="center" fit>
            Loading onTrack…
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  ring: {
    borderWidth: 1.5,
    transform: [{ rotate: '-24deg' }, { scaleY: 0.82 }],
  },
  bead: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  copy: {
    alignItems: 'center',
    minWidth: 0,
  },
});
