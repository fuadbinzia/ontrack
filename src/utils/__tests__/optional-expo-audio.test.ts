import type { ExpoAudioApi } from '../optional-expo-audio';
import {
  FALLBACK_RECORDING_OPTIONS,
  isUsableExpoAudio,
  loadOptionalExpoAudio,
  recordingOptionsFor,
} from '../optional-expo-audio';

function usableApi(overrides: Partial<ExpoAudioApi> = {}): ExpoAudioApi {
  return {
    useAudioRecorder: jest.fn(),
    useAudioPlayer: jest.fn(),
    requestRecordingPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    RecordingPresets: {
      HIGH_QUALITY: { extension: '.m4a' },
      LOW_QUALITY: { extension: '.m4a' },
    },
    ...overrides,
  } as unknown as ExpoAudioApi;
}

describe('loadOptionalExpoAudio', () => {
  it('does not throw when expo-audio reads options.extension of undefined', () => {
    const loadJs = jest.fn(() => {
      throw new TypeError("Cannot read property 'extension' of undefined");
    });

    expect(loadOptionalExpoAudio(() => ({}), loadJs)).toBeUndefined();
    expect(loadJs).toHaveBeenCalled();
  });

  it('does not evaluate expo-audio when the installed binary lacks ExpoAudio', () => {
    const loadJs = jest.fn(() => usableApi());

    expect(loadOptionalExpoAudio(() => null, loadJs)).toBeUndefined();
    expect(loadJs).not.toHaveBeenCalled();
  });

  it('returns undefined when native lookup throws', () => {
    expect(
      loadOptionalExpoAudio(() => {
        throw new Error('Native module registry unavailable');
      }, jest.fn()),
    ).toBeUndefined();
  });

  it('returns undefined when useAudioRecorder is missing', () => {
    const api = usableApi({
      useAudioRecorder: undefined,
    } as Partial<ExpoAudioApi>);

    expect(loadOptionalExpoAudio(() => ({}), () => api)).toBeUndefined();
    expect(isUsableExpoAudio(api)).toBe(false);
  });

  it('still loads when HIGH_QUALITY has no extension', () => {
    const api = usableApi({
      RecordingPresets: {
        HIGH_QUALITY: {},
        LOW_QUALITY: { extension: '.m4a' },
      },
    } as Partial<ExpoAudioApi>);

    expect(loadOptionalExpoAudio(() => ({}), () => api)).toBe(api);
    expect(recordingOptionsFor(api).extension).toBe('.m4a');
  });

  it('returns the API when the binary and JS package are usable', () => {
    const api = usableApi();

    expect(loadOptionalExpoAudio(() => ({}), () => api)).toBe(api);
  });
});

describe('recordingOptionsFor', () => {
  it('never hands useAudioRecorder undefined options', () => {
    expect(recordingOptionsFor(undefined)).toEqual(FALLBACK_RECORDING_OPTIONS);
    expect(recordingOptionsFor(undefined).extension).toBe('.m4a');
    expect(
      recordingOptionsFor(
        usableApi({
          RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: { extension: '.m4a' } },
        } as Partial<ExpoAudioApi>),
      ).extension,
    ).toBe('.m4a');
  });

  it('prefers the package HIGH_QUALITY preset when present', () => {
    const highQuality = { extension: '.wav', sampleRate: 48000 };
    const api = usableApi({
      RecordingPresets: {
        HIGH_QUALITY: highQuality,
        LOW_QUALITY: { extension: '.m4a' },
      },
    } as Partial<ExpoAudioApi>);

    expect(recordingOptionsFor(api)).toBe(highQuality);
  });
});
