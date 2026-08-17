import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import {
    colorWithAlpha,
    easings,
    glassMaterials,
    glassMistWashStyle,
    motion,
    radii,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

type GlassSwitchProps = {
  value: boolean;
  disabled?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fill-only frost toggle — safe inside clipped SettingsGroup (no nested blur).
 * Off track uses cool mist wash (same as GlassPlate mist on light boards) so it
 * reads as glass on cream SettingsGroup plates, not a flat opaque iOS switch.
 * Visual only when the parent row owns the press (`pointerEvents="none"`).
 */
export function GlassSwitch({
  value,
  disabled,
  accessible = true,
  accessibilityLabel,
  style,
}: GlassSwitchProps) {
  const theme = useTheme();
  const { s } = useResponsive();
  const reduceMotion = useReducedMotion();
  const dark = theme.name === 'dark';

  const trackW = Math.max(50, s(52));
  const trackH = Math.max(30, s(32));
  const pad = Math.max(2, s(2));
  const thumb = trackH - pad * 2;
  const travel = trackW - thumb - pad * 2;

  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: reduceMotion ? 0 : motion.chrome,
      easing: easings.standard,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress, reduceMotion, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pad + progress.value * travel }],
  }));

  const onTrack = colorWithAlpha(theme.accentPrimary, dark ? 0.42 : 0.34);
  const onBorder = colorWithAlpha(theme.accentPrimary, dark ? 0.55 : 0.4);

  return (
    <View
      accessible={accessible}
      accessibilityRole={accessible ? 'switch' : undefined}
      accessibilityLabel={accessible ? accessibilityLabel : undefined}
      accessibilityState={
        accessible ? { checked: value, disabled: Boolean(disabled) } : undefined
      }
      collapsable={false}
      style={[
        styles.track,
        {
          width: trackW,
          height: trackH,
          borderRadius: radii.pill,
          borderColor: value
            ? onBorder
            : dark
              ? glassMaterials.border.mist
              : glassMaterials.border.mistLight,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          value
            ? { backgroundColor: onTrack }
            : dark
              ? styles.trackOffDark
              : styles.trackOffLight,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            borderColor: dark
              ? glassMaterials.border.mist
              : glassMaterials.border.light,
            top: pad,
            boxShadow: dark
              ? '0 1px 3px rgba(0,0,0,0.35)'
              : '0 1px 3px rgba(17,40,60,0.14)',
          },
          thumbStyle,
        ]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            dark ? styles.thumbTintDark : styles.thumbTintLight,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  /** Cool mist inset — matches GlassPlate mist on cream/white boards. */
  trackOffLight: glassMistWashStyle.onLight,
  trackOffDark: glassMistWashStyle.onDark,
  thumb: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  thumbTintLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.58) 50%, rgba(255,255,255,0.8) 100%)',
  },
  thumbTintDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 48%, rgba(255,255,255,0.24) 100%)',
  },
});
