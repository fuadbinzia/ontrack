/* eslint-disable import/first -- Jest mocks must initialize before the hook module. */
import { act, renderHook } from '@testing-library/react-native';

const mockPrepareToRecordAsync = jest.fn();
const mockRecord = jest.fn();
const mockStop = jest.fn(async () => undefined);
const mockSetAudioModeAsync = jest.fn(async () => undefined);
const mockRequestRecordingPermissionsAsync = jest.fn(async () => ({
  granted: true,
}));
const mockRecorder = {
  isRecording: false,
  uri: null as string | null,
  prepareToRecordAsync: (...args: unknown[]) => mockPrepareToRecordAsync(...args),
  record: (...args: unknown[]) => mockRecord(...args),
  stop: (...args: unknown[]) => mockStop(...args),
};

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (name: string) => (name === 'ExpoAudio' ? {} : null),
}));

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  requestRecordingPermissionsAsync: (...args: unknown[]) =>
    mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  useAudioRecorder: () => mockRecorder,
}));

jest.mock('expo-file-system', () => ({
  File: class {
    exists = false;
    base64 = jest.fn(async () => 'YXVkaW8=');
    delete = jest.fn();
  },
}));

import { useJournalRecorder } from '../use-journal-recorder';

describe('useJournalRecorder start', () => {
  beforeEach(() => {
    mockPrepareToRecordAsync.mockReset();
    mockRecord.mockReset();
    mockStop.mockReset();
    mockSetAudioModeAsync.mockReset();
    mockRequestRecordingPermissionsAsync.mockReset();
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockPrepareToRecordAsync.mockResolvedValue(undefined);
    mockRecorder.isRecording = false;
    mockRecorder.uri = null;
  });

  it('starts without taking exclusive audio', async () => {
    const { result } = renderHook(() => useJournalRecorder());

    expect(result.current.nativeAvailable).toBe(true);

    await act(async () => {
      await expect(result.current.start('voice')).resolves.toBe(true);
    });

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    expect(mockRecord).toHaveBeenCalledWith();
    expect(result.current.recording).toBe(true);
    expect(result.current.statusMessage).toBe('');
  });

  it('does not call a busy microphone unavailable on this device', async () => {
    mockPrepareToRecordAsync.mockRejectedValueOnce(new Error('Session is busy'));
    const { result } = renderHook(() => useJournalRecorder());

    await act(async () => {
      await expect(result.current.start('dictate')).resolves.toBe(false);
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.statusMessage).toMatch(/microphone is busy/i);
    expect(result.current.statusMessage).not.toMatch(/unavailable on this device/i);
  });
});
