import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { appPrompt, AppText, Button, Card, Screen, SegmentedControl, SectionHeader } from '@/components/primitives';
import { spacing } from '@/design-system';
import { isAppleHealthAvailable, isStateOfMindAvailable, openAppleHealth, requestAppleHealthAccess } from '@/services/health/apple-health';
import { useHealth } from '@/store/health';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

type Toggle = 'off' | 'on';

export function HealthSettingsScreen() {
  const router = useRouter();
  const accessReviewed = useHealth((state) => state.accessReviewed);
  const syncEnabled = useHealth((state) => state.stateOfMindSyncEnabled);
  const setSyncEnabled = useHealth((state) => state.setStateOfMindSyncEnabled);
  const markAccessReviewed = useHealth((state) => state.markAccessReviewed);
  const reset = useHealth((state) => state.reset);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [mindAvailable, setMindAvailable] = useState(false);

  useEffect(() => {
    void Promise.all([isAppleHealthAvailable(), isStateOfMindAvailable()]).then(([health, mind]) => {
      setHealthAvailable(health);
      setMindAvailable(mind);
    });
  }, []);

  const connect = async (stateWrite = syncEnabled) => {
    try {
      if (await requestAppleHealthAccess(stateWrite)) markAccessReviewed();
    } catch {
      appPrompt.alert(
        'Couldn’t Reach Apple Health',
        'This needs the latest onTrack on an iPhone. Your mood journal still works here.',
      );
    }
  };

  const changeSync = async (value: Toggle) => {
    if (value === 'off') { setSyncEnabled(false); return; }
    if (!mindAvailable) {
      appPrompt.alert(
        'Apple Health Needs iOS 18',
        'Apple Health State of Mind needs iOS 18 or later. Your onTrack mood journal still works privately.',
      );
      return;
    }
    await connect(true);
    setSyncEnabled(true);
  };

  return (
    <Screen refresh={false} contentStyle={styles.screen}>
      <AppText variant="title">Health Settings</AppText>
      <AppText color="secondary">Apple Health permissions are controlled by iOS. onTrack cannot tell which read types you declined.</AppText>
      <SectionHeader title="Apple Health" />
      <Card variant="sunken" style={styles.card}>
        <AppText variant="subheading">{accessReviewed ? 'Access reviewed' : healthAvailable ? 'Not connected yet' : 'Unavailable in this build'}</AppText>
        <AppText color="secondary">Reads authorized activity, heart-rate, workout, and sleep summaries for the last 90 days. Raw samples are not cached.</AppText>
        {!accessReviewed ? (
          <Button icon="health" testID={AgentUiIds.health.settingsConnect} onPress={() => void connect()} accessibilityLabel="Connect Apple Health">Connect Apple Health</Button>
        ) : (
          <Button variant="secondary" testID={AgentUiIds.health.openAppleHealthSettings} onPress={() => void openAppleHealth()} accessibilityLabel="Manage Apple Health permissions">Manage in Apple Health</Button>
        )}
      </Card>

      <SectionHeader title="State of Mind" />
      <Card variant="sunken" style={styles.card}>
        <AppText color="secondary">Optional two-way mood interoperability. Notes, custom feelings, factors, and playbooks always stay in onTrack.</AppText>
        <SegmentedControl<Toggle>
          value={syncEnabled ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'Off', testID: AgentUiIds.health.stateSync('off') },
            { value: 'on', label: 'On', testID: AgentUiIds.health.stateSync('on'), disabled: !mindAvailable },
          ]}
          onChange={(value) => void changeSync(value)}
        />
        {!mindAvailable ? <AppText variant="caption" color="tertiary">Requires iOS 18 or later and the newest native build.</AppText> : null}
      </Card>

      <SectionHeader title="Privacy" />
      <Card variant="sunken" style={styles.card}>
        <AppText variant="subheading">Local and encrypted</AppText>
        <AppText color="secondary">Health summaries, check-ins, notes, factors, and playbooks use a separate encrypted store whose key stays in this device’s Keychain. They are not included in Supabase sync.</AppText>
      </Card>
      <Button
        variant="danger"
        testID={AgentUiIds.health.reset}
        onPress={() => confirmDestructiveAction({
          title: 'Reset Health data?',
          message: 'This removes onTrack’s local Health summaries, mood entries, factors, and playbooks. It does not delete Apple Health data.',
          actionLabel: 'Reset Health',
          onConfirm: () => { reset(); router.back(); },
        })}
        accessibilityLabel="Reset local Health data">Reset local Health data</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({ screen: { gap: spacing.md }, card: { gap: spacing.md } });
