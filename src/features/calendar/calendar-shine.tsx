import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

/** Slow glide so the sheen reads as a deliberate land cue. */
const SHINE_MS = 2400;

type CalendarShineProps = {
  /** True while the calendar tab is focused — each false→true edge runs a sweep. */
  play: boolean;
  borderRadius: number;
};

/**
 * Soft sheen across the month glass plate — one pass each land.
 * Sibling overlay (does not wrap GlassPlate) so iOS BlurView frost stays alive.
 */
export function CalendarShine({ play, borderRadius }: CalendarShineProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { tier } = usePerformanceTier();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const bandWidth = Math.max(72, width * 0.38);
  const motionAllowed =
    !reduceMotion && tier !== 'static' && tier !== 'minimal';

  useEffect(() => {
    if (!play || !motionAllowed) {
      cancelAnimation(progress);
      progress.value = 0;
      setActive(false);
      return;
    }
    if (width <= 0) return;

    setActive(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: SHINE_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      },
      (finished) => {
        if (finished) runOnJS(setActive)(false);
      },
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [motionAllowed, play, progress, width]);

  const bandStyle = useAnimatedStyle(() => {
    const travel = width + bandWidth * 2;
    return {
      opacity: 0.9,
      transform: [
        { translateX: -bandWidth + progress.value * travel },
        { skewX: '-18deg' },
      ],
    };
  }, [bandWidth, width]);

  if (!motionAllowed) return null;
  if (!play && !active) return null;

  const peak =
    theme.name === 'dark'
      ? 'rgba(255, 244, 228, 0.22)'
      : 'rgba(255, 255, 255, 0.55)';
  const mid =
    theme.name === 'dark'
      ? 'rgba(177, 138, 101, 0.14)'
      : 'rgba(255, 255, 255, 0.28)';

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
      }}
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        { borderRadius, zIndex: 2 },
      ]}>
      {active && width > 0 ? (
        <Animated.View
          style={[
            styles.band,
            { width: bandWidth, height: '160%' },
            bandStyle,
          ]}>
          <LinearGradient
            colors={['transparent', mid, peak, mid, 'transparent']}
            locations={[0, 0.28, 0.5, 0.72, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: '-30%',
  },
});
