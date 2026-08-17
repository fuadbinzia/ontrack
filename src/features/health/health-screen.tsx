import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import {
    appPrompt,
    AppText,
    Button,
    Card,
    EmptyState,
    ErrorMessage,
    IconButton,
    Screen,
    SectionHeader,
    SegmentedControl,
} from '@/components/primitives';
import { MetricDisplay } from '@/components/shared';
import { spacing } from '@/design-system';
import { averageMetric, healthSummaryForDate, moodEntrySummary, playbookOutcomeSummary } from '@/features/health/model';
import type { AppleStateOfMindSample, HealthRange, MoodEntry } from '@/features/health/types';
import { useTheme } from '@/hooks/use-theme';
import {
    deleteOwnedAppleStateOfMind,
    isAppleHealthAvailable,
    isStateOfMindAvailable,
    openAppleHealth,
    queryAppleHealth90Days,
    queryAppleStateOfMind90Days,
    requestAppleHealthAccess,
} from '@/services/health/apple-health';
import { useHealth } from '@/store/health';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { todayKey } from '@/utils/date';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { useWarmHrefs } from '@/utils/warm-navigation';

type HealthSection = 'body' | 'mind';

function number(value: number | undefined, suffix = '') {
  return value === undefined ? '—' : `${Math.round(value).toLocaleString()}${suffix}`;
}

function hours(minutes: number | undefined) {
  return minutes === undefined ? '—' : `${(minutes / 60).toFixed(1)} hr`;
}

function importedMood(sample: AppleStateOfMindSample): MoodEntry | undefined {
  const ratings = sample.labels.map((label) => ({ emotionId: label, intensity: 3 as const }));
  if (!ratings.length) return undefined;
  return {
    id: sample.entryId ?? `apple-mood-${sample.uuid}`,
    occurredAt: sample.date,
    emotions: ratings,
    factorIds: [],
    source: sample.ownedByOnTrack ? 'ontrack' : 'apple-health',
    appleHealth: {
      uuid: sample.uuid,
      kind: sample.kind,
      valence: sample.valence,
      ownedByOnTrack: sample.ownedByOnTrack,
    },
    createdAt: sample.date,
    updatedAt: sample.date,
  };
}

export function HealthScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [section, setSection] = useState<HealthSection>('body');
  const [range, setRange] = useState<HealthRange>(7);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  useWarmHrefs(['/health/mood-check-in', '/health/settings']);
  const [available, setAvailable] = useState<boolean | undefined>();
  const [refreshError, setRefreshError] = useState<string>();
  const accessReviewed = useHealth((state) => state.accessReviewed);
  const stateOfMindSyncEnabled = useHealth((state) => state.stateOfMindSyncEnabled);
  const daily = useHealth((state) => state.dailySummaries);
  const workouts = useHealth((state) => state.workouts);
  const lastRefreshAt = useHealth((state) => state.lastRefreshAt);
  const emotions = useHealth((state) => state.emotions);
  const factors = useHealth((state) => state.factors);
  const entries = useHealth((state) => state.moodEntries);
  const playbooks = useHealth((state) => state.playbooks);
  const runs = useHealth((state) => state.playbookRuns);
  const replaceHealthImport = useHealth((state) => state.replaceHealthImport);
  const markAccessReviewed = useHealth((state) => state.markAccessReviewed);
  const saveMoodEntry = useHealth((state) => state.saveMoodEntry);
  const removeMoodEntry = useHealth((state) => state.removeMoodEntry);
  const startPlaybook = useHealth((state) => state.startPlaybook);
  const completePlaybook = useHealth((state) => state.completePlaybook);
  const cancelPlaybook = useHealth((state) => state.cancelPlaybook);

  const refreshHealth = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      const isAvailable = await isAppleHealthAvailable();
      setAvailable(isAvailable);
      if (!isAvailable || !useHealth.getState().accessReviewed) return;
      replaceHealthImport(await queryAppleHealth90Days());
      if (useHealth.getState().stateOfMindSyncEnabled && (await isStateOfMindAvailable())) {
        const existing = useHealth.getState().moodEntries;
        const knownUuids = new Set(existing.map((entry) => entry.appleHealth?.uuid).filter(Boolean));
        for (const sample of await queryAppleStateOfMind90Days()) {
          if (knownUuids.has(sample.uuid)) continue;
          const entry = importedMood(sample);
          if (entry) saveMoodEntry(entry);
        }
      }
    } catch (error) {
      setRefreshError(error instanceof Error && error.message === 'NATIVE_BUILD_REQUIRED'
        ? 'Install the latest native build to connect Apple Health.'
        : 'Apple Health could not refresh. Your last local summary is still available.');
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [replaceHealthImport, saveMoodEntry]);

  useFocusEffect(
    useCallback(
      () => deferAfterPageTransition(() => { void refreshHealth(); }),
      [refreshHealth],
    ),
  );

  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshHealth();
    });
    return () => subscription.remove();
  }, [refreshHealth]));

  const connect = async () => {
    try {
      if (await requestAppleHealthAccess(stateOfMindSyncEnabled)) {
        markAccessReviewed();
        await refreshHealth();
      }
    } catch {
      appPrompt.alert('Apple Health unavailable', 'Install the latest native build, then try again.');
    }
  };

  const recentDays = useMemo(() => daily.slice(-range), [daily, range]);
  const today = healthSummaryForDate(daily, todayKey());
  const latestEntry = entries[0];
  const activeRun = runs.find((run) => run.status === 'active');
  const activePlaybook = playbooks.find((playbook) => playbook.id === activeRun?.playbookId);

  const deleteEntry = (entry: MoodEntry) => {
    const localDelete = () => removeMoodEntry(entry.id);
    if (entry.appleHealth?.ownedByOnTrack) {
      appPrompt.alert('Delete mood check-in?', 'Choose where to remove this entry.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'onTrack only', style: 'destructive', onPress: localDelete },
        {
          text: 'onTrack + Apple Health',
          style: 'destructive',
          onPress: () => {
            void deleteOwnedAppleStateOfMind(entry.appleHealth!.uuid).finally(localDelete);
          },
        },
      ]);
      return;
    }
    confirmDestructiveAction({ title: 'Delete mood check-in?', actionLabel: 'Delete', onConfirm: localDelete });
  };

  return (
    <Screen onRefresh={refreshHealth} contentStyle={styles.screen}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="title">Health</AppText>
          <AppText color="secondary">Private trends and tools for understanding what helps you.</AppText>
          <Button
            variant="ghost"
            testID={AgentUiIds.health.privacy}
            accessibilityLabel="Privacy Policy"
            onPress={() => router.push('/privacy' as never)}>
            Privacy Policy
          </Button>
        </View>
        <IconButton
          icon="settings"
          accessibilityLabel="Health settings"
          testID={AgentUiIds.health.settings}
          onPress={() => router.push('/health/settings' as never)}
        />
      </View>
      <SegmentedControl
        value={section}
        options={[
          { value: 'body', label: 'Body', icon: 'health', testID: AgentUiIds.health.section('body') },
          { value: 'mind', label: 'Mind', icon: 'mindfulness', testID: AgentUiIds.health.section('mind') },
        ]}
        onChange={setSection}
      />

      {section === 'body' ? (
        <>
          <Card variant="sunken" style={styles.card}>
            <AppText variant="subheading">Apple Health</AppText>
            <AppText color="secondary">
              {available === false
                ? 'Apple Health is unavailable in this build or on this device.'
                : accessReviewed
                  ? 'Access reviewed. onTrack only sees the data types you chose to share.'
                  : 'Your Apple Watch syncs to Apple Health. Connect onTrack to read authorized summaries.'}
            </AppText>
            {!accessReviewed ? (
              <Button icon="health" loading={refreshing} testID={AgentUiIds.health.connect} onPress={() => void connect()} accessibilityLabel="Connect Apple Health">
                Connect Apple Health
              </Button>
            ) : (
              <View style={styles.actionRow}>
                <Button variant="secondary" loading={refreshing} testID={AgentUiIds.health.refresh} onPress={() => void refreshHealth()} accessibilityLabel="Refresh Apple Health">
                  Refresh
                </Button>
                <Button variant="ghost" testID={AgentUiIds.health.openAppleHealth} onPress={() => void openAppleHealth()} accessibilityLabel="Open Apple Health">
                  Open Apple Health
                </Button>
              </View>
            )}
            {lastRefreshAt ? <AppText variant="caption" color="tertiary">Last refreshed {new Date(lastRefreshAt).toLocaleString()}</AppText> : null}
            {refreshError ? <ErrorMessage message={refreshError} variant="caption" /> : null}
          </Card>

          <SectionHeader title="Today" />
          <View style={styles.metricRow}>
            <MetricDisplay label="Steps" value={number(today?.steps)} accent={theme.accentPrimary} />
            <MetricDisplay label="Active Energy" value={number(today?.activeEnergyKcal, ' kcal')} />
          </View>
          <View style={styles.metricRow}>
            <MetricDisplay label="Exercise" value={number(today?.exerciseMinutes, ' min')} />
            <MetricDisplay label="Sleep" value={hours(today?.sleepMinutes)} />
          </View>
          <View style={styles.metricRow}>
            <MetricDisplay label="Resting Heart Rate" value={number(today?.restingHeartRateBpm, ' bpm')} />
            <MetricDisplay label="Average Heart Rate" value={number(today?.heartRateAverageBpm, ' bpm')} />
          </View>

          <SectionHeader title="Trends" />
          <SegmentedControl
            value={String(range) as `${HealthRange}`}
            options={([7, 30, 90] as const).map((days) => ({ value: String(days) as `${HealthRange}`, label: `${days} days`, testID: AgentUiIds.health.range(days) }))}
            onChange={(value) => setRange(Number(value) as HealthRange)}
          />
          <View style={styles.metricRow}>
            <MetricDisplay label="Daily Steps" value={number(averageMetric(recentDays, 'steps'))} detail={`${range}-day average`} />
            <MetricDisplay label="Daily Sleep" value={hours(averageMetric(recentDays, 'sleepMinutes'))} detail={`${range}-day average`} />
          </View>

          <SectionHeader title="Recent Workouts" />
          {workouts.length ? workouts.slice(0, 5).map((workout) => (
            <Card key={workout.id} variant="sunken" style={styles.rowCard}>
              <View style={styles.flex}>
                <AppText variant="callout" bold>{workout.activityName}</AppText>
                <AppText variant="caption" color="secondary">{new Date(workout.startedAt).toLocaleString()}</AppText>
              </View>
              <AppText variant="callout" color="accent">{Math.round(workout.durationMinutes)} min</AppText>
            </Card>
          )) : <EmptyState icon="gym" title="No authorized workouts" message="Workouts will appear after Apple Health has shared them with onTrack." />}
        </>
      ) : (
        <>
          <Card style={styles.card}>
            <AppText variant="heading">How are you feeling?</AppText>
            <AppText color="secondary">Mixed emotions are welcome. A check-in can include several feelings and what may be affecting them.</AppText>
            <Button icon="add" testID={AgentUiIds.health.checkIn} onPress={() => router.push('/health/mood-check-in' as never)} accessibilityLabel="Add mood check-in">
              Check in
            </Button>
          </Card>

          {activeRun && activePlaybook ? (
            <Card variant="sunken" style={styles.card}>
              <AppText variant="overline" color="accent">Active playbook</AppText>
              <AppText variant="subheading">{activePlaybook.name}</AppText>
              {activePlaybook.steps.map((step, index) => <AppText key={`${activePlaybook.id}-${index}`}>{index + 1}. {step}</AppText>)}
              <Button testID={AgentUiIds.health.completePlaybook(activeRun.id)} onPress={() => {
                completePlaybook(activeRun.id);
                appPrompt.alert('Playbook complete', 'Would you like to check in again and notice what changed?', [
                  { text: 'Not now', style: 'cancel' },
                  { text: 'Follow-up check-in', style: 'primary', onPress: () => router.push({ pathname: '/health/mood-check-in', params: { runId: activeRun.id } } as never) },
                ]);
              }} accessibilityLabel={`Complete ${activePlaybook.name}`}>Complete playbook</Button>
              <Button
                variant="ghost"
                testID={AgentUiIds.health.cancelPlaybook(activeRun.id)}
                onPress={() => confirmDestructiveAction({
                  title: 'Stop this playbook?',
                  message: 'This run will be kept as cancelled and will not affect observed patterns.',
                  actionLabel: 'Stop playbook',
                  onConfirm: () => cancelPlaybook(activeRun.id),
                })}
                accessibilityLabel={`Stop ${activePlaybook.name}`}>Stop</Button>
            </Card>
          ) : null}

          <SectionHeader title="Recent Check-ins" detail={entries.length ? `${entries.length} private entries` : undefined} />
          {latestEntry ? entries.slice(0, 5).map((entry) => (
            <Card
              key={entry.id}
              variant="sunken"
              style={styles.card}
              testID={AgentUiIds.health.moodEntry(entry.id)}
              onPress={entry.source === 'ontrack' ? () => router.push({ pathname: '/health/mood-check-in', params: { entryId: entry.id } } as never) : undefined}
              onLongPress={() => deleteEntry(entry)}
              accessibilityLabel={`${moodEntrySummary(entry, emotions)}. ${entry.source === 'ontrack' ? 'Tap to edit. ' : ''}Hold to delete.`}>
              <AppText variant="subheading">{moodEntrySummary(entry, emotions)}</AppText>
              <AppText variant="caption" color="secondary">{new Date(entry.occurredAt).toLocaleString()} · {entry.source === 'apple-health' ? 'Apple Health' : 'onTrack'}</AppText>
              {entry.factorIds.length ? <AppText variant="caption">Affected by {entry.factorIds.map((id) => factors.find((factor) => factor.id === id)?.name).filter(Boolean).join(', ')}</AppText> : null}
              {entry.note ? <AppText color="secondary">{entry.note}</AppText> : null}
            </Card>
          )) : <EmptyState icon="mindfulness" title="No mood check-ins yet" message="Start with what you feel right now—there is no right or wrong mood." />}

          <SectionHeader title="Things That Affect Me" />
          {factors.length ? (
            <View style={styles.chips}>{factors.map((factor) => (
              <Button
                key={factor.id}
                size="sm"
                variant="secondary"
                testID={AgentUiIds.health.editFactor(factor.id)}
                onPress={() => router.push({ pathname: '/health/factor-editor', params: { factorId: factor.id } } as never)}
                accessibilityLabel={`Edit ${factor.name}`}>{factor.name}</Button>
            ))}</View>
          ) : <AppText color="secondary">Save people, places, activities, situations, thoughts, or body states that often connect to a mood.</AppText>}
          <Button variant="secondary" icon="add" testID={AgentUiIds.health.addFactor} onPress={() => router.push('/health/factor-editor' as never)} accessibilityLabel="Add mood factor">Add something that affects me</Button>

          <SectionHeader title="Private Playbooks" />
          {playbooks.length ? playbooks.filter((playbook) => playbook.enabled).map((playbook) => {
            const outcome = playbookOutcomeSummary({ playbook, runs, entries, emotions });
            return (
              <Card key={playbook.id} variant="sunken" style={styles.card}>
                <AppText variant="subheading">{playbook.name}</AppText>
                <AppText variant="caption" color="secondary">When {playbook.sourceEmotionIds.map((id) => emotions.find((emotion) => emotion.id === id)?.name).filter(Boolean).join(', ') || 'I need support'}</AppText>
                {playbook.steps.map((step, index) => <AppText key={`${playbook.id}-${index}`}>{index + 1}. {step}</AppText>)}
                {outcome ? <AppText variant="caption" color="accent">{outcome}</AppText> : null}
                <View style={styles.actionRow}>
                  <Button variant="secondary" icon="play" disabled={Boolean(activeRun)} testID={AgentUiIds.health.startPlaybook(playbook.id)} onPress={() => startPlaybook(playbook.id, latestEntry?.id)} accessibilityLabel={`Start ${playbook.name}`}>Start</Button>
                  <Button variant="ghost" testID={AgentUiIds.health.editPlaybook(playbook.id)} onPress={() => router.push({ pathname: '/health/playbook-editor', params: { playbookId: playbook.id } } as never)} accessibilityLabel={`Edit ${playbook.name}`}>Edit</Button>
                </View>
              </Card>
            );
          }) : <AppText color="secondary">Create a reusable “when I feel X, try Y” plan. Nothing is presented as treatment.</AppText>}
          <Button variant="secondary" icon="add" testID={AgentUiIds.health.addPlaybook} onPress={() => router.push('/health/playbook-editor' as never)} accessibilityLabel="Create mood playbook">Create playbook</Button>

          <Card variant="sunken" style={styles.card}>
            <AppText variant="subheading">Need support now?</AppText>
            <AppText color="secondary">onTrack is not emergency or medical care. In the U.S., call or text 988. If you may be in immediate danger, contact local emergency services.</AppText>
            <View style={styles.actionRow}>
              <Button variant="secondary" testID={AgentUiIds.health.call988} onPress={() => void Linking.openURL('tel:988')} accessibilityLabel="Call 988">Call 988</Button>
              <Button variant="ghost" testID={AgentUiIds.health.text988} onPress={() => void Linking.openURL('sms:988')} accessibilityLabel="Text 988">Text 988</Button>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  card: { gap: spacing.md },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricRow: { flexDirection: 'row', gap: spacing.md },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
