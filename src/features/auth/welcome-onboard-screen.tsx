import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';

import {
    AppText,
    GlassPlate,
    Input,
    Screen,
    Symbol,
} from '@/components/primitives';
import {
    colorWithAlpha,
    glassFieldBackground,
    glassFieldBorder,
    radii,
    spacing,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { AppleProviderButton } from './apple-provider-button';
import { AuthAtmosphere } from './auth-atmosphere';
import { AuthBrandMark } from './auth-brand-mark';
import {
    AuthConstellation,
    HERO_MAX_WIDTH,
    useAuthCopyScale,
} from './auth-constellation';
import { useAuthSession } from './auth-provider';
import { GoogleProviderButton } from './google-provider-button';
import { ThemeModeToggle } from './theme-mode-toggle';
import {
    dismissForceWelcomePreview,
    FORCE_SHOW_WELCOME,
} from './welcome-preview';

const DEFAULT_NAME = 'Guest';
const DEFAULT_GOAL = 'Live intentionally';
const TRY_APP_FIRST_LABEL = 'I want to try the app out first';

/**
 * Single first-run canvas (constellation + name/goal + Get Started).
 * Replaces the old split between `/welcome` SSO and `/onboarding` form.
 */
export function WelcomeOnboardScreen() {
  const theme = useTheme();
  const { s, spacing: gap } = useResponsive();
  const { height, width } = useWindowDimensions();
  const layoutHeight = useRef(height).current;
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const completeOnboarding = usePreferences((state) => state.completeOnboarding);
  const hasOnboarded = usePreferences((state) => state.hasOnboarded);
  const { continueAsGuest, continueWithProvider, workingProvider, phase } =
    useAuthSession();
  const busy = phase === 'authenticating' || phase === 'loading';
  const needsGuestEntry =
    phase === 'welcome' || phase === 'error' || phase === 'authenticating';
  /** Env force-preview of an already-onboarded session — dismiss without rewriting prefs. */
  const previewDismiss = FORCE_SHOW_WELCOME && hasOnboarded;

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);

  const gutter = width >= 720 ? spacing.xxl * 2 : spacing.xl;
  const tight = layoutHeight < 720;
  // Half the former full-bleed CTA — keep ≥44pt tap height.
  const ctaHeight = Math.max(44, s(28));
  const ctaIcon = Math.max(12, s(12));
  const fieldRadius = Math.max(radii.lg, s(18));

  const finish = async (useDefaults: boolean) => {
    // Force-preview keeps `/welcome` mounted until this session dismisses it;
    // without that, Skip/Get Started bounce straight back from the tabs guard.
    if (FORCE_SHOW_WELCOME) {
      dismissForceWelcomePreview();
    }
    if (previewDismiss) {
      router.replace((returnTo || '/') as never);
      return;
    }
    const nextName = useDefaults ? DEFAULT_NAME : name.trim() || DEFAULT_NAME;
    const nextGoal = useDefaults ? DEFAULT_GOAL : goal.trim() || DEFAULT_GOAL;
    if (needsGuestEntry) {
      await continueAsGuest();
    }
    completeOnboarding({ name: nextName, goal: nextGoal });
    router.replace((returnTo || '/') as never);
  };

  const onGetStarted = () => {
    void finish(false);
  };
  const onSkip = () => {
    void finish(true);
  };

  const getStartedAgent = useAgentUiTarget(AgentUiIds.onboarding.getStarted, {
    label: 'Get Started',
    onPress: busy ? undefined : onGetStarted,
  });
  const signInAgent = useAgentUiTarget(AgentUiIds.onboarding.signIn, {
    label: showSignIn ? 'Hide sign in' : 'Sign in',
    onPress: busy ? undefined : () => setShowSignIn((open) => !open),
  });

  return (
    <AuthAtmosphere>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          scroll={false}
          padded={false}
          bottomInset="safe"
          refresh={false}
          style={styles.transparent}
          contentStyle={{
            ...styles.content,
            paddingHorizontal: gutter,
            gap: tight ? gap.md : gap.lg,
          }}>
          <View style={styles.hero}>
            <AgentTestId
              testID={AgentUiIds.auth.section.hero}
              style={[styles.heroInner, { gap: gap.md }]}>
              <View style={[styles.brandRow, { gap: gap.md }]}>
                <AuthBrandMark />
                <AppText
                  variant="overline"
                  color="accent"
                  style={{ letterSpacing: s(3.4) }}
                  fit>
                  onTrack
                </AppText>
                <View style={styles.spacer} />
                <ThemeModeToggle />
              </View>

              <AgentTestId
                testID={AgentUiIds.auth.section.constellation}
                style={styles.constellationSlot}>
                <AuthConstellation bleed={gutter}>
                  <WelcomeCopy />
                </AuthConstellation>
              </AgentTestId>
            </AgentTestId>
          </View>

          <View
            style={[
              styles.form,
              { maxWidth: 520, gap: tight ? gap.sm : gap.md },
            ]}>
            <Input
              label="What should we call you?"
              icon="profile"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!busy}
              testID={AgentUiIds.onboarding.name}
              accessibilityLabel="What should we call you?"
              fieldBackground={glassFieldBackground(theme.name)}
              fieldBorderColor={
                theme.name === 'dark'
                  ? colorWithAlpha(theme.accentPrimary, 0.45)
                  : glassFieldBorder(theme.name)
              }
              fieldBorderRadius={fieldRadius}
            />
            <Input
              label="Primary Goal"
              icon="target"
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Build strength, stay consistent"
              autoCapitalize="sentences"
              returnKeyType="done"
              editable={!busy}
              testID={AgentUiIds.onboarding.goal}
              accessibilityLabel="Primary Goal"
              fieldBackground={glassFieldBackground(theme.name)}
              fieldBorderColor={
                theme.name === 'dark'
                  ? colorWithAlpha(theme.accentPrimary, 0.45)
                  : glassFieldBorder(theme.name)
              }
              fieldBorderRadius={fieldRadius}
            />

            <Pressable
              ref={getStartedAgent.ref}
              testID={AgentUiIds.onboarding.getStarted}
              onLayout={getStartedAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              disabled={busy}
              onPress={onGetStarted}
              style={({ pressed }) => [
                styles.ctaOuter,
                {
                  minHeight: ctaHeight,
                  opacity: pressed || busy ? 0.88 : 1,
                },
              ]}>
              <GlassPlate
                inverted
                style={[
                  styles.cta,
                  {
                    minHeight: ctaHeight,
                    borderRadius: radii.pill,
                    borderColor: `${theme.accentPrimary}99`,
                    backgroundColor:
                      theme.name === 'dark'
                        ? `${theme.accentPrimary}66`
                        : `${theme.accentPrimary}B8`,
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                  },
                ]}>
                <Symbol name="smart" size={ctaIcon} color="#FFFFFF" />
                <AppText
                  variant="callout"
                  style={{ color: '#FFFFFF', flexShrink: 1 }}
                  fit>
                  Get Started
                </AppText>
                <Symbol name="smart" size={ctaIcon} color="#FFFFFF" />
              </GlassPlate>
            </Pressable>

            {/* One try-first control; dual ids keep welcome + legacy onboarding gates green. */}
            <AgentTestId
              testID={AgentUiIds.onboarding.skip}
              label={TRY_APP_FIRST_LABEL}
              onPress={busy ? undefined : onSkip}
              style={styles.skip}>
              <AgentTestId
                testID={AgentUiIds.auth.guest}
                label="Continue as Guest"
                onPress={busy ? undefined : onSkip}
                style={styles.skipInner}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={TRY_APP_FIRST_LABEL}
                  disabled={busy}
                  hitSlop={8}
                  onPress={onSkip}
                  style={({ pressed }) => [
                    styles.skipHit,
                    { opacity: pressed || busy ? 0.65 : 1 },
                  ]}>
                  <AppText variant="callout" color="secondary" fit>
                    {TRY_APP_FIRST_LABEL}
                  </AppText>
                </Pressable>
              </AgentTestId>
            </AgentTestId>

            <Pressable
              ref={signInAgent.ref}
              testID={AgentUiIds.onboarding.signIn}
              onLayout={signInAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel={showSignIn ? 'Hide sign in' : 'Sign in'}
              disabled={busy}
              hitSlop={6}
              onPress={() => setShowSignIn((open) => !open)}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
              <AppText variant="caption" color="accent" align="center" fit>
                {showSignIn ? 'Hide sign in' : 'Already have an account? Sign in'}
              </AppText>
            </Pressable>

            {showSignIn ? (
              <GlassPlate
                airy
                style={[
                  styles.signInCard,
                  {
                    borderColor: theme.separator,
                    padding: tight ? gap.sm : gap.md,
                    gap: gap.sm,
                  },
                ]}>
                <AgentTestId
                  testID={AgentUiIds.auth.section.providers}
                  style={{ gap: gap.sm }}>
                  <AppleProviderButton
                    dark={theme.name === 'dark'}
                    disabled={busy}
                    testID={AgentUiIds.auth.apple}
                    onPress={() => void continueWithProvider('apple')}
                  />
                  <GoogleProviderButton
                    dark={theme.name === 'dark'}
                    disabled={busy}
                    testID={AgentUiIds.auth.google}
                    onPress={() => void continueWithProvider('google')}
                  />
                </AgentTestId>
                {workingProvider ? (
                  <AppText variant="caption" color="secondary" align="center">
                    Opening {workingProvider === 'apple' ? 'Apple' : 'Google'}…
                  </AppText>
                ) : null}
              </GlassPlate>
            ) : null}
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </AuthAtmosphere>
  );
}

function WelcomeCopy() {
  const theme = useTheme();
  const { s, typography } = useResponsive();
  const scale = useAuthCopyScale();
  const introScale = Math.max(scale * 1.12, 0.84);

  return (
    <>
      <AppText
        variant="display"
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        style={{
          fontSize: typography.display.fontSize * scale,
          lineHeight: typography.display.lineHeight * scale,
        }}>
        Your day, one place.
      </AppText>
      <View
        style={[
          styles.rule,
          {
            width: s(40) * scale,
            height: Math.max(1, s(1.5)),
            backgroundColor: theme.accentPrimary,
          },
        ]}
      />
      <AppText
        variant="body"
        color="secondary"
        numberOfLines={5}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          fontSize: typography.body.fontSize * introScale,
          lineHeight: typography.body.lineHeight * introScale,
        }}>
        Schedule, track meals, workouts, travel and more — without juggling different apps.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  transparent: { backgroundColor: 'transparent' },
  content: {
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: HERO_MAX_WIDTH,
    alignSelf: 'center',
  },
  heroInner: { flex: 1, minHeight: 0, width: '100%' },
  constellationSlot: { flex: 1, minHeight: 0, width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  form: { width: '100%', alignSelf: 'center' },
  ctaOuter: {
    alignSelf: 'center',
    width: '50%',
    maxWidth: 260,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skip: { alignItems: 'center', justifyContent: 'center' },
  skipInner: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  skipHit: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  signInCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  rule: { borderRadius: 1 },
});
