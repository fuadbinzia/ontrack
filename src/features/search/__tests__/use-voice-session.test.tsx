/* eslint-disable import/first -- Jest mocks must initialize before the hook module. */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockStart = jest.fn(async (..._args: unknown[]) => true);
const mockFinish = jest.fn(async () => ({
  uri: 'file:///tmp/dock-take.m4a',
  durationMs: 900,
  mode: 'dictate' as const,
}));
const mockCancel = jest.fn(async () => undefined);

let mockLiveState = { meteringDb: null as number | null, elapsedMs: 0 };

jest.mock('@/features/journal/use-journal-recorder', () => ({
  useJournalRecorder: () => ({
    mode: 'dictate' as const,
    recording: true,
    nativeAvailable: true,
    statusMessage: '',
    audioRecorder: {},
    start: (...args: unknown[]) => mockStart(...args),
    finish: () => mockFinish(),
    cancel: (...args: unknown[]) => mockCancel(...args),
    setStatusMessage: jest.fn(),
  }),
  useJournalRecorderLiveState: () => mockLiveState,
  audioDataUrlFromUri: jest.fn(async () => 'data:audio/m4a;base64,QQ=='),
}));

const mockRequestJournalTranscribe = jest.fn(async () => ({ text: 'open plants' }));
jest.mock('@/services/journal/transcribe-client', () => ({
  requestJournalTranscribe: (...args: unknown[]) =>
    mockRequestJournalTranscribe(...args),
}));

import { useDockSearch } from '../dock-search-store';
import { useVoiceSession } from '../use-voice-session';

async function startListening(
  result: { current: ReturnType<typeof useVoiceSession> },
) {
  await act(async () => {
    await result.current.startListening();
  });
  expect(result.current.phase).toBe('listening');
}

describe('useVoiceSession dock recording', () => {
  beforeEach(() => {
    useDockSearch.getState().resetForTests();
    mockLiveState = { meteringDb: null, elapsedMs: 0 };
    mockStart.mockReset();
    mockStart.mockResolvedValue(true);
    mockFinish.mockReset();
    mockFinish.mockResolvedValue({
      uri: 'file:///tmp/dock-take.m4a',
      durationMs: 900,
      mode: 'dictate',
    });
    mockCancel.mockReset();
    mockCancel.mockResolvedValue(undefined);
    mockRequestJournalTranscribe.mockReset();
    mockRequestJournalTranscribe.mockResolvedValue({ text: 'open plants' });
  });

  it('keeps the take through metering rerenders and transcribes it on Stop', async () => {
    const { result, rerender } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    await startListening(result);
    mockCancel.mockClear();

    mockLiveState = { meteringDb: -18, elapsedMs: 180 };
    rerender();
    mockLiveState = { meteringDb: -22, elapsedMs: 360 };
    rerender();
    mockLiveState = { meteringDb: -80, elapsedMs: 540 };
    rerender();

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();

    await act(async () => {
      result.current.stopListening();
    });

    await waitFor(() => {
      expect(mockFinish).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });
    expect(result.current.lastError).toBeFalsy();
    expect(useDockSearch.getState().query).toBe('open plants');
    expect(mockRequestJournalTranscribe).toHaveBeenCalled();
  });

  it('transcribes when the dock Stop control bumps stopGeneration', async () => {
    const { result } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    await startListening(result);
    mockCancel.mockClear();

    await act(async () => {
      useDockSearch.getState().requestStop();
    });

    await waitFor(() => {
      expect(mockFinish).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });
    expect(result.current.lastError).toBeFalsy();
    expect(useDockSearch.getState().query).toBe('open plants');
  });

  it('does not cancel when the recorder re-renders before listening is dispatched', async () => {
    const { result, rerender } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    mockStart.mockImplementation(async () => {
      mockCancel.mockClear();
      rerender();
      return true;
    });

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.phase).toBe('listening');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('still reports when finish returns no URI', async () => {
    mockFinish.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    await startListening(result);

    await act(async () => {
      result.current.stopListening();
    });

    await waitFor(() => {
      expect(result.current.lastError).toBe('That recording could not be saved.');
    });
    expect(useDockSearch.getState().query).toBe('');
    expect(mockRequestJournalTranscribe).not.toHaveBeenCalled();
  });

  it('releases the recorder when the overlay unmounts mid-listen', async () => {
    const { result, unmount } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    await startListening(result);
    mockCancel.mockClear();
    unmount();
    expect(mockCancel).toHaveBeenCalled();
  });

  it('cancels an in-flight take when search collapses', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useVoiceSession({ enabled, onUtterance: async (text) => text }),
      { initialProps: { enabled: true } },
    );

    await startListening(result);
    mockCancel.mockClear();
    rerender({ enabled: false });

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalled();
      expect(result.current.phase).toBe('idle');
    });
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('appends a later take onto the search field', async () => {
    const { result } = renderHook(() =>
      useVoiceSession({ enabled: true, onUtterance: async (text) => text }),
    );

    useDockSearch.getState().setQuery('buy');
    await startListening(result);

    await act(async () => {
      result.current.stopListening();
    });

    await waitFor(() => {
      expect(useDockSearch.getState().query).toBe('buy open plants');
    });
  });
});
