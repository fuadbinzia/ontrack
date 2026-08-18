import type { ExpoAudioApi } from '../optional-expo-audio';
import {
  FALLBACK_RECORDING_OPTIONS,
  beginExpoRecording,
  isUsableExpoAudio,
  loadOptionalExpoAudio,
  recordingOptionsFor,
  voiceStartErrorMessage,
} from '../optional-expo-audio';

function usableApi(overrides: Partial<ExpoAudioApi> = {}): ExpoAudioApi {
  return {
    useAudioRecorder: jest.fn(),
    useAudioPlayer: jest.fn(),
    getRecordingPermissionsAsync: jest.fn(),
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

  it('returns undefined when getRecordingPermissionsAsync is missing', () => {
    const api = usableApi({
      getRecordingPermissionsAsync: undefined,
    } as Partial<ExpoAudioApi>);

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

  it('includes platform blocks so prepareToRecordAsync has a format', () => {
    expect(FALLBACK_RECORDING_OPTIONS.android).toEqual({
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
    });
    expect(FALLBACK_RECORDING_OPTIONS.ios).toMatchObject({
      outputFormat: 'aac ',
      audioQuality: 0x60,
    });
  });

  it('prefers the package HIGH_QUALITY preset when present', () => {
    const highQuality = { extension: '.wav', sampleRate: 48000 };
    const api = usableApi({
      RecordingPresets: {
        HIGH_QUALITY: highQuality,
        LOW_QUALITY: { extension: '.m4a' },
      },
    } as Partial<ExpoAudioApi>);

    expect(recordingOptionsFor(api)).toMatchObject(highQuality);
  });

  it('always enables metering so the recording wave has levels', () => {
    expect(recordingOptionsFor(undefined).isMeteringEnabled).toBe(true);
    expect(
      recordingOptionsFor(
        usableApi({
          RecordingPresets: {
            HIGH_QUALITY: { extension: '.m4a' },
            LOW_QUALITY: { extension: '.m4a' },
          },
        } as Partial<ExpoAudioApi>),
      ).isMeteringEnabled,
    ).toBe(true);
  });
});

describe('beginExpoRecording', () => {
  it('mixes with other audio and does not pass forDuration', async () => {
    const setAudioModeAsync = jest.fn(async () => undefined);
    const prepareToRecordAsync = jest.fn(async () => undefined);
    const record = jest.fn();

    await beginExpoRecording(
      { setAudioModeAsync } as Pick<ExpoAudioApi, 'setAudioModeAsync'>,
      { isRecording: false, prepareToRecordAsync, record },
    );

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    expect(prepareToRecordAsync).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith();
    expect(record.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('stops a leftover take before preparing again', async () => {
    const stop = jest.fn(async () => undefined);
    const prepareToRecordAsync = jest.fn(async () => undefined);
    const record = jest.fn();

    await beginExpoRecording(
      { setAudioModeAsync: jest.fn(async () => undefined) },
      { isRecording: true, prepareToRecordAsync, record, stop },
    );

    expect(stop).toHaveBeenCalled();
    expect(prepareToRecordAsync).toHaveBeenCalled();
  });
});

describe('voiceStartErrorMessage', () => {
  it('does not call a working mic unavailable on this device', () => {
    expect(voiceStartErrorMessage(new Error('Session is busy'))).toMatch(
      /microphone is busy/i,
    );
    expect(voiceStartErrorMessage(new Error('audio session in use'))).not.toMatch(
      /unavailable on this device/i,
    );
    expect(voiceStartErrorMessage(new Error('Permission denied'))).toMatch(
      /permission/i,
    );
    expect(voiceStartErrorMessage(new Error('boom'))).toMatch(/could not start/i);
    expect(voiceStartErrorMessage(new Error('boom'))).not.toMatch(
      /unavailable on this device/i,
    );
  });
});
