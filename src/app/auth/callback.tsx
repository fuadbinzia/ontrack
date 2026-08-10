import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorMessage, LoadingBlock, Screen } from '@/components/primitives';
import { spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { accessibleAuthError } from '@/services/cloud/account';

/** Android Custom Tabs often open this route before Linking.useURL() is set. */
const MISSING_URL_GRACE_MS = 2500;

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const linkingUrl = Linking.useURL();
  const { phase, error, isGuest, completeOAuthCallback, clearError } = useAuthSession();
  const attempted = useRef(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(linkingUrl);
  const [localError, setLocalError] = useState<string>();
  const [waitedForUrl, setWaitedForUrl] = useState(false);

  useEffect(() => {
    if (linkingUrl) setResolvedUrl(linkingUrl);
  }, [linkingUrl]);

  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (active && url) setResolvedUrl((current) => current ?? url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url) setResolvedUrl(url);
    });
    const timer = setTimeout(() => {
      if (active) setWaitedForUrl(true);
    }, MISSING_URL_GRACE_MS);
    return () => {
      active = false;
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!resolvedUrl || attempted.current) return;
    attempted.current = true;
    void completeOAuthCallback(resolvedUrl).catch((callbackError: unknown) => {
      setLocalError(accessibleAuthError(callbackError));
    });
  }, [completeOAuthCallback, resolvedUrl]);

  useEffect(() => {
    if (phase === 'authenticated') router.replace('/' as never);
    if (phase === 'resolving-data') router.replace('/auth/data-choice' as never);
  }, [phase, router]);

  // AuthSession may already be exchanging the code on the welcome/account
  // screen — don't flash a missing-URL error while that finishes.
  const browserExchangeInFlight =
    phase === 'authenticating' || phase === 'resolving-data' || phase === 'authenticated';

  const message =
    localError ??
    error ??
    (!resolvedUrl && waitedForUrl && !browserExchangeInFlight
      ? 'The sign-in response did not include a callback URL.'
      : undefined);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        {message ? (
          <>
            <AppText variant="heading">Sign-in needs another try</AppText>
            <ErrorMessage message={message} />
            <Button
              onPress={() => {
                clearError();
                router.replace((isGuest ? '/account' : '/welcome') as never);
              }}
              accessibilityLabel="Return to sign in">
              Return to sign in
            </Button>
          </>
        ) : (
          <>
            <LoadingBlock label="Finishing sign-in…" />
            <AppText variant="body" color="secondary" align="center">
              Your plans are staying put while we open your account.
            </AppText>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  center: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
});
