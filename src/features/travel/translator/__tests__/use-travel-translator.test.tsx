import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockRequestLanguages = jest.fn();
const mockRequestTurn = jest.fn();
const mockPermission = jest.fn();
const mockSetAudioMode = jest.fn();
const mockSpeechStop = jest.fn();
const mockSpeechSpeak = jest.fn();
const mockGetVoices = jest.fn();
const mockClipboard = jest.fn();
const mockRecorder = {
  isRecording: false,
  uri: null as string | null,
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(() => {
    mockRecorder.isRecording = true;
  }),
  stop: jest.fn(async () => {
    mockRecorder.isRecording = false;
  }),
};

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (name: string) =>
    name === 'ExpoAudio' || name === 'ExpoSpeech' ? {} : null,
}));

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...args),
  useAudioRecorder: () => mockRecorder,
}));

jest.mock('expo-speech', () => ({
  stop: (...args: unknown[]) => mockSpeechStop(...args),
  speak: (...args: unknown[]) => mockSpeechSpeak(...args),
  getAvailableVoicesAsync: (...args: unknown[]) => mockGetVoices(...args),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    exists = false;
    base64 = jest.fn(async () => 'YXVkaW8=');
    delete = jest.fn();
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockClipboard(...args),
}));

jest.mock('@/services/travel/translator-client', () => ({
  TravelTranslatorError: class extends Error {},
  requestTravelTranslatorLanguages: (...args: unknown[]) => mockRequestLanguages(...args),
  requestTravelTranslatorTurn: (...args: unknown[]) => mockRequestTurn(...args),
}));

import type { TravelPlan } from '@/features/travel/types';
import { useTravelTranslator } from '../use-travel-translator';

const english = { code: 'en', displayName: 'English', speechLocale: 'en-US' };
const spanish = { code: 'es', displayName: 'Spanish', speechLocale: 'es-DO' };
const plan = {
  id: 'trip-1',
  title: 'Punta Cana',
  destination: 'Punta Cana, Dominican Republic',
} as TravelPlan;

describe('useTravelTranslator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecorder.isRecording = false;
    mockRecorder.uri = null;
    mockPermission.mockResolvedValue({ granted: true });
    mockSetAudioMode.mockResolvedValue(undefined);
    mockSpeechStop.mockResolvedValue(undefined);
    mockGetVoices.mockResolvedValue([
      { identifier: 'english-voice', language: 'en-US' },
      { identifier: 'spanish-voice', language: 'es-DO' },
    ]);
    mockRequestLanguages.mockResolvedValue({
      home: english,
      destination: spanish,
      alternatives: [],
    });
    mockRequestTurn.mockResolvedValue({
      transcript: 'Where is the beach?',
      translatedText: '¿Dónde está la playa?',
    });
  });

  it('translates a typed turn, appends it, speaks it, copies it, and swaps directions', async () => {
    const { result, unmount } = renderHook(() =>
      useTravelTranslator({
        plan,
        visible: true,
        aiEnabled: true,
        homeLocale: 'en-US',
      }),
    );
    await waitFor(() => expect(result.current.destinationLanguage).toEqual(spanish));

    act(() => result.current.setTypedText('Where is the beach?'));
    act(() => result.current.translateTyped());
    await waitFor(() => expect(result.current.turns[0]?.status).toBe('translated'));

    expect(mockRequestTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: plan.destination,
        sourceLanguage: english,
        targetLanguage: spanish,
        text: 'Where is the beach?',
      }),
      expect.any(AbortSignal),
    );
    expect(mockSpeechSpeak).toHaveBeenCalledWith(
      '¿Dónde está la playa?',
      expect.objectContaining({ voice: 'spanish-voice', language: 'es-DO' }),
    );
    await act(async () => result.current.copyTurn(result.current.turns[0]!));
    expect(mockClipboard).toHaveBeenCalledWith('¿Dónde está la playa?');

    act(() => result.current.swapLanguages());
    expect(result.current.homeLanguage).toEqual(spanish);
    expect(result.current.destinationLanguage).toEqual(english);
    expect(result.current.typedDirection).toBe('destination-to-home');
    unmount();
  });

  it('keeps typed translation available when microphone permission is denied', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    const { result, unmount } = renderHook(() =>
      useTravelTranslator({ plan, visible: true, aiEnabled: true, homeLocale: 'en-US' }),
    );
    await waitFor(() => expect(result.current.destinationLanguage).toEqual(spanish));

    await act(async () => result.current.startVoice('home-to-destination'));
    await act(async () => result.current.startVoice('home-to-destination'));

    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(mockPermission).toHaveBeenCalledTimes(1);
    expect(result.current.statusMessage).toContain('Microphone permission');
    unmount();
  });

  it('shows a non-blocking playback fallback and stops active work when hidden', async () => {
    mockGetVoices.mockResolvedValue([]);
    const { result, rerender, unmount } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useTravelTranslator({ plan, visible, aiEnabled: true, homeLocale: 'en-US' }),
      { initialProps: { visible: true } },
    );
    await waitFor(() => expect(result.current.destinationLanguage).toEqual(spanish));
    act(() => result.current.setTypedText('Where is the beach?'));
    act(() => result.current.translateTyped());
    await waitFor(() => expect(result.current.statusMessage).toContain('voice is installed'));

    await act(async () => result.current.startVoice('home-to-destination'));
    expect(mockRecorder.isRecording).toBe(true);
    rerender({ visible: false });
    await waitFor(() => expect(mockRecorder.stop).toHaveBeenCalled());
    expect(mockSpeechStop).toHaveBeenCalled();
    unmount();
  });
});
