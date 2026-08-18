import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MICROPHONE_PERMISSION_REQUIRED,
  MICROPHONE_SETTINGS_MESSAGE,
  MICROPHONE_SETTINGS_TITLE,
  ensureRecordingPermission,
  promptMicrophoneSettings,
} from '@/utils/microphone-permission';
import { promptOpenAppSettings } from '@/utils/prompt-open-settings';

jest.mock('@/utils/prompt-open-settings', () => ({
  promptOpenAppSettings: jest.fn(),
}));

const promptOpenAppSettingsMock = promptOpenAppSettings as jest.MockedFunction<
  typeof promptOpenAppSettings
>;

function permissionApi(options: {
  get?: { granted: boolean; canAskAgain?: boolean };
  request?: { granted: boolean; canAskAgain?: boolean };
}) {
  return {
    getRecordingPermissionsAsync: jest.fn(async () => options.get ?? { granted: true }),
    requestRecordingPermissionsAsync: jest.fn(
      async () => options.request ?? { granted: true },
    ),
  };
}

describe('ensureRecordingPermission', () => {
  beforeEach(() => {
    promptOpenAppSettingsMock.mockClear();
  });

  it('returns true without prompting when the microphone is already granted', async () => {
    const api = permissionApi({ get: { granted: true } });

    await expect(ensureRecordingPermission(api)).resolves.toBe(true);

    expect(api.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).not.toHaveBeenCalled();
  });

  it('asks the OS when it can still prompt and starts after a grant', async () => {
    const api = permissionApi({
      get: { granted: false, canAskAgain: true },
      request: { granted: true },
    });

    await expect(ensureRecordingPermission(api)).resolves.toBe(true);

    expect(api.requestRecordingPermissionsAsync).toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).not.toHaveBeenCalled();
  });

  it('offers Open Settings after the OS prompt is denied', async () => {
    const api = permissionApi({
      get: { granted: false, canAskAgain: true },
      request: { granted: false, canAskAgain: false },
    });

    await expect(ensureRecordingPermission(api)).resolves.toBe(false);

    expect(api.requestRecordingPermissionsAsync).toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).toHaveBeenCalledWith(
      MICROPHONE_SETTINGS_TITLE,
      MICROPHONE_SETTINGS_MESSAGE,
    );
  });

  it('requests the OS prompt when canAskAgain is omitted', async () => {
    const api = permissionApi({
      get: { granted: false },
      request: { granted: false },
    });

    await expect(ensureRecordingPermission(api)).resolves.toBe(false);

    expect(api.requestRecordingPermissionsAsync).toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).toHaveBeenCalledWith(
      MICROPHONE_SETTINGS_TITLE,
      MICROPHONE_SETTINGS_MESSAGE,
    );
  });

  it('skips a no-op OS request and offers Open Settings when the system will not ask again', async () => {
    const api = permissionApi({
      get: { granted: false, canAskAgain: false },
    });

    await expect(ensureRecordingPermission(api)).resolves.toBe(false);

    expect(api.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).toHaveBeenCalledWith(
      MICROPHONE_SETTINGS_TITLE,
      MICROPHONE_SETTINGS_MESSAGE,
    );
  });

  it('uses the camera-style Settings prompt copy', async () => {
    await promptMicrophoneSettings();
    expect(promptOpenAppSettingsMock).toHaveBeenCalledWith(
      'Microphone access needed',
      'Allow microphone access in Settings to use voice. Typing still works.',
    );
    expect(MICROPHONE_PERMISSION_REQUIRED).toMatch(/typing still works/i);
  });

  it('is the permission path for dock search, journal, and travel voice', () => {
    const root = process.cwd();
    const read = (relative: string) => readFileSync(join(root, relative), 'utf8');
    const helper = read('src/utils/microphone-permission.ts');
    expect(read('src/features/journal/use-journal-recorder.ts')).toContain(
      'ensureRecordingPermission',
    );
    expect(read('src/features/search/use-voice-session.ts')).toContain(
      'useJournalRecorder',
    );
    expect(read('src/features/travel/translator/use-travel-translator.ts')).toContain(
      'ensureRecordingPermission',
    );
    expect(helper).toContain("await import('@/utils/prompt-open-settings')");
    expect(helper).not.toMatch(/^import .*prompt-open-settings/m);
  });
});
