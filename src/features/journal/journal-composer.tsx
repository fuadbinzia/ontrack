import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  appPrompt,
  AppText,
  Dropdown,
  GlassPlate,
  IconButton,
  Input,
  Symbol,
} from '@/components/primitives';
import { motion, radii } from '@/design-system';
import { useAutoGrowingNote } from '@/features/travel/use-auto-growing-note';
import { useResponsive } from '@/hooks/use-responsive';
import { useHeldOverlay } from '@/hooks/use-held-overlay';
import { useTheme } from '@/hooks/use-theme';
import { requestJournalTranscribe } from '@/services/journal/transcribe-client';
import { useJournal } from '@/store/journal';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import {
  journalDictateStatusMessage,
  mergeDictationIntoDraft,
} from './journal-dictate-status';
import { JournalRecordingWave } from './journal-recording-wave';

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
  const [transcribing, setTranscribing] = useState(false);
  const grow = useAutoGrowingNote(draft, Math.max(44, s(44)));
  const addText = useJournal((state) => state.addText);
  const addVoice = useJournal((state) => state.addVoice);
  const aiDisclosureAccepted = useJournal((state) => state.aiDisclosureAccepted);
  const acceptAiDisclosure = useJournal((state) => state.acceptAiDisclosure);
  const recorder = useJournalRecorder();
  const controlSize = Math.max(30, s(32));
  // The 60s cap and a manual stop can land together — only the first finisher
  // may run, or the loser's cleanup clears Transcribing/busy mid-flight.
  const finishingRef = useRef(false);
  // A take belongs to the day where capture started, even if the visible date
  // changes before a late finisher (the 60s cap) lands.
  const captureDateRef = useRef(dateKey);

  const sendText = () => {
    if (!draft.trim()) return;
    addText(dateKey, draft);
    setDraft('');
    grow.collapseWhenEmpty('');
    haptics.success();
  };

  const finishDictate = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setBusy(true);
    // Flip before the recorder settles so the pill morphs straight from the
    // wave into Transcribing without a blank frame.
    setTranscribing(true);
    try {
      const captured = await recorder.finish();
      if (!captured?.uri) return;
      const audioDataUrl = await audioDataUrlFromUri(captured.uri);
      deleteRecordedAudio(captured.uri);
      const { text } = await requestJournalTranscribe(audioDataUrl);
      if (text.trim()) {
        // Dictation lands in the input for review — the user sends it.
        setDraft((prev) => mergeDictationIntoDraft(prev, text));
        haptics.success();
      } else {
        recorder.setStatusMessage('Nothing was heard. Try again or type.');
      }
    } catch (error) {
      recorder.setStatusMessage(journalDictateStatusMessage(error));
    } finally {
      finishingRef.current = false;
      setTranscribing(false);
      setBusy(false);
    }
  };

  const finishVoiceNote = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setBusy(true);
    try {
      const captured = await recorder.finish();
      if (!captured?.uri) return;
      const uri = await persistJournalVoice(captured.uri);
      deleteRecordedAudio(captured.uri);
      addVoice(captureDateRef.current, uri, captured.durationMs);
      haptics.success();
    } catch {
      recorder.setStatusMessage('That voice note could not be saved.');
    } finally {
      finishingRef.current = false;
      setBusy(false);
    }
  };

  const startDictate = () => {
    const begin = () => {
      captureDateRef.current = dateKey;
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
    transcribing,
    canSend,
    controlSize,
    recorder,
    sendText,
    startDictate,
    startVoice: () => {
      captureDateRef.current = dateKey;
      void recorder.start('voice', () => void finishVoiceNote());
    },
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
  const {
    draft,
    setDraft,
    grow,
    busy,
    recording,
    transcribing,
    canSend,
    controlSize,
    recorder,
  } = session;
  const dark = theme.name === 'dark';
  const plateRadius = Math.max(radii.lg, s(18));

  // The pill is one stable shell: the input and the capture row crossfade in
  // place so stopping a take never snaps or traps the next tap.
  const overlayActive = recording || transcribing;
  const overlayHeld = useHeldOverlay(overlayActive);
  const overlayProgress = useSharedValue(overlayActive ? 1 : 0);
  const overlayKindRef = useRef<'recording' | 'transcribing'>('recording');
  if (recording) overlayKindRef.current = 'recording';
  else if (transcribing) overlayKindRef.current = 'transcribing';
  const overlayKind = overlayKindRef.current;

  useEffect(() => {
    overlayProgress.value = withTiming(overlayActive ? 1 : 0, {
      duration: motion.fade,
      reduceMotion: ReduceMotion.System,
    });
  }, [overlayActive, overlayProgress]);

  const inputFade = useAnimatedStyle(() => ({
    opacity: 1 - overlayProgress.value,
  }));
  const overlayFade = useAnimatedStyle(() => ({
    opacity: overlayProgress.value,
  }));

  const recDot = Math.max(8, s(8));

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
        <View style={styles.swap}>
          <Animated.View
            pointerEvents={overlayActive ? 'none' : 'auto'}
            style={inputFade}>
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
              }
            />
          </Animated.View>
          {overlayHeld ? (
            <Animated.View
              pointerEvents={overlayActive ? 'auto' : 'none'}
              style={[
                styles.overlay,
                { paddingHorizontal: spacing.md, gap: spacing.sm },
                overlayFade,
              ]}>
              {overlayKind === 'recording' ? (
                <>
                  <View
                    style={{
                      width: recDot,
                      height: recDot,
                      borderRadius: recDot / 2,
                      backgroundColor: theme.danger,
                    }}
                  />
                  <JournalRecordingWave
                    audioRecorder={recorder.audioRecorder}
                    testID={AgentUiIds.journal.composer.wave}
                  />
                  <IconButton
                    icon="stop"
                    color={theme.danger}
                    accessibilityLabel="Stop Recording"
                    testID={AgentUiIds.journal.composer.stop}
                    loading={busy}
                    size={controlSize}
                    onPress={session.stopRecording}
                  />
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                  <AppText
                    variant="caption"
                    color="secondary"
                    testID={AgentUiIds.journal.composer.transcribing}>
                    Transcribing…
                  </AppText>
                </>
              )}
            </Animated.View>
          ) : null}
        </View>
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
  swap: {
    width: '100%',
  },
  field: {
    width: '100%',
    minWidth: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
