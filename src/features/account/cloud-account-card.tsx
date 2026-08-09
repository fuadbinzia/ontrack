import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    appPrompt,
    AppText,
    Button,
    Card,
    ErrorMessage,
    StatusBadge,
} from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useCloudSyncStatus } from '@/services/cloud/sync';
import { AgentUiIds } from '@/utils/agent-ui';

export function CloudAccountCard() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const sync = useCloudSyncStatus();
  const { isGuest, user, signOutCurrentDevice } = useAuthSession();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string>();

  const provider = String(user?.app_metadata.provider ?? 'account');
  const providerLabel =
    provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Existing account';

  const syncTone =
    sync.state === 'syncing' ? 'neutral' : sync.state === 'error' ? 'warning' : 'success';
  const syncLabel =
    sync.state === 'syncing' ? 'Syncing' : sync.state === 'error' ? 'Attention' : 'Synced';

  const signOut = async (force = false) => {
    setWorking(true);
    setMessage(undefined);
    try {
      const result = await signOutCurrentDevice(force);
      if (result.status === 'sync-failed') {
        setMessage(result.message);
        appPrompt.alert(
          'Changes are not synced',
          `${result.message}\n\nSigning out anyway removes this device’s local data. Cloud data and photos in your system library are not deleted.`,
          [
            { text: 'Stay Signed In', style: 'cancel' },
            { text: 'Retry Sync', onPress: () => void signOut(false) },
            {
              text: 'Sign Out Anyway',
              style: 'destructive',
              onPress: () => void signOut(true),
            },
          ],
        );
      } else if (result.status === 'cleanup-failed') {
        // Device is already signed out; do not offer "Stay Signed In".
        setMessage(result.message);
      }
    } catch (signOutError) {
      setMessage(signOutError instanceof Error ? signOutError.message : 'Sign out failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card variant="elevated" style={{ gap: spacing.md }}>
      {isGuest ? (
        <>
          <View style={{ gap: spacing.xxs }}>
            <View style={[styles.identityRow, { gap: spacing.sm }]}>
              <AppText variant="callout" fit style={styles.flex}>
                Guest mode
              </AppText>
              <View style={styles.badge}>
                <StatusBadge label="This device" tone="neutral" showDot={false} />
              </View>
            </View>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              Local name and plans stay on this device. Sign in to back up and continue elsewhere.
            </AppText>
          </View>
          <Button
            size="sm"
            testID={AgentUiIds.profile.createOrSignIn}
            onPress={() => router.push('/account' as never)}
            accessibilityLabel="Create or Sign In to an account"
            style={styles.action}>
            Create or Sign In
          </Button>
        </>
      ) : (
        <>
          <View style={{ gap: spacing.xxs }}>
            <View style={[styles.identityRow, { gap: spacing.sm }]}>
              <AppText variant="callout" fit numberOfLines={1} style={styles.flex}>
                {user?.email ?? 'Signed in'}
              </AppText>
              <View style={styles.badge}>
                <StatusBadge label={syncLabel} tone={syncTone} />
              </View>
            </View>
            <AppText variant="caption" color="secondary" fit>
              {providerLabel}
            </AppText>
          </View>
          {sync.state === 'error' ? (
            <ErrorMessage message={sync.message ?? 'Cloud sync needs attention.'} variant="caption" />
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            disabled={working}
            testID={AgentUiIds.profile.signOut}
            onPress={() => void signOut()}
            accessibilityLabel="Sign Out of This Device"
            style={styles.action}>
            {working ? 'Working…' : 'Sign Out'}
          </Button>
        </>
      )}
      {message ? <ErrorMessage message={message} variant="caption" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexShrink: 0,
  },
  action: {
    alignSelf: 'stretch',
  },
});
