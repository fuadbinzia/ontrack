import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
    AppText,
    Button,
    Card,
    ErrorMessage,
    GlassTonePill,
    Screen,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { useAuthSession, type DataResolution } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

export default function DataChoiceScreen() {
  const theme = useTheme();
  const { error, resolveDataConflict, dataChoiceVariant } = useAuthSession();
  const [working, setWorking] = useState<DataResolution>();
  const existing = dataChoiceVariant !== 'new-account';

  const resolve = async (choice: DataResolution) => {
    setWorking(choice);
    try {
      await resolveDataConflict(choice);
    } catch {
      // The coordinator keeps the route active and exposes an accessible error.
    } finally {
      setWorking(undefined);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <GlassTonePill
        label={existing ? 'Existing account' : 'New account'}
        toneColor={theme.accentPrimary}
        showDot={false}
      />
      <AppText variant="title">
        {existing
          ? 'Add this device’s plans to your account?'
          : 'Bring your guest plans into this account?'}
      </AppText>
      <AppText variant="body" color="secondary">
        {existing
          ? 'Your cloud account stays the source of truth. Merge keeps cloud plans and adds anything that only exists on this device.'
          : 'This account has no cloud plans yet. Keep what you made as a guest, or start with an empty account.'}
      </AppText>

      {existing ? (
        <>
          <Card airy style={[styles.option, { borderColor: theme.accentPrimary }]}>
            <AppText variant="heading">Merge with cloud</AppText>
            <AppText variant="body" color="secondary">
              Keep your account’s plans and add device-only trips and lists. Matching items keep the
              cloud version.
            </AppText>
            <Button
              size="lg"
              disabled={Boolean(working)}
              testID={AgentUiIds.auth.dataChoice.merge}
              onPress={() => void resolve('merge')}
              accessibilityLabel="Merge device data with cloud account">
              {working === 'merge' ? 'Merging…' : 'Merge with cloud'}
            </Button>
          </Card>
          <Card airy style={[styles.option, { borderColor: theme.separator }]}>
            <AppText variant="heading">Use cloud only</AppText>
            <AppText variant="body" color="secondary">
              Restore your account on this device and discard the guest data stored here.
            </AppText>
            <Button
              variant="secondary"
              disabled={Boolean(working)}
              testID={AgentUiIds.auth.dataChoice.discardDevice}
              onPress={() => void resolve('discard-device')}
              accessibilityLabel="Use cloud account only and discard device data">
              {working === 'discard-device' ? 'Restoring…' : 'Use cloud only'}
            </Button>
          </Card>
        </>
      ) : (
        <>
          <Card airy style={[styles.option, { borderColor: theme.accentPrimary }]}>
            <AppText variant="heading">Keep device data</AppText>
            <AppText variant="body" color="secondary">
              Upload every plan and setting from this device into your new account.
            </AppText>
            <Button
              size="lg"
              disabled={Boolean(working)}
              testID={AgentUiIds.auth.dataChoice.keepDevice}
              onPress={() => void resolve('keep-device')}
              accessibilityLabel="Keep guest device data in the new account">
              {working === 'keep-device' ? 'Uploading…' : 'Keep device data'}
            </Button>
          </Card>
          <Card airy style={[styles.option, { borderColor: theme.separator }]}>
            <AppText variant="heading">Start fresh</AppText>
            <AppText variant="body" color="secondary">
              Leave guest plans on this choice behind and open an empty account.
            </AppText>
            <Button
              variant="secondary"
              disabled={Boolean(working)}
              testID={AgentUiIds.auth.dataChoice.startFresh}
              onPress={() => void resolve('start-fresh')}
              accessibilityLabel="Start fresh without guest device data">
              {working === 'start-fresh' ? 'Clearing…' : 'Start fresh'}
            </Button>
          </Card>
        </>
      )}

      {error ? <ErrorMessage message={error} /> : null}

      <Button
        variant="ghost"
        disabled={Boolean(working)}
        testID={AgentUiIds.auth.dataChoice.cancel}
        onPress={() => void resolve('cancel')}
        accessibilityLabel="Cancel sign in and keep guest data">
        Cancel and keep guest data
      </Button>
      <AppText variant="caption" color="secondary" align="center">
        Cancel signs this account out on this device and leaves the guest dataset unchanged.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  option: { borderWidth: 1, borderRadius: radii.lg, gap: spacing.md },
});
