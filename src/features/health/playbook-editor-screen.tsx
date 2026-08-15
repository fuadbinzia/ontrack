import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { appPrompt, AppText, Button, Card, Input, Screen, SectionHeader } from '@/components/primitives';
import { spacing } from '@/design-system';
import type { MoodActionSuggestion } from '@/services/health/action-suggestions';
import { requestMoodSuggestions } from '@/services/health/action-suggestions-client';
import { useHealth } from '@/store/health';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

export function PlaybookEditorScreen() {
  const router = useRouter();
  const { playbookId } = useLocalSearchParams<{ playbookId?: string }>();
  const emotions = useHealth((state) => state.emotions);
  const playbook = useHealth((state) => state.playbooks.find((item) => item.id === playbookId));
  const savePlaybook = useHealth((state) => state.savePlaybook);
  const removePlaybook = useHealth((state) => state.removePlaybook);
  const aiDisclosureAccepted = useHealth((state) => state.aiDisclosureAccepted);
  const acceptAiDisclosure = useHealth((state) => state.acceptAiDisclosure);
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const [name, setName] = useState(playbook?.name ?? '');
  const [sourceIds, setSourceIds] = useState<string[]>(playbook?.sourceEmotionIds ?? []);
  const [targetIds, setTargetIds] = useState<string[]>(playbook?.targetEmotionIds ?? []);
  const [steps, setSteps] = useState(playbook?.steps?.join('\n') ?? '');
  const [duration, setDuration] = useState(playbook?.durationMinutes ? String(playbook.durationMinutes) : '');
  const [suggestions, setSuggestions] = useState<MoodActionSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const generateSuggestions = async () => {
    if (!sourceIds.length) { appPrompt.alert('Choose how you feel', 'Select at least one starting feeling before requesting ideas.'); return; }
    setSuggesting(true);
    try {
      const result = await requestMoodSuggestions({
        emotions: sourceIds.map((id) => ({ label: emotions.find((emotion) => emotion.id === id)?.name ?? id, intensity: 3 })),
        factorNames: [],
        desiredEmotions: targetIds.map((id) => emotions.find((emotion) => emotion.id === id)?.name ?? id),
      });
      setSuggestions(result.suggestions);
    } catch (error) {
      appPrompt.alert('Suggestions unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally { setSuggesting(false); }
  };

  const requestSuggestions = () => {
    if (!aiDisclosureAccepted) {
      appPrompt.alert('Optional AI suggestion', 'Only the feeling labels, generic intensity, and desired feelings selected here are sent for this request. Journal notes, Apple Health data, history, and identifiers are never included.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'primary', onPress: () => { acceptAiDisclosure(); void generateSuggestions(); } },
      ]);
      return;
    }
    void generateSuggestions();
  };

  const save = () => {
    const parsedSteps = steps.split('\n').map((step) => step.trim()).filter(Boolean);
    if (!name.trim() || !sourceIds.length || !parsedSteps.length) {
      appPrompt.alert('Complete the playbook', 'Add a name, at least one starting feeling, and one action step.');
      return;
    }
    savePlaybook({ id: playbook?.id, name, sourceEmotionIds: sourceIds, targetEmotionIds: targetIds, steps: parsedSteps, durationMinutes: duration ? Number(duration) : undefined, enabled: playbook?.enabled ?? true });
    router.back();
  };

  const emotionButtons = (selected: string[], setSelected: (value: string[]) => void, prefix: 'source' | 'target') => (
    <View style={styles.chips}>{emotions.map((emotion) => {
      const active = selected.includes(emotion.id);
      return <Button key={emotion.id} size="sm" variant={active ? 'primary' : 'secondary'} testID={AgentUiIds.health.playbookEmotion(prefix, emotion.id)} onPress={() => setSelected(active ? selected.filter((id) => id !== emotion.id) : [...selected, emotion.id])} accessibilityLabel={`${active ? 'Remove' : 'Add'} ${emotion.name}`}>{emotion.name}</Button>;
    })}</View>
  );

  return (
    <Screen refresh={false} contentStyle={styles.screen}>
      <AppText variant="title">{playbook ? 'Edit Private Playbook' : 'Create a Private Playbook'}</AppText>
      <AppText color="secondary">Make a small, reusable plan for supporting yourself through a feeling. This is not medical treatment.</AppText>
      <Input label="Playbook name" value={name} onChangeText={setName} placeholder="When I feel overwhelmed" accessibilityLabel="Playbook name" testID={AgentUiIds.health.playbookName} />
      <SectionHeader title="When I feel" />
      {emotionButtons(sourceIds, setSourceIds, 'source')}
      <SectionHeader title="I would like to move toward" />
      {emotionButtons(targetIds, setTargetIds, 'target')}
      <Input label="Action steps" value={steps} onChangeText={setSteps} placeholder={'Put the phone down\nDrink water\nTake a 10-minute walk'} multiline accessibilityLabel="Playbook action steps, one per line" testID={AgentUiIds.health.playbookSteps} />
      <Input label="Approximate minutes (optional)" value={duration} onChangeText={setDuration} keyboardType="number-pad" accessibilityLabel="Playbook duration minutes" testID={AgentUiIds.health.playbookDuration} />
      {aiEnabled ? (
        <>
          <Button variant="secondary" icon="smart" loading={suggesting} testID={AgentUiIds.health.suggestPlaybook} onPress={requestSuggestions} accessibilityLabel="Suggest playbook actions with AI">Suggest private-safe ideas</Button>
          {suggestions.map((suggestion, index) => (
            <Card key={`${suggestion.title}-${index}`} variant="sunken" style={styles.suggestion}>
              <AppText variant="subheading">{suggestion.title}</AppText>
              <AppText variant="caption" color="secondary">{suggestion.why}</AppText>
              {suggestion.steps.map((step, stepIndex) => <AppText key={`${suggestion.title}-${stepIndex}`}>{stepIndex + 1}. {step}</AppText>)}
              <Button size="sm" variant="secondary" testID={AgentUiIds.health.useSuggestion(index)} onPress={() => {
                setName(suggestion.title);
                setSteps(suggestion.steps.join('\n'));
                setDuration(suggestion.durationMinutes ? String(suggestion.durationMinutes) : '');
              }} accessibilityLabel={`Use ${suggestion.title}`}>Use and edit</Button>
            </Card>
          ))}
        </>
      ) : <AppText variant="caption" color="tertiary">AI suggestions are disabled in Profile settings. Personal playbooks work without AI.</AppText>}
      <Button size="lg" testID={AgentUiIds.health.savePlaybook} onPress={save} accessibilityLabel="Save playbook">Save playbook</Button>
      {playbook ? (
        <Button
          variant="danger"
          testID={AgentUiIds.health.deletePlaybook}
          onPress={() => confirmDestructiveAction({
            title: 'Delete this playbook?',
            message: 'Its completed and active runs will also be removed.',
            actionLabel: 'Delete playbook',
            onConfirm: () => { removePlaybook(playbook.id); router.back(); },
          })}
          accessibilityLabel="Delete playbook">Delete playbook</Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ screen: { gap: spacing.md }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, suggestion: { gap: spacing.sm } });
