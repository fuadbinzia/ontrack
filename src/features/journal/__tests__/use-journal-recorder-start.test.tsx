/* eslint-disable import/first -- Jest mocks must initialize before the hook module. */
import { act, renderHook } from '@testing-library/react-native';

const mockPrepareToRecordAsync = jest.fn();
const mockRecord = jest.fn();
const mockStop = jest.fn(async () => undefined);
const mockSetAudioModeAsync = jest.fn(async () => undefined);
const mockRequestRecordingPermissionsAsync = jest.fn(async () => ({
  granted: true,
}));
const mockGetRecordingPermissionsAsync = jest.fn(async () => ({
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
  getRecordingPermissionsAsync: (...args: unknown[]) =>
    mockGetRecordingPermissionsAsync(...args),
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

jest.mock('@/utils/prompt-open-settings', () => ({
  promptOpenAppSettings: jest.fn(),
}));

import { promptOpenAppSettings } from '@/utils/prompt-open-settings';
import { useJournalRecorder } from '../use-journal-recorder';

const promptOpenAppSettingsMock = promptOpenAppSettings as jest.MockedFunction<
  typeof promptOpenAppSettings
>;

describe('useJournalRecorder start', () => {
  beforeEach(() => {
    mockPrepareToRecordAsync.mockReset();
    mockRecord.mockReset();
    mockStop.mockReset();
    mockSetAudioModeAsync.mockReset();
    mockRequestRecordingPermissionsAsync.mockReset();
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockGetRecordingPermissionsAsync.mockReset();
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockPrepareToRecordAsync.mockResolvedValue(undefined);
    mockRecorder.isRecording = false;
    mockRecorder.uri = null;
    promptOpenAppSettingsMock.mockClear();
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

  it('auto-finishes at the 60-second cap instead of locking the recorder', async () => {
    jest.useFakeTimers();
    try {
      const onLimitReached = jest.fn();
      const { result } = renderHook(() => useJournalRecorder());

      await act(async () => {
        await expect(result.current.start('voice', onLimitReached)).resolves.toBe(true);
      });
      mockRecorder.isRecording = true;
      mockRecorder.uri = 'file:///tmp/take.m4a';

      act(() => {
        jest.advanceTimersByTime(59_000);
      });
      expect(onLimitReached).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(onLimitReached).toHaveBeenCalledTimes(1);

      // The old cap flipped an internal flag that made finish() return
      // undefined forever — the recording could never be saved.
      let captured: Awaited<ReturnType<typeof result.current.finish>>;
      await act(async () => {
        captured = await result.current.finish();
      });
      expect(captured?.uri).toBe('file:///tmp/take.m4a');
      expect(captured?.mode).toBe('voice');
      expect(mockStop).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not fire the cap callback after a manual stop', async () => {
    jest.useFakeTimers();
    try {
      const onLimitReached = jest.fn();
      const { result } = renderHook(() => useJournalRecorder());

      await act(async () => {
        await result.current.start('voice', onLimitReached);
      });
      mockRecorder.isRecording = true;
      mockRecorder.uri = 'file:///tmp/take.m4a';

      await act(async () => {
        await result.current.finish();
      });

      act(() => {
        jest.advanceTimersByTime(120_000);
      });
      expect(onLimitReached).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not arm the mic when the screen unmounts during permission checks', async () => {
    let resolvePermission!: (value: { granted: boolean }) => void;
    mockGetRecordingPermissionsAsync.mockImplementationOnce(
      () =>
        new Promise<{ granted: boolean }>((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useJournalRecorder());

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = result.current.start('voice');
    });
    unmount();
    resolvePermission({ granted: true });

    await expect(startPromise).resolves.toBe(false);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('stops an orphan take when unmount lands while the recorder is arming', async () => {
    let resolvePrepare!: () => void;
    mockPrepareToRecordAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePrepare = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useJournalRecorder());

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = result.current.start('voice');
    });
    // Let the cached-permission check settle so start reaches the recorder.
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    mockRecorder.isRecording = true;
    resolvePrepare();

    await expect(startPromise).resolves.toBe(false);
    expect(mockStop).toHaveBeenCalled();
    expect(mockSetAudioModeAsync).toHaveBeenLastCalledWith({
      allowsRecording: false,
    });
  });

  it('offers Open Settings when the OS will not ask for the microphone again', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    const { result } = renderHook(() => useJournalRecorder());

    await act(async () => {
      await expect(result.current.start('voice')).resolves.toBe(false);
    });

    expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(promptOpenAppSettingsMock).toHaveBeenCalledWith(
      'Microphone access needed',
      'Allow microphone access in Settings to use voice. Typing still works.',
    );
    expect(result.current.statusMessage).toMatch(/permission is required for voice/i);
  });

  it('re-checks a denied microphone permission on the next attempt', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false });
    mockRequestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const { result } = renderHook(() => useJournalRecorder());

    await act(async () => {
      await expect(result.current.start('voice')).resolves.toBe(false);
    });
    expect(result.current.statusMessage).toMatch(/permission/i);

    // The user grants microphone access in Settings and comes back — the old
    // cached denial refused to record until the app relaunched.
    mockGetRecordingPermissionsAsync.mockResolvedValueOnce({ granted: true });
    await act(async () => {
      await expect(result.current.start('voice')).resolves.toBe(true);
    });
    expect(result.current.recording).toBe(true);
    expect(mockRecord).toHaveBeenCalled();
  });

  it('does not re-prompt once a grant is cached', async () => {
    const { result } = renderHook(() => useJournalRecorder());

    await act(async () => {
      await result.current.start('voice');
    });
    await act(async () => {
      await result.current.cancel();
    });
    await act(async () => {
      await expect(result.current.start('voice')).resolves.toBe(true);
    });

    expect(mockGetRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();
  });
});
