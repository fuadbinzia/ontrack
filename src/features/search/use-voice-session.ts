import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { mergeDictationIntoDraft } from '@/features/journal/journal-dictate-status';
import {
  audioDataUrlFromUri,
  useJournalRecorder,
  useJournalRecorderLiveState,
} from '@/features/journal/use-journal-recorder';
import { requestJournalTranscribe } from '@/services/journal/transcribe-client';
import { MICROPHONE_PERMISSION_REQUIRED } from '@/utils/optional-expo-audio';

import { useDockSearch } from './dock-search-store';
import {
  VOICE_RELISTEN_TIMEOUT_MS,
  VOICE_SETTLE_MS,
  applyDockTranscript,
  createVoiceSessionState,
  reduceVoiceSession,
  type VoicePhase,
  type VoiceSessionState,
} from './voice-session';

type ExpoSpeechApi = typeof import('expo-speech');

const speechApi = requireOptionalNativeModule('ExpoSpeech')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-speech') as ExpoSpeechApi)
  : undefined;

const PLAYBACK_UNAVAILABLE = 'Spoken playback is unavailable on this device.';

export function useVoiceSession(options: {
  enabled: boolean;
  onUtterance: (text: string) => Promise<string>;
}) {
  const recorder = useJournalRecorder();
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const live = useJournalRecorderLiveState(recorder.audioRecorder);
  const [state, setState] = useState<VoiceSessionState>(() => createVoiceSessionState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const onUtteranceRef = useRef(options.onUtterance);
  onUtteranceRef.current = options.onUtterance;
  const relistenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transcribingRef = useRef(false);

  const dispatch = useCallback((event: Parameters<typeof reduceVoiceSession>[1]) => {
    setState((current) => reduceVoiceSession(current, event));
  }, []);

  const clearTimers = useCallback(() => {
    if (relistenTimer.current) clearTimeout(relistenTimer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    relistenTimer.current = undefined;
    settleTimer.current = undefined;
  }, []);

  const stopSpeech = useCallback(() => {
    void speechApi?.stop();
  }, []);

  const startListening = useCallback(async () => {
    clearTimers();
    stopSpeech();
    const started = await recorderRef.current.start('dictate', () => {
      dispatch({ type: 'meter', db: null, elapsedMs: 60_000 });
    });
    if (!started) {
      useDockSearch.getState().setListening(false, null);
      dispatch({
        type: 'transcript-error',
        message: recorderRef.current.statusMessage || MICROPHONE_PERMISSION_REQUIRED,
      });
      return;
    }
    useDockSearch.getState().setListening(true, Date.now());
    dispatch({ type: 'start' });
  }, [clearTimers, dispatch, stopSpeech]);

  const stopListening = useCallback(() => {
    if (stateRef.current.phase !== 'listening' && stateRef.current.phase !== 'relisten') {
      return;
    }
    useDockSearch.getState().setListening(false, null);
    dispatch({ type: 'stop' });
  }, [dispatch]);

  const cancel = useCallback(async () => {
    clearTimers();
    stopSpeech();
    useDockSearch.getState().setListening(false, null);
    await recorderRef.current.cancel();
    dispatch({ type: 'cancel' });
  }, [clearTimers, dispatch, stopSpeech]);

  const bargeIn = useCallback(() => {
    stopSpeech();
    void startListening();
    dispatch({ type: 'barge-in' });
  }, [dispatch, startListening, stopSpeech]);

  const speak = useCallback(
    (text: string) => {
      dispatch({ type: 'reply-started' });
      if (!speechApi) {
        dispatch({ type: 'reply-done' });
        return PLAYBACK_UNAVAILABLE;
      }
      speechApi.speak(text, {
        rate: 0.92,
        onDone: () => dispatch({ type: 'reply-done' }),
        onStopped: () => undefined,
        onError: () => dispatch({ type: 'reply-done' }),
      });
      return undefined;
    },
    [dispatch],
  );

  const stopGeneration = useDockSearch((dock) => dock.stopGeneration);
  const stopSeen = useRef(0);
  useEffect(() => {
    if (stopGeneration === stopSeen.current) return;
    stopSeen.current = stopGeneration;
    if (stopGeneration > 0) stopListening();
  }, [stopGeneration, stopListening]);

  useEffect(() => {
    if (state.phase === 'listening' || state.phase === 'relisten') return;
    if (useDockSearch.getState().listening) {
      useDockSearch.getState().setListening(false, null);
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'listening') return;
    dispatch({ type: 'meter', db: live.meteringDb, elapsedMs: live.elapsedMs });
  }, [dispatch, live.elapsedMs, live.meteringDb, state.phase]);

  useEffect(() => {
    if (state.phase !== 'thinking' || transcribingRef.current) return;
    if (state.autoSendText) return;
    transcribingRef.current = true;
    void (async () => {
      const captured = await recorderRef.current.finish();
      if (!captured?.uri) {
        if (stateRef.current.phase === 'thinking') {
          dispatch({ type: 'transcript-error', message: 'That recording could not be saved.' });
        }
        transcribingRef.current = false;
        return;
      }
      try {
        const audioDataUrl = await audioDataUrlFromUri(captured.uri);
        const { text } = await requestJournalTranscribe(audioDataUrl);
        const { fieldQuery } = applyDockTranscript(text);
        if (fieldQuery) {
          const dock = useDockSearch.getState();
          dock.setQuery(mergeDictationIntoDraft(dock.query, fieldQuery));
        }
        if (stateRef.current.phase === 'thinking') {
          dispatch({ type: 'transcript', text });
        }
      } catch (error) {
        if (stateRef.current.phase !== 'thinking') return;
        dispatch({
          type: 'transcript-error',
          message: error instanceof Error ? error.message : 'That recording could not be transcribed.',
        });
      } finally {
        transcribingRef.current = false;
      }
    })();
  }, [dispatch, state.autoSendText, state.phase]);

  useEffect(() => {
    const text = state.autoSendText;
    if (!text || state.phase !== 'thinking') return;
    let cancelled = false;
    void (async () => {
      try {
        const reply = await onUtteranceRef.current(text);
        if (cancelled) return;
        const playbackNote = speak(reply);
        if (playbackNote) {
          // Writes still applied; transcript shows even without TTS.
        }
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: 'transcript-error',
          message: error instanceof Error ? error.message : 'onTrack could not finish that.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, speak, state.autoSendText, state.phase]);

  useEffect(() => {
    if (state.phase !== 'relisten') {
      if (relistenTimer.current) clearTimeout(relistenTimer.current);
      return undefined;
    }
    void recorderRef.current.start('dictate', () => {
      dispatch({ type: 'meter', db: null, elapsedMs: 60_000 });
    });
    relistenTimer.current = setTimeout(() => {
      dispatch({ type: 'relisten-timeout' });
    }, VOICE_RELISTEN_TIMEOUT_MS);
    return () => {
      if (relistenTimer.current) clearTimeout(relistenTimer.current);
    };
  }, [dispatch, state.phase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        stopSpeech();
        void recorderRef.current.cancel();
        dispatch({ type: 'app-inactive' });
        if (stateRef.current.phase !== 'paused') dispatch({ type: 'interrupt' });
        return;
      }
      dispatch({ type: 'app-active', nowMs: Date.now() });
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        dispatch({ type: 'settle', nowMs: Date.now() });
      }, VOICE_SETTLE_MS);
    });
    return () => sub.remove();
  }, [dispatch, stopSpeech]);

  useEffect(() => {
    if (!options.enabled && state.phase !== 'idle') {
      void cancel();
    }
  }, [cancel, options.enabled, state.phase]);

  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'paused') {
      void recorderRef.current.cancel();
    }
  }, [state.phase]);

  useEffect(() => () => {
    clearTimers();
    stopSpeech();
    void recorderRef.current.cancel();
  }, [clearTimers, stopSpeech]);

  return {
    phase: state.phase as VoicePhase,
    audioSessionActive: state.audioSessionActive,
    lastError: state.lastError || recorder.statusMessage,
    nativeAvailable: recorder.nativeAvailable,
    audioRecorder: recorder.audioRecorder,
    startListening,
    stopListening,
    cancel,
    bargeIn,
    speak,
    activateAssistant: () => {
      stopSpeech();
      void recorderRef.current.cancel();
      dispatch({ type: 'activate-assistant' });
    },
  };
}
