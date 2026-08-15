import {
  parseAudioDataUrl,
  parseJournalTranscribeInput,
} from '../transcribe-server';

describe('journal transcribe server', () => {
  it('accepts a bounded audio data URL and rejects extra fields', () => {
    const audioDataUrl = 'data:audio/m4a;base64,YQ==';
    expect(parseJournalTranscribeInput({ audioDataUrl })).toEqual({ audioDataUrl });
    expect(parseJournalTranscribeInput({ audioDataUrl, note: 'secret' })).toBeUndefined();
    expect(parseJournalTranscribeInput({})).toBeUndefined();
  });

  it('rejects empty, malformed, and oversized recordings', () => {
    expect(parseAudioDataUrl('data:audio/exe;base64,YQ==')).toBeUndefined();
    expect(parseAudioDataUrl('data:audio/m4a;base64,')).toBeUndefined();
    expect(parseAudioDataUrl(`data:audio/m4a;base64,${'A'.repeat(8_388_612)}`)).toBeUndefined();
    expect(parseAudioDataUrl('data:audio/m4a;base64,YQ==')).toMatchObject({ mime: 'audio/m4a' });
  });
});
