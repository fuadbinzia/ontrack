/* eslint-disable import/first -- Jest mocks must initialize before the hook module. */
import { act, renderHook } from '@testing-library/react-native';

type FinishResult =
  | { uri: string; durationMs: number; mode: 'dictate' | 'voice' }
  | undefined;

const mockStart = jest.fn(async (..._args: unknown[]) => true);
const mockFinish = jest.fn(
  async (): Promise<FinishResult> => ({
    uri: 'file:///tmp/take.m4a',
    durationMs: 1200,
    mode: 'dictate',
  }),
);
const mockSetStatusMessage = jest.fn();
const mockRecorder = {
  mode: 'dictate' as 'dictate' | 'voice' | null,
  recording: false,
  nativeAvailable: true,
  statusMessage: '',
  audioRecorder: {},
  start: (...args: unknown[]) => mockStart(...args),
  finish: () => mockFinish(),
  cancel: jest.fn(async () => undefined),
  setStatusMessage: (...args: unknown[]) => mockSetStatusMessage(...args),
};

jest.mock('../use-journal-recorder', () => ({
  useJournalRecorder: () => mockRecorder,
  useJournalRecorderLiveState: () => ({ meteringDb: null, elapsedMs: 0 }),
  audioDataUrlFromUri: jest.fn(async () => 'data:audio/m4a;base64,QQ=='),
  deleteRecordedAudio: jest.fn(),
}));

const mockPersistJournalVoice = jest.fn(
  async () => 'file:///documents/journal-voice/voice-1.m4a',
);
jest.mock('../voice-persist', () => ({
  persistJournalVoice: (...args: unknown[]) => mockPersistJournalVoice(...args),
}));

const mockRequestJournalTranscribe = jest.fn(async () => ({
  text: 'hello from dictation',
}));
jest.mock('@/services/journal/transcribe-client', () => ({
  requestJournalTranscribe: (...args: unknown[]) =>
    mockRequestJournalTranscribe(...args),
}));

const mockAddText = jest.fn();
const mockAddVoice = jest.fn();
const mockJournalState = {
  addText: (...args: unknown[]) => mockAddText(...args),
  addVoice: (...args: unknown[]) => mockAddVoice(...args),
  aiDisclosureAccepted: true,
  acceptAiDisclosure: jest.fn(),
};
jest.mock('@/store/journal', () => ({
  useJournal: (selector: (state: typeof mockJournalState) => unknown) =>
    selector(mockJournalState),
}));

import { useJournalComposer } from '../journal-composer';

const DATE_KEY = '2026-08-16';

describe('journal composer dictate', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockFinish.mockClear();
    mockFinish.mockResolvedValue({
      uri: 'file:///tmp/take.m4a',
      durationMs: 1200,
      mode: 'dictate',
    });
    mockSetStatusMessage.mockClear();
    mockRequestJournalTranscribe.mockReset();
    mockRequestJournalTranscribe.mockResolvedValue({ text: 'hello from dictation' });
    mockAddText.mockClear();
    mockAddVoice.mockClear();
    mockPersistJournalVoice.mockClear();
    mockRecorder.mode = 'dictate';
  });

  it('lands dictated words in the input for review instead of posting them', async () => {
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.draft).toBe('hello from dictation');
    expect(mockAddText).not.toHaveBeenCalled();
    expect(result.current.transcribing).toBe(false);
  });

  it('appends dictation after text the user already typed', async () => {
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    act(() => {
      result.current.setDraft('so far today');
    });
    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.draft).toBe('so far today hello from dictation');
  });

  it('shows the transcribing state while the request is in flight', async () => {
    let resolveTranscribe!: (value: { text: string }) => void;
    mockRequestJournalTranscribe.mockImplementationOnce(
      () =>
        new Promise<{ text: string }>((resolve) => {
          resolveTranscribe = resolve;
        }),
    );
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    await act(async () => {
      result.current.stopRecording();
      await Promise.resolve();
    });
    expect(result.current.transcribing).toBe(true);
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveTranscribe({ text: 'later words' });
    });
    expect(result.current.transcribing).toBe(false);
    expect(result.current.draft).toBe('later words');
  });

  it('keeps the draft and reports status when transcription fails', async () => {
    mockRequestJournalTranscribe.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    act(() => {
      result.current.setDraft('typed so far');
    });
    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.draft).toBe('typed so far');
    expect(mockSetStatusMessage).toHaveBeenCalled();
    expect(result.current.transcribing).toBe(false);
  });

  it('says nothing was heard when transcription is empty', async () => {
    mockRequestJournalTranscribe.mockResolvedValueOnce({ text: '   ' });
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.draft).toBe('');
    expect(mockSetStatusMessage).toHaveBeenCalledWith(
      'Nothing was heard. Try again or type.',
    );
  });

  it('arms dictate and voice starts with an auto-finisher for the 60s cap', async () => {
    const { result } = renderHook(() => useJournalComposer(DATE_KEY, jest.fn()));

    act(() => {
      result.current.startDictate();
    });
    expect(mockStart).toHaveBeenCalledWith('dictate', expect.any(Function));

    act(() => {
      result.current.startVoice();
    });
    expect(mockStart).toHaveBeenCalledWith('voice', expect.any(Function));

    // The voice auto-finisher must save the note exactly like a manual stop.
    mockRecorder.mode = 'voice';
    mockFinish.mockResolvedValueOnce({
      uri: 'file:///tmp/take.m4a',
      durationMs: 60_000,
      mode: 'voice',
    });
    const voiceLimit = mockStart.mock.calls.find((call) => call[0] === 'voice')?.[1] as
      | (() => void)
      | undefined;
    await act(async () => {
      voiceLimit?.();
      await Promise.resolve();
    });
    expect(mockPersistJournalVoice).toHaveBeenCalledWith('file:///tmp/take.m4a');
    expect(mockAddVoice).toHaveBeenCalledWith(
      DATE_KEY,
      'file:///documents/journal-voice/voice-1.m4a',
      60_000,
    );
  });
});
