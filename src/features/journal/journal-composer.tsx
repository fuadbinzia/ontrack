import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  appPrompt,
  AppText,
  Dropdown,
  GlassPlate,
  IconButton,
  Input,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { useAutoGrowingNote } from '@/features/travel/use-auto-growing-note';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { requestJournalTranscribe } from '@/services/journal/transcribe-client';
import { useJournal } from '@/store/journal';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { journalDictateStatusMessage } from './journal-dictate-status';

import {
  audioDataUrlFromUri,
  deleteRecordedAudio,
  useJournalRecorder,
} from './use-journal-recorder';
import { persistJournalVoice } from './voice-persist';

type ComposerAction = 'dictate' | 'voice' | 'link';

export function useJournalComposer(dateKey: string, onRequestLink: () => void) {
  const { s } = useResponsive();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const grow = useAutoGrowingNote(draft, Math.max(44, s(44)));
  const addText = useJournal((state) => state.addText);
  const addVoice = useJournal((state) => state.addVoice);
  const aiDisclosureAccepted = useJournal((state) => state.aiDisclosureAccepted);
  const acceptAiDisclosure = useJournal((state) => state.acceptAiDisclosure);
  const recorder = useJournalRecorder();
  const controlSize = Math.max(30, s(32));

  const sendText = () => {
    if (!draft.trim()) return;
    addText(dateKey, draft);
    setDraft('');
    grow.collapseWhenEmpty('');
    haptics.success();
  };

  const finishDictate = async () => {
    setBusy(true);
    const captured = await recorder.finish();
    if (!captured?.uri) {
      setBusy(false);
      return;
    }
    try {
      const audioDataUrl = await audioDataUrlFromUri(captured.uri);
      deleteRecordedAudio(captured.uri);
      const { text } = await requestJournalTranscribe(audioDataUrl);
      if (text.trim()) {
        addText(dateKey, text);
        haptics.success();
      } else {
        recorder.setStatusMessage('Nothing was heard. Try again or type.');
      }
    } catch (error) {
      recorder.setStatusMessage(journalDictateStatusMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const finishVoiceNote = async () => {
    setBusy(true);
    const captured = await recorder.finish();
    if (!captured?.uri) {
      setBusy(false);
      return;
    }
    try {
      const uri = await persistJournalVoice(captured.uri);
      deleteRecordedAudio(captured.uri);
      addVoice(dateKey, uri, captured.durationMs);
      haptics.success();
    } catch {
      recorder.setStatusMessage('That voice note could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const startDictate = () => {
    const begin = () => {
      void recorder.start('dictate', () => void finishDictate());
    };
    if (aiDisclosureAccepted) {
      begin();
      return;
    }
    appPrompt.alert(
      'Dictate With onTrack AI?',
      'A short recording is sent to transcribe your words, then discarded. Voice notes stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'primary',
          onPress: () => {
            acceptAiDisclosure();
            begin();
          },
        },
      ],
    );
  };

  const recording = recorder.recording;
  const canSend = Boolean(draft.trim()) && !recording && !busy;

  return {
    draft,
    setDraft,
    grow,
    busy,
    recording,
    canSend,
    controlSize,
    recorder,
    sendText,
    startDictate,
    startVoice: () => void recorder.start('voice', () => void finishVoiceNote()),
    onRequestLink,
    stopRecording: () => {
      if (recorder.mode === 'voice') void finishVoiceNote();
      else void finishDictate();
    },
  };
}

export type JournalComposerSession = ReturnType<typeof useJournalComposer>;

export function JournalAddMenu({ session }: { session: JournalComposerSession }) {
  const theme = useTheme();
  const options = useMemo(
    () => [
      {
        value: 'dictate' as const,
        label: 'Dictate to Text',
        testID: AgentUiIds.journal.composer.dictate,
        leading: <Symbol name="microphone" size="sm" color={theme.textSecondary} />,
      },
      {
        value: 'voice' as const,
        label: 'Record Voice Note',
        testID: AgentUiIds.journal.composer.voiceNote,
        leading: <Symbol name="waveform" size="sm" color={theme.textSecondary} />,
      },
      {
        value: 'link' as const,
        label: 'Link a Section',
        testID: AgentUiIds.journal.composer.link,
        leading: <Symbol name="link" size="sm" color={theme.textSecondary} />,
      },
    ],
    [theme.textSecondary],
  );

  const runAction = (action: ComposerAction) => {
    if (action === 'dictate') session.startDictate();
    else if (action === 'voice') session.startVoice();
    else session.onRequestLink();
  };

  return (
    <Dropdown
      label="Add to Page"
      value={'' as ComposerAction}
      options={options}
      onChange={runAction}
      matchTriggerWidth={false}
      accessibilityLabel="Add to Page"
      renderTrigger={({ onPress, fieldRef }) => (
        <View ref={fieldRef} collapsable={false}>
          <IconButton
            icon="add"
            accessibilityLabel="Add to Page"
            testID={AgentUiIds.journal.composer.menu}
            disabled={session.busy || session.recording}
            onPress={onPress}
          />
        </View>
      )}
    />
  );
}

export function JournalComposer({
  session,
  onFieldFocus,
}: {
  session: JournalComposerSession;
  onFieldFocus?: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const { draft, setDraft, grow, busy, recording, canSend, controlSize, recorder } =
    session;
  const dark = theme.name === 'dark';
  const plateRadius = Math.max(radii.lg, s(18));

  return (
    <View style={[styles.dock, { gap: spacing.xs }]}>
      {recorder.statusMessage ? (
        <AppText variant="caption" color="secondary">
          {recorder.statusMessage}
        </AppText>
      ) : null}
      <GlassPlate
        intensity={dark ? 56 : 70}
        style={[
          styles.plate,
          {
            borderRadius: plateRadius,
          },
        ]}>
        <Input
          value={draft}
          onChangeText={(next) => {
            setDraft(next);
            grow.collapseWhenEmpty(next);
          }}
          onContentSizeChange={grow.onContentSizeChange}
          placeholder="Write this page…"
          placeholderTextColor={theme.textSecondary}
          fieldBackground="transparent"
          fieldBorderColor="transparent"
          fieldBorderRadius={plateRadius}
          multiline
          testID={AgentUiIds.journal.composer.input}
          containerStyle={styles.field}
          style={grow.style}
          editable={!recording && !busy}
          onFocus={onFieldFocus}
          trailing={
            recording ? (
              <IconButton
                icon="stop"
                color={theme.danger}
                accessibilityLabel="Stop Recording"
                testID={AgentUiIds.journal.composer.stop}
                loading={busy}
                size={controlSize}
                onPress={session.stopRecording}
              />
            ) : (
              <IconButton
                icon="send"
                accessibilityLabel="Add Text"
                testID={AgentUiIds.journal.composer.send}
                disabled={!canSend}
                color={canSend ? theme.textOnAccent : theme.textSecondary}
                background={canSend ? theme.accentPrimary : undefined}
                appearance={canSend ? 'solid' : 'glass'}
                size={controlSize}
                onPress={session.sendText}
              />
            )
          }
        />
      </GlassPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    width: '100%',
  },
  plate: {
    width: '100%',
    borderCurve: 'continuous',
  },
  field: {
    width: '100%',
    minWidth: 0,
  },
});
