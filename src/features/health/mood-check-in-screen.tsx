import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { appPrompt, AppText, Button, Card, Input, Screen, SegmentedControl, SectionHeader } from '@/components/primitives';
import { spacing } from '@/design-system';
import type { MoodEmotionRating } from '@/features/health/types';
import { deleteOwnedAppleStateOfMind, isStateOfMindAvailable, saveAppleStateOfMind } from '@/services/health/apple-health';
import { useHealth } from '@/store/health';
import { AgentUiIds } from '@/utils/agent-ui';

type Intensity = MoodEmotionRating['intensity'];
type StateKind = 'momentary' | 'daily';
type Valence = '-1' | '-0.5' | '0' | '0.5' | '1';

const CATEGORY_ASSOCIATION: Record<string, string | undefined> = {
  person: 'friends',
  place: 'community',
  activity: 'hobbies',
  situation: 'tasks',
  thought: 'selfCare',
  body: 'health',
};

export function MoodCheckInScreen() {
  const router = useRouter();
  const { entryId, runId } = useLocalSearchParams<{ entryId?: string; runId?: string }>();
  const emotions = useHealth((state) => state.emotions);
  const factors = useHealth((state) => state.factors);
  const existingEntry = useHealth((state) => state.moodEntries.find((entry) => entry.id === entryId));
  const syncEnabled = useHealth((state) => state.stateOfMindSyncEnabled);
  const saveMoodEntry = useHealth((state) => state.saveMoodEntry);
  const addCustomEmotion = useHealth((state) => state.addCustomEmotion);
  const linkFollowUp = useHealth((state) => state.linkFollowUp);
  const [ratings, setRatings] = useState<Record<string, Intensity>>(
    () =>
      Object.fromEntries(
        (existingEntry?.emotions ?? []).map((rating) => [
          rating.emotionId,
          rating.intensity,
        ]),
      ),
  );
  const [factorIds, setFactorIds] = useState<string[]>(existingEntry?.factorIds ?? []);
  const [note, setNote] = useState(existingEntry?.note ?? '');
  const [customEmotion, setCustomEmotion] = useState('');
  const [stateKind, setStateKind] = useState<StateKind>(existingEntry?.appleHealth?.kind ?? 'momentary');
  const [valence, setValence] = useState<Valence>(String(existingEntry?.appleHealth?.valence ?? 0) as Valence);
  const [stateAvailable, setStateAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void isStateOfMindAvailable().then(setStateAvailable); }, []);
  const selected = useMemo(() => Object.keys(ratings), [ratings]);

  const toggleEmotion = (id: string) => {
    setRatings((current) => {
      if (current[id]) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: 3 };
    });
  };

  const save = async () => {
    if (!selected.length) {
      appPrompt.alert('Choose at least one feeling', 'Mixed feelings are welcome—you can select more than one.');
      return;
    }
    setSaving(true);
    const occurredAt = existingEntry?.occurredAt ?? new Date().toISOString();
    const entryId = saveMoodEntry({
      id: existingEntry?.id,
      occurredAt,
      emotions: selected.map((emotionId) => ({ emotionId, intensity: ratings[emotionId] })),
      factorIds,
      note,
      source: existingEntry?.source ?? 'ontrack',
      linkedPlaybookRunId: runId ?? existingEntry?.linkedPlaybookRunId,
    });
    if (runId) linkFollowUp(runId, entryId);

    if (syncEnabled && stateAvailable) {
      const labels = selected.map((id) => emotions.find((emotion) => emotion.id === id)?.appleLabel).filter((value): value is string => Boolean(value));
      const associations = factorIds.map((id) => CATEGORY_ASSOCIATION[factors.find((factor) => factor.id === id)?.category ?? '']).filter((value): value is string => Boolean(value));
      if (labels.length) {
        try {
          if (existingEntry?.appleHealth?.ownedByOnTrack) {
            await deleteOwnedAppleStateOfMind(existingEntry.appleHealth.uuid);
          }
          const result = await saveAppleStateOfMind({ entryId, date: occurredAt, kind: stateKind, valence: Number(valence), labels, associations });
          saveMoodEntry({
            id: entryId,
            occurredAt,
            emotions: selected.map((emotionId) => ({ emotionId, intensity: ratings[emotionId] })),
            factorIds,
            note,
            source: existingEntry?.source ?? 'ontrack',
            linkedPlaybookRunId: runId ?? existingEntry?.linkedPlaybookRunId,
            appleHealth: { uuid: result.uuid, kind: stateKind, valence: Number(valence), ownedByOnTrack: true },
          });
        } catch {
          appPrompt.alert('Saved privately in onTrack', 'Apple Health could not save this State of Mind entry. Your private onTrack check-in is safe.');
        }
      }
    }
    setSaving(false);
    router.back();
  };

  return (
    <Screen refresh={false} contentStyle={styles.screen}>
      <AppText variant="title">{runId ? 'Follow-up Check-in' : existingEntry ? 'Edit Mood Check-in' : 'Mood Check-in'}</AppText>
      <AppText color="secondary">Name what is present without judging it. Select as many feelings as fit.</AppText>

      <SectionHeader title="What are you feeling?" />
      <View style={styles.chips}>
        {emotions.map((emotion) => (
          <Button
            key={emotion.id}
            size="sm"
            variant={ratings[emotion.id] ? 'primary' : 'secondary'}
            testID={AgentUiIds.health.emotion(emotion.id)}
            accessibilityLabel={`${ratings[emotion.id] ? 'Remove' : 'Add'} ${emotion.name}`}
            onPress={() => toggleEmotion(emotion.id)}>
            {emotion.name}
          </Button>
        ))}
      </View>
      <View style={styles.inline}>
        <Input
          value={customEmotion}
          onChangeText={setCustomEmotion}
          placeholder="Add a custom feeling"
          accessibilityLabel="Custom feeling name"
          testID={AgentUiIds.health.customEmotion}
          containerStyle={styles.flex}
        />
        <Button
          variant="secondary"
          disabled={!customEmotion.trim()}
          testID={AgentUiIds.health.addCustomEmotion}
          onPress={() => {
            const id = addCustomEmotion(customEmotion);
            setRatings((current) => ({ ...current, [id]: 3 }));
            setCustomEmotion('');
          }}
          accessibilityLabel="Add custom feeling">Add</Button>
      </View>

      {selected.map((id) => (
        <Card key={id} variant="sunken" style={styles.card}>
          <AppText variant="callout" bold>{emotions.find((emotion) => emotion.id === id)?.name ?? id} intensity</AppText>
          <SegmentedControl
            value={String(ratings[id])}
            options={([1, 2, 3, 4, 5] as const).map((value) => ({ value: String(value), label: String(value), testID: AgentUiIds.health.intensity(id, value) }))}
            onChange={(value) => setRatings((current) => ({ ...current, [id]: Number(value) as Intensity }))}
          />
        </Card>
      ))}

      {factors.length ? (
        <>
          <SectionHeader title="What may be affecting this?" />
          <View style={styles.chips}>
            {factors.map((factor) => {
              const active = factorIds.includes(factor.id);
              return <Button key={factor.id} size="sm" variant={active ? 'primary' : 'secondary'} testID={AgentUiIds.health.factor(factor.id)} onPress={() => setFactorIds((current) => active ? current.filter((id) => id !== factor.id) : [...current, factor.id])} accessibilityLabel={`${active ? 'Remove' : 'Add'} ${factor.name}`}>{factor.name}</Button>;
            })}
          </View>
        </>
      ) : null}

      <Input
        label="Private note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="What feels important to remember?"
        multiline
        accessibilityLabel="Private mood note"
        testID={AgentUiIds.health.note}
      />

      {syncEnabled && stateAvailable ? (
        <Card variant="sunken" style={styles.card}>
          <AppText variant="subheading">Save compatible labels to Apple Health</AppText>
          <AppText variant="caption" color="secondary">Your note, custom feelings, and onTrack playbooks are never written to Apple Health.</AppText>
          <SegmentedControl value={stateKind} options={[{ value: 'momentary', label: 'Right now', testID: AgentUiIds.health.stateKind('momentary') }, { value: 'daily', label: 'Today overall', testID: AgentUiIds.health.stateKind('daily') }]} onChange={setStateKind} />
          <SegmentedControl label="Overall pleasantness" value={valence} options={[
            { value: '-1', label: 'Very low', testID: AgentUiIds.health.valence('-1') },
            { value: '-0.5', label: 'Low', testID: AgentUiIds.health.valence('-0.5') },
            { value: '0', label: 'Neutral', testID: AgentUiIds.health.valence('0') },
            { value: '0.5', label: 'Good', testID: AgentUiIds.health.valence('0.5') },
            { value: '1', label: 'Very good', testID: AgentUiIds.health.valence('1') },
          ]} onChange={setValence} />
        </Card>
      ) : null}

      <Button size="lg" loading={saving} testID={AgentUiIds.health.saveCheckIn} onPress={() => void save()} accessibilityLabel="Save mood check-in">Save check-in</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
});
