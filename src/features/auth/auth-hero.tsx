import { StyleSheet, View } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { AuthBrandMark } from './auth-brand-mark';
import { AuthConstellation } from './auth-constellation';
import { AuthRingCopy } from './auth-ring-copy';
import { AuthWordmark } from './auth-wordmark';
import { ThemeModeToggle } from './theme-mode-toggle';

const COPY = {
  welcome: {
    headline: 'Your day, one place.',
    intro:
      'Schedule, track meals, workouts, travel and more — without juggling different apps.',
  },
  upgrade: {
    headline: 'Take onTrack with you.',
    intro:
      'Sign in to protect your plans and keep them in step across your devices.',
  },
  locked: {
    headline: 'Welcome back.',
    intro: 'Unlock this device to keep going. Your data is still here.',
  },
} as const;

export function AuthHero({
  variant,
  bleed,
}: {
  variant: 'welcome' | 'upgrade' | 'locked';
  /** Screen gutter the constellation bleeds past to reach the display edge. */
  bleed: number;
}) {
  const { spacing } = useResponsive();
  const copy = COPY[variant];

  return (
    <AgentTestId
      testID={AgentUiIds.auth.section.hero}
      style={[styles.hero, { gap: spacing.md }]}>
      <View style={[styles.brandRow, { gap: spacing.md }]}>
        <AuthBrandMark />
        <AuthWordmark />
        <View style={styles.spacer} />
        {/* Welcome only: on the upgrade screen a preferences write would mark
            guest data dirty and force a data-choice on the next sign-in. */}
        {variant === 'welcome' ? <ThemeModeToggle /> : null}
      </View>

      <AgentTestId
        testID={AgentUiIds.auth.section.constellation}
        style={styles.constellationSlot}>
        <AuthConstellation bleed={bleed}>
          <AuthRingCopy headline={copy.headline} intro={copy.intro} />
        </AuthConstellation>
      </AgentTestId>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 0, width: '100%' },
  constellationSlot: { flex: 1, minHeight: 0, width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
});
