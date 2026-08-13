import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  ErrorMessage,
  HeaderBackButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatusBadge,
} from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import {
  confirmStraiAwayCallback,
  connectStraiAway,
  disconnectStraiAway,
  getStraiAwayStatus,
  openStraiAwayStay,
} from '@/services/partner/straiaway';
import type { StraiAwayLinkStatus } from '@/services/partner/types';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export default function StraiAwayConnectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ connected?: string; code?: string; error?: string }>();
  const { isGuest } = useAuthSession();
  const { spacing } = useResponsive();
  const [status, setStatus] = useState<StraiAwayLinkStatus>({ connected: false, scopes: [] });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const pendingVerifier = useRef<string | undefined>(undefined);

  const refreshStatus = useCallback(async () => {
    if (isGuest) return;
    try {
      setStatus(await getStraiAwayStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'StraiAway status could not be loaded.');
    }
  }, [isGuest]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (typeof params.error === 'string') setError(params.error);
    if (params.connected === '1') {
      setMessage('StraiAway is connected.');
      void refreshStatus();
    }
    if (typeof params.code === 'string' && pendingVerifier.current) {
      void confirmStraiAwayCallback(params.code, pendingVerifier.current)
        .then((next) => {
          setStatus(next);
          setMessage(next.connected ? 'StraiAway is connected.' : 'Approve the link in StraiAway, then return here.');
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : 'StraiAway connection could not finish.');
        });
    }
  }, [params.code, params.connected, params.error, pendingVerifier, refreshStatus]);

  const runConnect = async () => {
    if (isGuest) {
      router.push('/account?returnTo=/(tabs)/profile/straiaway' as never);
      return;
    }
    setConnecting(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await connectStraiAway();
      pendingVerifier.current = result.verifier;
      setMessage('Approve the link in StraiAway, then return here.');
      await refreshStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'StraiAway could not connect.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    appPrompt.alert('Disconnect StraiAway?', 'Stay handoff will stop. Existing trips and listings stay in each app.', [
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDisconnecting(true);
            setMessage(undefined);
            setError(undefined);
            try {
              await disconnectStraiAway();
              setStatus({ connected: false, scopes: [] });
              setMessage('Disconnected. Stays were kept in both apps.');
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'StraiAway disconnect failed.');
            } finally {
              setDisconnecting(false);
            }
          })();
        },
      },
    ]);
  };

  const busy = connecting || disconnecting;

  return (
    <Screen refresh={false} contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.straiaway.screen} label="StraiAway connect" style={{ gap: spacing.md }}>
        <ScreenHeader
          eyebrow="Profile"
          title="StraiAway"
          subtitle="Link accounts to send stay details between onTrack trips and StraiAway listings. Flights, expenses, and host ops stay in their own app."
          leading={
            <HeaderBackButton
              compact
              accessibilityLabel="Back to profile"
              fallback="/(tabs)/profile"
            />
          }
        />
      </AgentTestId>

      <SectionHeader title="Connection" />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <AppText variant="subheading" fit>
              {status.connected ? 'Connected' : 'Not connected'}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {status.partnerDisplayName
                ?? (isGuest ? 'An onTrack account is required' : 'Connect one StraiAway account')}
            </AppText>
          </View>
          <StatusBadge label={status.connected ? 'On' : 'Off'} tone={status.connected ? 'success' : 'neutral'} />
        </View>
        {status.lastSyncedAt ? (
          <AppText variant="caption" color="tertiary">
            Last synced {new Date(status.lastSyncedAt).toLocaleString()}
          </AppText>
        ) : null}
        {status.connected ? (
          <Button
            testID={AgentUiIds.straiaway.open}
            disabled={busy}
            onPress={() => void openStraiAwayStay()}
            accessibilityLabel="Open StraiAway">
            Open StraiAway
          </Button>
        ) : (
          <Button
            testID={AgentUiIds.straiaway.connect}
            disabled={busy}
            onPress={() => void runConnect()}
            accessibilityLabel="Connect StraiAway">
            {connecting ? 'Connecting…' : isGuest ? 'Sign In to Connect' : 'Connect StraiAway'}
          </Button>
        )}
        {error ? <ErrorMessage message={error} variant="caption" /> : null}
        {message ? (
          <AppText variant="caption" color="secondary">
            {message}
          </AppText>
        ) : null}
      </Card>

      {status.connected ? (
        <>
          <SectionHeader title="Disconnect" />
          <Card style={{ gap: spacing.md }}>
            <AppText color="secondary">Stay copies remain in each app after the link is removed.</AppText>
            <Button
              variant="danger"
              testID={AgentUiIds.straiaway.disconnect}
              disabled={busy}
              onPress={disconnect}
              accessibilityLabel="Disconnect StraiAway">
              {disconnecting ? 'Disconnecting…' : 'Disconnect StraiAway'}
            </Button>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, minWidth: 0, flexShrink: 1 },
});
