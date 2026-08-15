import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { colorWithAlpha, glassMaterials } from '@/design-system/glass';
import { useTheme } from '@/hooks/use-theme';
import { useThemeOverrides } from '@/store/theme-overrides';

import {
    usePageSurfaceBackground,
    useSafeAreaChrome,
    useSafeAreaChromeOverlay,
} from './safe-area-chrome';

/**
 * Soft page wash so frosted glass plates have depth to blur.
 * Feature scenic washes (Travel / Today) register higher-priority chrome
 * and replace this underlay via SafeAreaChrome.
 *
 * Prefer `useScreenAtmosphereChrome` so the wash paints on the app shell
 * (window y=0) and continues under the status bar without a hard seam.
 */
export function ScreenAtmosphere() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const a = glassMaterials.atmosphere;
  const customCanvas = useThemeOverrides((state) => {
    const colors = state.overrides.default;
    return (
      state.presetId !== 'classic' ||
      Boolean(colors.backgroundPrimary || colors.backgroundSecondary)
    );
  });
  const dark = theme.name === 'dark';
  const colors = customCanvas
    ? ([theme.backgroundSecondary, theme.backgroundPrimary, theme.backgroundPrimary] as const)
    : dark
    ? ([a.darkTop, a.darkMid, a.darkBottom] as const)
    : ([a.lightTop, a.lightMid, a.lightBottom] as const);
  const orb = customCanvas
    ? colorWithAlpha(theme.accentPrimary, dark ? 0.2 : 0.14)
    : dark ? a.darkOrb : a.lightOrb;
  const cool = customCanvas
    ? colorWithAlpha(theme.accentSoft, dark ? 0.16 : 0.11)
    : dark ? a.darkCool : a.lightCool;
  const orbSize = Math.max(width, height) * 0.72;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...colors]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft blooms — radial so edges dissolve (no hard orb arcs). */}
      <View
        style={[
          styles.orb,
          {
            width: orbSize,
            height: orbSize,
            top: -orbSize * 0.42,
            right: -orbSize * 0.34,
            experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${orb} 0%, transparent 78%)`,
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          {
            width: orbSize * 0.85,
            height: orbSize * 0.85,
            bottom: -orbSize * 0.42,
            left: -orbSize * 0.36,
            experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${cool} 0%, transparent 78%)`,
          },
        ]}
      />
      <LinearGradient
        colors={
          dark
            ? ['rgba(255,255,255,0.04)', 'transparent', 'rgba(0,0,0,0.25)']
            : [
                'rgba(255,255,255,0.42)',
                'rgba(255,255,255,0.12)',
                'transparent',
                'rgba(80,55,35,0.04)',
              ]
        }
        locations={dark ? [0, 0.4, 1] : [0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function screenAtmosphereTopColor(appearance: 'light' | 'dark'): string {
  return appearance === 'dark'
    ? glassMaterials.atmosphere.darkTop
    : glassMaterials.atmosphere.lightTop;
}

export function screenAtmosphereBottomColor(
  appearance: 'light' | 'dark',
): string {
  return appearance === 'dark'
    ? glassMaterials.atmosphere.darkBottom
    : glassMaterials.atmosphere.lightBottom;
}

/**
 * Paint the default glass atmosphere on the non-scrolling app shell so the
 * wash is one continuous plane from the status bar through page content.
 * Priority `-1` lets Travel / Today scenic chrome win.
 */
export function useScreenAtmosphereChrome(enabled = true) {
  const theme = useTheme();
  const customCanvas = useThemeOverrides((state) => {
    const colors = state.overrides.default;
    return (
      state.presetId !== 'classic' ||
      Boolean(colors.backgroundPrimary || colors.backgroundSecondary)
    );
  });
  const { height } = useWindowDimensions();
  const top = customCanvas ? theme.backgroundSecondary : screenAtmosphereTopColor(theme.name);
  const bottom = customCanvas ? theme.backgroundPrimary : screenAtmosphereBottomColor(theme.name);
  const overlay = useMemo(
    () => (enabled ? <ScreenAtmosphere /> : undefined),
    [enabled],
  );

  useSafeAreaChrome(enabled ? top : undefined, { priority: -1 });
  useSafeAreaChromeOverlay(overlay, enabled ? height : undefined, {
    priority: -1,
  });
  usePageSurfaceBackground(enabled ? bottom : undefined);
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
});
