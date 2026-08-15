import * as Clipboard from 'expo-clipboard';
import { File as ExpoFile } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Voice as SpeechVoice } from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { TravelPlan } from '@/features/travel/types';
import {
  commonTravelTranslatorLanguages,
  languageFromLocale,
  languagesForDirection,
  mergeTravelTranslatorLanguages,
  reverseTravelTranslatorDirection,
} from '@/features/travel/translator/travel-translator-language';
import type {
  TravelTranslatorDirection,
  TravelTranslatorLanguage,
  TravelTranslatorTurn,
} from '@/features/travel/translator/travel-translator-types';
import {
  requestTravelTranslatorLanguages,
  requestTravelTranslatorTurn,
  TravelTranslatorError,
} from '@/services/travel/translator-client';
import { newId } from '@/utils/id';
import {
  beginExpoRecording,
  loadOptionalExpoAudio,
  recordingOptionsFor,
  voiceStartErrorMessage,
  type ExpoAudioApi,
} from '@/utils/optional-expo-audio';

const MAX_TURNS = 50;
const MAX_RECORDING_SECONDS = 30;

type ExpoSpeechApi = typeof import('expo-speech');
type AudioRecorderHook = ExpoAudioApi['useAudioRecorder'];

// Keep Travel usable on OTA-updated binaries that predate the native voice modules.
const audioApi = loadOptionalExpoAudio();
const speechApi = requireOptionalNativeModule('ExpoSpeech')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-speech') as ExpoSpeechApi)
  : undefined;

const unavailableRecorder = {
  isRecording: false,
  uri: null,
  prepareToRecordAsync: async () => undefined,
  record: () => undefined,
  stop: async () => undefined,
} as unknown as ReturnType<AudioRecorderHook>;

function useUnavailableAudioRecorder(
  ..._args: Parameters<AudioRecorderHook>
): ReturnType<AudioRecorderHook> {
  return unavailableRecorder;
}

const useCompatibleAudioRecorder =
  audioApi?.useAudioRecorder ?? useUnavailableAudioRecorder;

function recordedAudioMimeType(uri: string): string {
  if (uri.toLowerCase().includes('.webm')) return 'audio/webm';
  if (uri.toLowerCase().includes('.3gp')) return 'audio/3gpp';
  return 'audio/m4a';
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The recording could not be read.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The recording could not be read.'));
    reader.readAsDataURL(blob);
  });
}

async function audioDataUrlFromUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return dataUrlFromBlob(await response.blob());
  }
  const base64 = await new ExpoFile(uri).base64();
  return `data:${recordedAudioMimeType(uri)};base64,${base64}`;
}

function deleteRecordedAudio(uri: string | null | undefined) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new ExpoFile(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best-effort and must not hide a completed translation.
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof TravelTranslatorError) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return '';
  return 'Translation is temporarily unavailable.';
}

function voiceForLanguage(
  voices: readonly SpeechVoice[],
  language: TravelTranslatorLanguage,
): SpeechVoice | undefined {
  const locale = language.speechLocale.toLowerCase();
  const primary = locale.split('-')[0];
  return (
    voices.find((voice) => voice.language.toLowerCase() === locale) ??
    voices.find((voice) => voice.language.toLowerCase().split('-')[0] === primary)
  );
}

export function useTravelTranslator({
  plan,
  visible,
  aiEnabled,
  homeLocale,
}: {
  plan: TravelPlan;
  visible: boolean;
  aiEnabled: boolean;
  homeLocale: string;
}) {
  const homeFallback = useMemo(() => languageFromLocale(homeLocale), [homeLocale]);
  const recorder = useCompatibleAudioRecorder(recordingOptionsFor(audioApi));
  const [homeLanguage, setHomeLanguage] =
    useState<TravelTranslatorLanguage>(homeFallback);
  const [destinationLanguage, setDestinationLanguage] =
    useState<TravelTranslatorLanguage>(homeFallback);
  const [alternatives, setAlternatives] = useState<TravelTranslatorLanguage[]>([]);
  const [languageLoading, setLanguageLoading] = useState(false);
  const [languageMessage, setLanguageMessage] = useState('');
  const [typedText, setTypedText] = useState('');
  const [typedDirection, setTypedDirection] =
    useState<TravelTranslatorDirection>('home-to-destination');
  const [turns, setTurns] = useState<TravelTranslatorTurn[]>([]);
  const [activeVoice, setActiveVoice] =
    useState<TravelTranslatorDirection | null>(null);
  const [translating, setTranslating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [voices, setVoices] = useState<SpeechVoice[]>([]);
  const languageAbortRef = useRef<AbortController | undefined>(undefined);
  const turnAbortRef = useRef<AbortController | undefined>(undefined);
  const activeVoiceRef = useRef<TravelTranslatorDirection | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const finishingRecordingRef = useRef(false);
  const microphonePermissionRef = useRef<boolean | undefined>(undefined);
  const mountedRef = useRef(true);
  const voicesRef = useRef<SpeechVoice[]>([]);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    setHomeLanguage(homeFallback);
    setDestinationLanguage(homeFallback);
  }, [homeFallback]);

  const languageOptions = useMemo(
    () =>
      mergeTravelTranslatorLanguages(
        [homeLanguage, destinationLanguage],
        alternatives,
        commonTravelTranslatorLanguages(),
      ),
    [alternatives, destinationLanguage, homeLanguage],
  );

  const stopPlayback = useCallback(() => {
    void speechApi?.stop();
  }, []);

  const playTranslation = useCallback(
    async (text: string, language: TravelTranslatorLanguage) => {
      if (!speechApi) {
        setStatusMessage(
          'Spoken playback requires the latest app build. You can still copy the translation.',
        );
        return;
      }
      await speechApi.stop();
      const voice = voiceForLanguage(voicesRef.current, language);
      if (!voice) {
        setStatusMessage(
          `No ${language.displayName} voice is installed. You can still copy the translation.`,
        );
        return;
      }
      setStatusMessage('');
      speechApi.speak(text, {
        language: language.speechLocale,
        voice: voice.identifier,
        rate: 0.92,
        onError: () =>
          setStatusMessage('Spoken playback is unavailable on this device.'),
      });
    },
    [],
  );

  const runTurn = useCallback(
    async (
      direction: TravelTranslatorDirection,
      input: { text?: string; audioDataUrl?: string },
    ) => {
      if (translating) return;
      stopPlayback();
      const { source, target } = languagesForDirection(
        direction,
        homeLanguage,
        destinationLanguage,
      );
      const id = newId('translation');
      const optimistic: TravelTranslatorTurn = {
        id,
        direction,
        sourceText: input.text?.trim() ?? '',
        translatedText: '',
        status: 'translating',
      };
      setTurns((current) => [...current, optimistic].slice(-MAX_TURNS));
      setTranslating(true);
      setStatusMessage('');
      turnAbortRef.current?.abort();
      const controller = new AbortController();
      turnAbortRef.current = controller;
      try {
        const response = await requestTravelTranslatorTurn(
          {
            destination: plan.destination,
            sourceLanguage: source,
            targetLanguage: target,
            ...input,
          },
          controller.signal,
        );
        if (!mountedRef.current || controller.signal.aborted) return;
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  sourceText: response.transcript,
                  translatedText: response.translatedText,
                  transliteration: response.transliteration,
                  status: 'translated',
                }
              : turn,
          ),
        );
        await playTranslation(response.translatedText, target);
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) return;
        const message = errorMessage(error);
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id
              ? { ...turn, status: 'failed', errorMessage: message }
              : turn,
          ),
        );
        setStatusMessage(message);
      } finally {
        if (mountedRef.current && turnAbortRef.current === controller) {
          setTranslating(false);
        }
      }
    },
    [destinationLanguage, homeLanguage, plan.destination, playTranslation, stopPlayback, translating],
  );

  const finishVoice = useCallback(async () => {
    const direction = activeVoiceRef.current;
    if (!direction || finishingRecordingRef.current) return;
    finishingRecordingRef.current = true;
    activeVoiceRef.current = null;
    setActiveVoice(null);
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = undefined;
    let uri: string | null = null;
    try {
      if (recorder.isRecording) await recorder.stop();
      uri = recorder.uri;
      if (!audioApi) throw new Error('Voice translation requires the latest app build.');
      await audioApi.setAudioModeAsync({ allowsRecording: false });
      if (!uri) throw new Error('No recording was captured.');
      const audioDataUrl = await audioDataUrlFromUri(uri);
      deleteRecordedAudio(uri);
      uri = null;
      await runTurn(direction, { audioDataUrl });
    } catch (error) {
      const message = errorMessage(error) || 'That recording could not be translated.';
      if (mountedRef.current) setStatusMessage(message);
    } finally {
      deleteRecordedAudio(uri);
      finishingRecordingRef.current = false;
    }
  }, [recorder, runTurn]);

  const cancelActiveWork = useCallback(async () => {
    languageAbortRef.current?.abort();
    turnAbortRef.current?.abort();
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = undefined;
    activeVoiceRef.current = null;
    if (mountedRef.current) setActiveVoice(null);
    stopPlayback();

    let recordedUri: string | null = null;
    if (mountedRef.current) {
      try {
        if (recorder.isRecording) await recorder.stop();
        // expo-audio releases the shared recorder before this hook's unmount
        // cleanup. Re-check the lifecycle after awaiting stop so we never read
        // a released native object's properties.
        if (mountedRef.current) recordedUri = recorder.uri;
      } catch {
        // Recorder may already have stopped or been released while stopping.
      }
    }
    deleteRecordedAudio(recordedUri);
    try {
      await audioApi?.setAudioModeAsync({ allowsRecording: false });
    } catch {
      // The audio session may already be inactive.
    }
    if (mountedRef.current) setTranslating(false);
  }, [recorder, stopPlayback]);

  const startVoice = useCallback(
    async (direction: TravelTranslatorDirection) => {
      if (activeVoiceRef.current) {
        await finishVoice();
        return;
      }
      if (translating) return;
      setStatusMessage('');
      stopPlayback();
      try {
        if (!audioApi) {
          setStatusMessage(
            'Voice translation requires the latest app build. Typed translation still works.',
          );
          return;
        }
        if (microphonePermissionRef.current === undefined) {
          const permission = await audioApi.requestRecordingPermissionsAsync();
          microphonePermissionRef.current = permission.granted;
        }
        if (!microphonePermissionRef.current) {
          setStatusMessage(
            'Microphone permission is required for voice turns. Typed translation still works.',
          );
          return;
        }
        await beginExpoRecording(audioApi, recorder);
        activeVoiceRef.current = direction;
        setActiveVoice(direction);
        recordingTimerRef.current = setTimeout(() => {
          void finishVoice();
        }, MAX_RECORDING_SECONDS * 1_000);
      } catch (error) {
        activeVoiceRef.current = null;
        setActiveVoice(null);
        setStatusMessage(voiceStartErrorMessage(error));
      }
    },
    [finishVoice, recorder, stopPlayback, translating],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void cancelActiveWork();
    };
  }, [cancelActiveWork]);

  useEffect(() => {
    if (!visible) {
      void cancelActiveWork();
      return;
    }
    if (!aiEnabled) return;
    if (!speechApi) {
      setVoices([]);
    } else void speechApi.getAvailableVoicesAsync()
      .then((available) => {
        if (mountedRef.current) setVoices(available);
      })
      .catch(() => {
        if (mountedRef.current) setVoices([]);
      });

    languageAbortRef.current?.abort();
    const controller = new AbortController();
    languageAbortRef.current = controller;
    setLanguageLoading(true);
    setLanguageMessage('');
    void requestTravelTranslatorLanguages(
      { destination: plan.destination, homeLocale },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setHomeLanguage(response.home);
        setDestinationLanguage(response.destination);
        setAlternatives(response.alternatives);
      })
      .catch((error) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setLanguageMessage(
          `${errorMessage(error)} Choose the destination language manually.`,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && mountedRef.current) {
          setLanguageLoading(false);
        }
      });
    return () => controller.abort();
  }, [aiEnabled, cancelActiveWork, homeLocale, plan.destination, visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void cancelActiveWork();
    });
    return () => subscription.remove();
  }, [cancelActiveWork, visible]);

  const swapLanguages = useCallback(() => {
    void cancelActiveWork();
    setHomeLanguage(destinationLanguage);
    setDestinationLanguage(homeLanguage);
    setTypedDirection((current) => reverseTravelTranslatorDirection(current));
  }, [cancelActiveWork, destinationLanguage, homeLanguage]);

  const translateTyped = useCallback(
    (text = typedText, direction = typedDirection) => {
      const clean = text.trim();
      if (!clean || translating) return;
      setTypedText('');
      void runTurn(direction, { text: clean });
    },
    [runTurn, translating, typedDirection, typedText],
  );

  const retryTurn = useCallback(
    (turn: TravelTranslatorTurn) => {
      if (!turn.sourceText || translating) return;
      void runTurn(turn.direction, { text: turn.sourceText });
    },
    [runTurn, translating],
  );

  const copyTurn = useCallback(async (turn: TravelTranslatorTurn) => {
    if (!turn.translatedText) return;
    await Clipboard.setStringAsync(turn.translatedText);
    setStatusMessage('Translation copied.');
  }, []);

  const replayTurn = useCallback(
    (turn: TravelTranslatorTurn) => {
      if (!turn.translatedText) return;
      const { target } = languagesForDirection(
        turn.direction,
        homeLanguage,
        destinationLanguage,
      );
      void playTranslation(turn.translatedText, target);
    },
    [destinationLanguage, homeLanguage, playTranslation],
  );

  return {
    activeVoice,
    cancelActiveWork,
    copyTurn,
    destinationLanguage,
    homeLanguage,
    languageLoading,
    languageMessage,
    languageOptions,
    nativeVoiceAvailable: Boolean(audioApi && speechApi),
    playTranslation,
    replayTurn,
    retryTurn,
    setDestinationLanguage,
    setHomeLanguage,
    setTypedDirection,
    setTypedText,
    startVoice,
    statusMessage,
    swapLanguages,
    translateTyped,
    translating,
    turns,
    typedDirection,
    typedText,
  };
}

export type TravelTranslatorState = ReturnType<typeof useTravelTranslator>;
