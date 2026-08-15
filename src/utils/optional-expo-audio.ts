import { requireOptionalNativeModule } from 'expo-modules-core';

import type { RecordingOptions } from 'expo-audio';

export type ExpoAudioApi = typeof import('expo-audio');

type NativeLookup = () => unknown;
type ExpoAudioJsLoader = () => ExpoAudioApi;

/** Safe options if a caller still hits `useAudioRecorder` without a preset. */
export const FALLBACK_RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
} as RecordingOptions;

export function isUsableExpoAudio(
  api: Partial<ExpoAudioApi> | undefined,
): api is ExpoAudioApi {
  return Boolean(
    api &&
      typeof api.useAudioRecorder === 'function' &&
      typeof api.requestRecordingPermissionsAsync === 'function' &&
      typeof api.setAudioModeAsync === 'function',
  );
}

export function recordingOptionsFor(
  api: ExpoAudioApi | undefined,
): RecordingOptions {
  const preset = api?.RecordingPresets?.HIGH_QUALITY;
  return typeof preset?.extension === 'string' ? preset : FALLBACK_RECORDING_OPTIONS;
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
