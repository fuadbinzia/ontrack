import { File as ExpoFile } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ensureRecordingPermission } from '@/utils/microphone-permission';
import {
  MICROPHONE_PERMISSION_REQUIRED,
  beginExpoRecording,
  loadOptionalExpoAudio,
  recordingOptionsFor,
  voiceStartErrorMessage,
  type ExpoAudioApi,
} from '@/utils/optional-expo-audio';

const MAX_RECORDING_SECONDS = 60;

/** Poll fast enough that the recording wave feels live. */
const RECORDER_STATE_INTERVAL_MS = 100;

type AudioRecorderHook = ExpoAudioApi['useAudioRecorder'];
type AudioRecorderStateHook = ExpoAudioApi['useAudioRecorderState'];

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

const unavailableRecorderState = {
  canRecord: false,
  isRecording: false,
  durationMillis: 0,
  mediaServicesDidReset: false,
  url: null,
} as ReturnType<AudioRecorderStateHook>;

function useUnavailableAudioRecorderState(
  ..._args: Parameters<AudioRecorderStateHook>
): ReturnType<AudioRecorderStateHook> {
  return unavailableRecorderState;
}

const useCompatibleAudioRecorder =
  audioApi?.useAudioRecorder ?? useUnavailableAudioRecorder;

const useCompatibleAudioRecorderState =
  audioApi?.useAudioRecorderState ?? useUnavailableAudioRecorderState;

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

export type JournalAudioRecorder = ReturnType<AudioRecorderHook>;

/**
 * Live take state (metering + elapsed) at wave cadence. Call from the leaf
 * that renders the wave so 10Hz polling never re-renders the whole page.
 */
export function useJournalRecorderLiveState(audioRecorder: JournalAudioRecorder) {
  const state = useCompatibleAudioRecorderState(
    audioRecorder,
    RECORDER_STATE_INTERVAL_MS,
  );
  return {
    meteringDb: state.metering ?? null,
    elapsedMs: state.durationMillis,
  };
}

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
          permissionRef.current = await ensureRecordingPermission(audioApi);
        }
        if (!permissionRef.current) {
          setStatusMessage(MICROPHONE_PERMISSION_REQUIRED);
          return false;
        }
        // The screen can unmount while permissions were awaited — its cleanup
        // cancel() saw no active mode, so arming now would leak the mic.
        if (!mountedRef.current) return false;
        await beginExpoRecording(audioApi, recorder);
        if (!mountedRef.current) {
          try {
            if (recorder.isRecording) await recorder.stop();
            await audioApi.setAudioModeAsync({ allowsRecording: false });
          } catch {
            // Best-effort teardown of an orphan take.
          }
          deleteRecordedAudio(recorder.uri);
          return false;
        }
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
    /** Raw expo recorder handle for leaf components that watch live state. */
    audioRecorder: recorder,
    start,
    finish,
    cancel,
    setStatusMessage,
  };
}
