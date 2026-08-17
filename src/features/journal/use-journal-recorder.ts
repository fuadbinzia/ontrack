import { File as ExpoFile } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  beginExpoRecording,
  loadOptionalExpoAudio,
  recordingOptionsFor,
  voiceStartErrorMessage,
  type ExpoAudioApi,
} from '@/utils/optional-expo-audio';

const MAX_RECORDING_SECONDS = 60;

type AudioRecorderHook = ExpoAudioApi['useAudioRecorder'];

const audioApi = loadOptionalExpoAudio();

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

export async function audioDataUrlFromUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return dataUrlFromBlob(await response.blob());
  }
  const base64 = await new ExpoFile(uri).base64();
  return `data:${recordedAudioMimeType(uri)};base64,${base64}`;
}

export function deleteRecordedAudio(uri: string | null | undefined) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new ExpoFile(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best-effort.
  }
}

export type JournalRecorderMode = 'dictate' | 'voice';

export function useJournalRecorder() {
  const recorder = useCompatibleAudioRecorder(recordingOptionsFor(audioApi));
  const [mode, setMode] = useState<JournalRecorderMode | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const modeRef = useRef<JournalRecorderMode | null>(null);
  const finishingRef = useRef(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const limitRef = useRef<(() => void) | null>(null);
  const permissionRef = useRef<boolean | undefined>(undefined);
  const mountedRef = useRef(true);

  const nativeAvailable = Boolean(audioApi);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    limitRef.current = null;
  };

  const stopSession = useCallback(async () => {
    clearTimer();
    modeRef.current = null;
    if (mountedRef.current) setMode(null);
    let uri: string | null = null;
    const startedAt = startedAtRef.current;
    try {
      if (recorder.isRecording) await recorder.stop();
      uri = recorder.uri;
      await audioApi?.setAudioModeAsync({ allowsRecording: false });
    } catch {
      // Recorder may already have stopped.
    }
    return {
      uri,
      durationMs: startedAt ? Date.now() - startedAt : 0,
    };
  }, [recorder]);

  const cancel = useCallback(async () => {
    const { uri } = await stopSession();
    deleteRecordedAudio(uri);
    if (mountedRef.current) setStatusMessage('');
  }, [stopSession]);

  const start = useCallback(
    async (nextMode: JournalRecorderMode, onLimitReached?: () => void) => {
      if (modeRef.current) {
        await cancel();
        return false;
      }
      setStatusMessage('');
      try {
        if (!audioApi) {
          setStatusMessage('Voice capture requires the latest app build. Typing still works.');
          return false;
        }
        // Cache only grants: a denial must be re-checked so granting in
        // Settings works without relaunching the app.
        if (permissionRef.current !== true) {
          const current = await audioApi.getRecordingPermissionsAsync();
          permissionRef.current = current.granted
            ? true
            : (await audioApi.requestRecordingPermissionsAsync()).granted;
        }
        if (!permissionRef.current) {
          setStatusMessage('Microphone permission is required for voice. Typing still works.');
          return false;
        }
        await beginExpoRecording(audioApi, recorder);
        modeRef.current = nextMode;
        startedAtRef.current = Date.now();
        setMode(nextMode);
        limitRef.current = onLimitReached ?? null;
        timerRef.current = setTimeout(() => {
          timerRef.current = undefined;
          limitRef.current?.();
        }, MAX_RECORDING_SECONDS * 1_000);
        return true;
      } catch (error) {
        modeRef.current = null;
        setMode(null);
        try {
          if (recorder.isRecording) await recorder.stop();
          await audioApi?.setAudioModeAsync({ allowsRecording: false });
        } catch {
          // Reset is best-effort so the next tap can try again.
        }
        setStatusMessage(voiceStartErrorMessage(error));
        return false;
      }
    },
    [cancel, recorder],
  );

  const finish = useCallback(async () => {
    if (!modeRef.current || finishingRef.current) return undefined;
    finishingRef.current = true;
    const nextMode = modeRef.current;
    try {
      const captured = await stopSession();
      if (!captured.uri) throw new Error('No recording was captured.');
      return { ...captured, mode: nextMode, uri: captured.uri };
    } catch {
      if (mountedRef.current) {
        setStatusMessage('That recording could not be saved.');
      }
      return undefined;
    } finally {
      finishingRef.current = false;
    }
  }, [stopSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void cancel();
    };
  }, [cancel]);

  return {
    mode,
    recording: mode != null,
    nativeAvailable,
    statusMessage,
    start,
    finish,
    cancel,
    setStatusMessage,
  };
}
