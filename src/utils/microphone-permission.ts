export { MICROPHONE_PERMISSION_REQUIRED } from '@/utils/optional-expo-audio';

export const MICROPHONE_SETTINGS_TITLE = 'Microphone access needed';
export const MICROPHONE_SETTINGS_MESSAGE =
  'Allow microphone access in Settings to use voice. Typing still works.';

export type RecordingPermissionStatus = {
  granted: boolean;
  canAskAgain?: boolean;
};

export type RecordingPermissionApi = {
  getRecordingPermissionsAsync: () => Promise<RecordingPermissionStatus>;
  requestRecordingPermissionsAsync: () => Promise<RecordingPermissionStatus>;
};

export async function promptMicrophoneSettings() {
  // Dynamic so Travel can load on binaries that lack ExpoLinking / primitives.
  const { promptOpenAppSettings } = await import('@/utils/prompt-open-settings');
  promptOpenAppSettings(MICROPHONE_SETTINGS_TITLE, MICROPHONE_SETTINGS_MESSAGE);
}

/**
 * Request the OS microphone prompt when the system can still ask.
 * When the OS will not ask again, offer the same Open Settings path as camera
 * and photo library so a mic tap can reach iOS/Android app permission settings.
 */
export async function ensureRecordingPermission(
  api: RecordingPermissionApi,
): Promise<boolean> {
  const current = await api.getRecordingPermissionsAsync();
  if (current.granted) return true;
  const requested =
    current.canAskAgain === false
      ? current
      : await api.requestRecordingPermissionsAsync();
  if (requested.granted) return true;
  await promptMicrophoneSettings();
  return false;
}
