/* eslint-disable import/first -- Jest mocks must initialize before the hook module. */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/utils/optional-expo-audio', () => ({
  loadOptionalExpoAudio: () => undefined,
  recordingOptionsFor: () => ({ extension: '.m4a' }),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    exists = false;
    base64 = jest.fn(async () => 'YXVkaW8=');
    delete = jest.fn();
  },
}));

import { useJournalRecorder } from '../use-journal-recorder';

describe('useJournalRecorder', () => {
  it('keeps typing available when voice native audio cannot load', async () => {
    const { result } = renderHook(() => useJournalRecorder());

    expect(result.current.nativeAvailable).toBe(false);
    expect(result.current.recording).toBe(false);

    await act(async () => {
      await expect(result.current.start('dictate')).resolves.toBe(false);
    });
    expect(result.current.statusMessage).toMatch(/typing still works/i);
    expect(result.current.statusMessage).not.toMatch(/unavailable on this device/i);
  });
});
