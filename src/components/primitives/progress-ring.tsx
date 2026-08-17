import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { durations, easings } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from './app-text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0–1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  progress,
  size = 84,
  strokeWidth = 7,
  color,
  trackColor,
  label,
  sublabel,
}: ProgressRingProps) {
  const theme = useTheme();
  const { allowsAnimatedSvgProps } = usePerformanceTier();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const hasWideLabel = (label?.length ?? 0) >= 4;
  const labelFontSize = Math.min(
    22,
    Math.max(hasWideLabel ? 11 : 13, size * (hasWideLabel ? 0.23 : 0.26)),
  );
  const sublabelFontSize = Math.min(12.5, Math.max(9, size * 0.17));
  const animated = useSharedValue(clamped);

  useEffect(() => {
    if (!allowsAnimatedSvgProps) {
      animated.value = clamped;
      return;
    }
    animated.value = withTiming(clamped, {
      duration: durations.slow,
      easing: easings.enter,
    });
  }, [allowsAnimatedSvgProps, animated, clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={
        [label, sublabel].filter(Boolean).join(', ') || 'Progress'
      }
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? theme.backgroundSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {allowsAnimatedSvgProps ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color ?? theme.accentPrimary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color ?? theme.accentPrimary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.labelStack}>
        {label ? (
          <AppText
            variant="heading"
            style={{
              fontSize: labelFontSize,
              lineHeight: labelFontSize * 1.15,
              fontVariant: ['tabular-nums'],
            }}>
            {label}
          </AppText>
        ) : null}
        {sublabel ? (
          <AppText
            variant="caption"
            color="tertiary"
            style={{
              fontSize: sublabelFontSize,
              lineHeight: sublabelFontSize * 1.2,
            }}>
            {sublabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
