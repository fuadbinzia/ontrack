import { requireOptionalNativeModule } from 'expo-modules-core';

import type { RecordingOptions } from 'expo-audio';

export const MICROPHONE_PERMISSION_REQUIRED =
  'Microphone permission is required for voice. Typing still works.';

export type ExpoAudioApi = typeof import('expo-audio');

type NativeLookup = () => unknown;
type ExpoAudioJsLoader = () => ExpoAudioApi;

/** Safe options if a caller still hits `useAudioRecorder` without a preset. */
export const FALLBACK_RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: 'aac ',
    audioQuality: 0x60,
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 64000,
  },
} as RecordingOptions;

type ExpoRecorder = {
  isRecording?: boolean;
  prepareToRecordAsync: () => Promise<unknown>;
  record: (options?: { forDuration?: number }) => unknown;
  stop?: () => Promise<unknown>;
};

/** Exclusive `doNotMix` fails when a call, Music, or another session owns audio. */
export async function beginExpoRecording(
  api: Pick<ExpoAudioApi, 'setAudioModeAsync'>,
  recorder: ExpoRecorder,
): Promise<void> {
  if (recorder.isRecording) await recorder.stop?.();
  await api.setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  });
  await recorder.prepareToRecordAsync();
  recorder.record();
}

export function voiceStartErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (/denied|permission|not authorized/i.test(text)) {
    return MICROPHONE_PERMISSION_REQUIRED;
  }
  if (/busy|in use|session|interrupt|cannot start|16877|561017449/i.test(text)) {
    return 'Microphone is busy. Try again in a moment.';
  }
  return 'Voice could not start. Try again or type.';
}

export function isUsableExpoAudio(
  api: Partial<ExpoAudioApi> | undefined,
): api is ExpoAudioApi {
  return Boolean(
    api &&
      typeof api.useAudioRecorder === 'function' &&
      typeof api.getRecordingPermissionsAsync === 'function' &&
      typeof api.requestRecordingPermissionsAsync === 'function' &&
      typeof api.setAudioModeAsync === 'function',
  );
}

export function recordingOptionsFor(
  api: ExpoAudioApi | undefined,
): RecordingOptions {
  const preset = api?.RecordingPresets?.HIGH_QUALITY;
  const base =
    typeof preset?.extension === 'string' ? preset : FALLBACK_RECORDING_OPTIONS;
  // Metering feeds the live recording wave; presets ship without it.
  return { ...base, isMeteringEnabled: true };
}

/**
 * Load expo-audio only when the binary has ExpoAudio, and never let a broken
 * JS/native mismatch crash the screen (`options.extension` of undefined).
 */
export function loadOptionalExpoAudio(
  hasNative: NativeLookup = () => requireOptionalNativeModule('ExpoAudio'),
  loadJs: ExpoAudioJsLoader = () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-audio') as ExpoAudioApi,
): ExpoAudioApi | undefined {
  try {
    if (!hasNative()) return undefined;
    const api = loadJs();
    return isUsableExpoAudio(api) ? api : undefined;
  } catch {
    return undefined;
  }
}
