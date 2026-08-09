import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { AuthBrandMark } from './auth-brand-mark';
import { AuthConstellation, useAuthCopyScale } from './auth-constellation';
import { ThemeModeToggle } from './theme-mode-toggle';

const COPY = {
  welcome: {
    headline: 'Your day, one place.',
    intro:
      'Schedule, track meals, workouts, and focus — without juggling different apps.',
  },
  upgrade: {
    headline: 'Take onTrack with you.',
    intro:
      'Sign in to protect your plans and keep them in step across your devices.',
  },
  locked: {
    headline: 'Welcome back.',
    intro: 'Sign in again to unlock onTrack on this device. Your data is still here.',
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
  const { s, spacing } = useResponsive();
  const copy = COPY[variant];

  return (
    <AgentTestId
      testID={AgentUiIds.auth.section.hero}
      style={[styles.hero, { gap: spacing.md }]}>
      <View style={[styles.brandRow, { gap: spacing.md }]}>
        <AuthBrandMark />
        <AppText
          variant="overline"
          color="accent"
          style={{ letterSpacing: s(3.4) }}
          fit>
          onTrack
        </AppText>
        <View style={styles.spacer} />
        {/* Welcome only: on the upgrade screen a preferences write would mark
            guest data dirty and force a data-choice on the next sign-in. */}
        {variant === 'welcome' ? <ThemeModeToggle /> : null}
      </View>

      <AgentTestId
        testID={AgentUiIds.auth.section.constellation}
        style={styles.constellationSlot}>
        <AuthConstellation bleed={bleed}>
          <HeroCopy headline={copy.headline} intro={copy.intro} />
        </AuthConstellation>
      </AgentTestId>
    </AgentTestId>
  );
}

/**
 * Rendered inside the constellation so it can read the canvas type scale —
 * a short window compresses the copy instead of clipping it.
 */
function HeroCopy({ headline, intro }: { headline: string; intro: string }) {
  const theme = useTheme();
  const { s, typography } = useResponsive();
  const scale = useAuthCopyScale();
  const introScale = Math.max(scale, 0.86);

  return (
    <>
      <AppText
        variant="display"
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          fontSize: typography.display.fontSize * scale,
          lineHeight: typography.display.lineHeight * scale,
        }}>
        {headline}
      </AppText>
      <View
        style={[
          styles.rule,
          {
            width: s(46) * scale,
            height: Math.max(1, s(1.5)),
            backgroundColor: theme.accentPrimary,
          },
        ]}
      />
      <AppText
        variant="body"
        color="secondary"
        numberOfLines={4}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{
          fontSize: typography.body.fontSize * introScale,
          lineHeight: typography.body.lineHeight * introScale,
        }}>
        {intro}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 0, width: '100%' },
  constellationSlot: { flex: 1, minHeight: 0, width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  rule: { borderRadius: 1 },
});
