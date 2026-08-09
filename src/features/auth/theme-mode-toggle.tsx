import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlassPlate, Symbol } from '@/components/primitives';
import { easings, glassMaterials, motion, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

/**
 * Sun/moon pill for the signed-out shell. The device appearance stays the
 * default (sign-out resets the preference to `system`); this only lets someone
 * override it before they have an account to carry the choice.
 */
export function ThemeModeToggle() {
  const theme = useTheme();
  const { s } = useResponsive();
  const reduceMotion = useReducedMotion();
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const dark = theme.name === 'dark';

  const slot = Math.max(38, s(40));
  const height = Math.max(34, s(36));
  const pad = Math.max(2, s(3));
  const thumb = height - pad * 2;

  const progress = useSharedValue(dark ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(dark ? 1 : 0, {
      duration: reduceMotion ? 0 : motion.chrome,
      easing: easings.standard,
      reduceMotion: ReduceMotion.System,
    });
  }, [dark, progress, reduceMotion]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pad + (slot - thumb) / 2 + progress.value * slot }],
  }));
  const sunStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.55 }));
  const moonStyle = useAnimatedStyle(() => ({ opacity: 0.45 + progress.value * 0.55 }));

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  const target = useAgentUiTarget(AgentUiIds.auth.themeMode, {
    label,
    onPress: () => setThemePreference(dark ? 'light' : 'dark'),
  });

  return (
    <Pressable
      ref={target.ref}
      testID={target.testID}
      onLayout={target.onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Changes how onTrack looks on this device."
      hitSlop={spacing.sm}
      onPress={() => setThemePreference(dark ? 'light' : 'dark')}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <GlassPlate
        airy
        style={[
          styles.track,
          { width: slot * 2 + pad * 2, height, borderRadius: radii.pill },
        ]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: thumb,
              height: thumb,
              borderRadius: thumb / 2,
              top: pad,
              borderColor: dark
                ? glassMaterials.border.mist
                : glassMaterials.border.light,
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
        <View pointerEvents="none" style={[styles.icons, { paddingHorizontal: pad }]}>
          <Animated.View style={[styles.slot, { width: slot }, sunStyle]}>
            <Symbol name="today" size={s(17)} color={theme.textPrimary} />
          </Animated.View>
          <Animated.View style={[styles.slot, { width: slot }, moonStyle]}>
            <Symbol name="sleep" size={s(17)} color={theme.textPrimary} />
          </Animated.View>
        </View>
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center' },
  icons: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  slot: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
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
