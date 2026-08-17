import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';

import { AppText, Button, ErrorMessage, GlassPlate, Screen } from '@/components/primitives';
import { radii, shadows, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { useBiometricUnlock } from '@/store/biometric-unlock';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { AppleProviderButton } from './apple-provider-button';
import { AuthAtmosphere } from './auth-atmosphere';
import { HERO_MAX_WIDTH } from './auth-constellation';
import { AuthHero } from './auth-hero';
import { useAuthSession } from './auth-provider';
import {
    canOfferBiometricUnlock,
    shouldAutoPromptBiometricUnlock,
    useBiometricCapability,
} from './biometric-unlock';
import { GoogleProviderButton } from './google-provider-button';

export function AuthScreen({
  variant = 'welcome',
  returnTo,
}: {
  variant?: 'welcome' | 'upgrade' | 'locked';
  returnTo?: string;
}) {
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  // Pin density to the first window size so sheet/keyboard metrics cannot
  // flip padding mid-tap and shove the constellation + provider card.
  const layoutHeight = useRef(height).current;
  const {
    phase,
    session,
    workingProvider,
    workingUnlock,
    lockedUserId,
    error,
    continueWithProvider,
    unlockWithBiometrics,
    signOutCurrentDevice,
    clearError,
  } = useAuthSession();
  const busy = phase === 'authenticating' || Boolean(workingUnlock);
  const locked = variant === 'locked';
  const capability = useBiometricCapability();
  const enabledUserId = useBiometricUnlock((state) => state.enabledUserId);
  const canOfferBiometric = canOfferBiometricUnlock(capability.available);
  const canAutoPrompt = shouldAutoPromptBiometricUnlock({
    available: capability.available,
    enabledUserId,
    unlockUserId: lockedUserId,
  });
  const promptedRef = useRef(false);
  // A half-open account init leaves `session` set on the error screen — another
  // provider bind could merge the wrong graph. Locked unlock uses switch-account.
  const providersLocked = busy || Boolean(session);
  const gutter = width >= 720 ? spacing.xxl * 2 : spacing.xl;
  // The page never scrolls, so short windows trade card breathing room first —
  // the hero canvas already flexes into whatever is left.
  const tight = layoutHeight < 720;
  // Compact plate: keep tap targets, cut chrome air between major blocks.
  const cardPadding = tight ? spacing.md : spacing.lg;
  const cardGap = tight ? spacing.sm : spacing.md;
  const router = useRouter();

  useEffect(() => {
    if (!canAutoPrompt || busy || promptedRef.current) return;
    promptedRef.current = true;
    void unlockWithBiometrics();
  }, [busy, canAutoPrompt, unlockWithBiometrics]);

  const appleAgent = useAgentUiTarget(AgentUiIds.auth.apple, {
    label: 'Continue with Apple',
    onPress: providersLocked
      ? undefined
      : () => { void continueWithProvider('apple', returnTo); },
  });
  const googleAgent = useAgentUiTarget(AgentUiIds.auth.google, {
    label: 'Continue with Google',
    onPress: providersLocked
      ? undefined
      : () => { void continueWithProvider('google', returnTo); },
  });
  const switchAccountAgent = useAgentUiTarget(locked ? AgentUiIds.auth.switchAccount : undefined, {
    label: 'Use a different account',
    onPress: busy ? undefined : () => { void signOutCurrentDevice(true); },
  });
  const dismissErrorAgent = useAgentUiTarget(error ? AgentUiIds.auth.dismissError : undefined, {
    label: 'Dismiss sign-in error',
    onPress: clearError,
  });
  const privacyAgent = useAgentUiTarget(AgentUiIds.auth.privacy, {
    label: 'Privacy Policy',
    onPress: busy ? undefined : () => router.push('/privacy' as never),
  });
  const termsAgent = useAgentUiTarget(AgentUiIds.auth.terms, {
    label: 'Terms of Use',
    onPress: busy ? undefined : () => router.push('/terms' as never),
  });
  const legalLinks = (
    <View style={styles.legalRow}>
      <Pressable
        ref={privacyAgent.ref}
        onLayout={privacyAgent.onLayout}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        testID={AgentUiIds.auth.privacy}
        disabled={busy}
        hitSlop={8}
        onPress={() => router.push('/privacy' as never)}
        style={({ pressed }) => [styles.legalLink, { opacity: pressed ? 0.65 : 1 }]}>
        <AppText variant="caption" color="accent" fit>
          Privacy Policy
        </AppText>
      </Pressable>
      <AppText variant="caption" color="tertiary">
        ·
      </AppText>
      <Pressable
        ref={termsAgent.ref}
        onLayout={termsAgent.onLayout}
        accessibilityRole="link"
        accessibilityLabel="Terms of Use"
        testID={AgentUiIds.auth.terms}
        disabled={busy}
        hitSlop={8}
        onPress={() => router.push('/terms' as never)}
        style={({ pressed }) => [styles.legalLink, { opacity: pressed ? 0.65 : 1 }]}>
        <AppText variant="caption" color="accent" fit>
          Terms of Use
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <AuthAtmosphere>
      <Screen
        scroll={false}
        padded={false}
        // Upgrade lives on root `/account` (no tab dock); match welcome/locked.
        bottomInset="safe"
        refresh={false}
        style={styles.transparent}
        contentStyle={{
          ...styles.content,
          paddingHorizontal: gutter,
          // Keep a hard gap so the low constellation sweep never kisses the plate.
          gap: tight ? spacing.lg : spacing.xl,
        }}>
        <View style={styles.hero}>
          <AuthHero variant={variant} bleed={gutter} />
        </View>

        <View style={styles.cardWrap}>
          {/* Float status above the plate so busy/error copy cannot grow the
              card and compress the constellation on tap. */}
          {error ? (
            <GlassPlate
              mist
              style={styles.floatingStatus}
              accessibilityLiveRegion="assertive">
              <ErrorMessage message={error} variant="caption" />
              <Pressable
                ref={dismissErrorAgent.ref}
                testID={AgentUiIds.auth.dismissError}
                onLayout={dismissErrorAgent.onLayout}
                accessibilityRole="button"
                accessibilityLabel="Dismiss sign-in error"
                onPress={clearError}
                style={styles.dismiss}>
                <AppText variant="caption" color="accent">
                  {session ? 'Try opening account again' : 'Dismiss'}
                </AppText>
              </Pressable>
            </GlassPlate>
          ) : workingUnlock ? (
            <View
              style={styles.floatingBusy}
              accessibilityLiveRegion="polite"
              pointerEvents="none">
              <AppText variant="caption" color="secondary" align="center">
                Unlocking…
              </AppText>
            </View>
          ) : workingProvider ? (
            <View
              style={styles.floatingBusy}
              accessibilityLiveRegion="polite"
              pointerEvents="none">
              <AppText variant="caption" color="secondary" align="center">
                Opening {workingProvider === 'apple' ? 'Apple' : 'Google'}…
              </AppText>
            </View>
          ) : null}

          <GlassPlate
            airy
            style={[
              styles.card,
              { borderColor: theme.separator, padding: cardPadding, gap: cardGap },
            ]}>
            {locked ? (
              <AppText variant="caption" color="secondary" align="center">
                This device is locked
              </AppText>
            ) : null}

            {canOfferBiometric ? (
              <Button
                icon={capability.icon}
                loading={Boolean(workingUnlock)}
                disabled={providersLocked}
                testID={AgentUiIds.auth.unlockBiometric}
                accessibilityLabel={capability.label}
                onPress={() => void unlockWithBiometrics()}>
                {capability.label}
              </Button>
            ) : null}

            <AgentTestId
              testID={AgentUiIds.auth.section.providers}
              style={styles.providers}>
              <AppleProviderButton
                dark={theme.name === 'dark'}
                disabled={providersLocked}
                testID={AgentUiIds.auth.apple}
                buttonRef={appleAgent.ref}
                onLayout={appleAgent.onLayout}
                onPress={() => void continueWithProvider('apple', returnTo)}
              />
              <GoogleProviderButton
                dark={theme.name === 'dark'}
                disabled={providersLocked}
                testID={AgentUiIds.auth.google}
                buttonRef={googleAgent.ref}
                onLayout={googleAgent.onLayout}
                onPress={() => void continueWithProvider('google', returnTo)}
              />
            </AgentTestId>

            {locked ? (
              <Pressable
                ref={switchAccountAgent.ref}
                testID={AgentUiIds.auth.switchAccount}
                onLayout={switchAccountAgent.onLayout}
                accessibilityRole="button"
                accessibilityLabel="Use a different account"
                disabled={busy}
                onPress={() => void signOutCurrentDevice(true)}
                style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.65 : 1 }]}>
                <AppText variant="caption" color="secondary" fit>
                  Use a different account
                </AppText>
              </Pressable>
            ) : null}

            {legalLinks}
          </GlassPlate>
        </View>
      </Screen>
    </AuthAtmosphere>
  );
}

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
  content: {
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  // Flexes into whatever the provider card leaves — the constellation measures
  // its own box, so the sky composition compresses instead of the page scrolling.
  hero: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: HERO_MAX_WIDTH,
    alignSelf: 'center',
  },
  cardWrap: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  card: {
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 18px rgba(41, 54, 59, 0.1)' }
      : shadows.raised),
  },
  // Sits above the plate without participating in the card's flex height.
  floatingStatus: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    zIndex: 1,
  },
  floatingBusy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: spacing.sm,
    zIndex: 1,
  },
  providers: { gap: spacing.sm },
  secondaryAction: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  dismiss: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  legalLink: { minHeight: 28, justifyContent: 'center' },
});
