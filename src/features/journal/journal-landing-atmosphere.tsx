import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  usePageSurfaceBackground,
  useSafeAreaChrome,
  useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { useTheme } from '@/hooks/use-theme';

export const JOURNAL_HOME_ATMOSPHERE = require('../../../assets/images/journal/journal-home-atmosphere.jpg');
export const JOURNAL_HOME_SKY_COLOR = '#8EC8E0';
export const JOURNAL_HOME_AVERAGE_COLOR = '#7EB4C4';

export const journalLandingFontFamily = Platform.select({
  ios: 'Times New Roman',
  android: 'serif',
  default: 'Times New Roman',
}) as string;

function JournalLandingScrim({ dark }: { dark: boolean }) {
  const colors = dark
    ? (['rgba(8,16,24,0.58)', 'rgba(8,16,24,0.22)', 'rgba(8,16,24,0)'] as const)
    : (['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'] as const);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[...colors]}
      locations={[0, 0.58, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useJournalLandingAtmosphere(): {
  dark: boolean;
  ink: string;
  muted: string;
  scrim: ReactNode;
} {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dark = theme.name === 'dark';
  const ink = dark ? '#FFFFFF' : '#000000';
  const muted = dark ? 'rgba(255,255,255,0.82)' : '#1A1A1A';
  const scrim = useMemo(() => <JournalLandingScrim dark={dark} />, [dark]);

  useSafeAreaChrome(JOURNAL_HOME_SKY_COLOR, {
    backgroundImage: JOURNAL_HOME_ATMOSPHERE,
    backgroundImageHeight: Math.round(windowHeight),
    backgroundImageBlurRadius: 0,
    priority: 1,
  });
  useSafeAreaChromeOverlay(scrim, insets.top + 220, { priority: 1 });
  usePageSurfaceBackground(JOURNAL_HOME_SKY_COLOR, { priority: 1 });

  return { dark, ink, muted, scrim };
}
