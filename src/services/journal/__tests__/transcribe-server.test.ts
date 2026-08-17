const mockGuardedFetch = jest.fn();

jest.mock('@/services/http/dependency-guard', () => ({
  guardedFetch: (...args: unknown[]) => mockGuardedFetch(...args),
}));

import {
  geminiAudioMime,
  journalTranscribeProvider,
  parseAudioDataUrl,
  parseGeminiTranscriptText,
  parseJournalTranscribeInput,
  transcribeJournalAudio,
} from '../transcribe-server';

const AUDIO_DATA_URL = 'data:audio/m4a;base64,YQ==';

describe('journal transcribe server', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.JOURNAL_TRANSCRIBE_PROVIDER;
    delete process.env.JOURNAL_GEMINI_MODEL;
    delete process.env.TRAVEL_GEMINI_MODEL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a bounded audio data URL and rejects extra fields', () => {
    expect(parseJournalTranscribeInput({ audioDataUrl: AUDIO_DATA_URL })).toEqual({
      audioDataUrl: AUDIO_DATA_URL,
    });
    expect(parseJournalTranscribeInput({ audioDataUrl: AUDIO_DATA_URL, note: 'secret' })).toBeUndefined();
    expect(parseJournalTranscribeInput({})).toBeUndefined();
  });

  it('rejects empty, malformed, and oversized recordings', () => {
    expect(parseAudioDataUrl('data:audio/exe;base64,YQ==')).toBeUndefined();
    expect(parseAudioDataUrl('data:audio/m4a;base64,')).toBeUndefined();
    expect(parseAudioDataUrl(`data:audio/m4a;base64,${'A'.repeat(8_388_612)}`)).toBeUndefined();
    expect(parseAudioDataUrl(AUDIO_DATA_URL)).toMatchObject({ mime: 'audio/m4a' });
  });

  it('prefers free Gemini and only uses OpenAI when forced or Gemini is missing', () => {
    expect(journalTranscribeProvider()).toBeUndefined();

    process.env.OPENAI_API_KEY = 'synthetic-openai';
    expect(journalTranscribeProvider()).toBe('openai');

    process.env.GEMINI_API_KEY = 'synthetic-gemini';
    expect(journalTranscribeProvider()).toBe('gemini');

    process.env.JOURNAL_TRANSCRIBE_PROVIDER = 'openai';
    expect(journalTranscribeProvider()).toBe('openai');

    delete process.env.OPENAI_API_KEY;
    expect(journalTranscribeProvider()).toBeUndefined();
  });

  it('maps journal recordings onto Gemini audio MIME types', () => {
    expect(geminiAudioMime('audio/m4a')).toBe('audio/mp4');
    expect(geminiAudioMime('audio/mpeg')).toBe('audio/mp3');
    expect(geminiAudioMime('audio/webm')).toBe('audio/webm');
  });

  it('reads Gemini candidate text and ignores empty model output', () => {
    expect(
      parseGeminiTranscriptText({
        candidates: [{ content: { parts: [{ text: '  Morning light  ' }] } }],
      }),
    ).toBe('Morning light');
    expect(parseGeminiTranscriptText({ candidates: [] })).toBe('');
  });

  it('transcribes with Gemini when the free key is configured', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-gemini';
    mockGuardedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Wrote this page' }] } }],
        }),
        { status: 200 },
      ),
    );

    await expect(transcribeJournalAudio(AUDIO_DATA_URL)).resolves.toBe('Wrote this page');
    expect(mockGuardedFetch).toHaveBeenCalledWith(
      'gemini-journal',
      expect.stringContaining('gemini-flash-lite-latest:generateContent'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'synthetic-gemini' }),
      }),
      expect.anything(),
    );
    const body = JSON.parse(String(mockGuardedFetch.mock.calls[0]?.[2]?.body)) as {
      contents: { parts: { inlineData?: { mimeType: string; data: string } }[] }[];
    };
    expect(body.contents[0]?.parts[0]?.inlineData).toEqual({
      mimeType: 'audio/mp4',
      data: 'YQ==',
    });
  });

  it('returns an empty transcript when Gemini heard nothing', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-gemini';
    mockGuardedFetch.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '   ' }] } }] }), {
        status: 200,
      }),
    );

    await expect(transcribeJournalAudio(AUDIO_DATA_URL)).resolves.toBe('');
  });

  it('uses OpenAI only when journal dictate is forced onto that provider', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-gemini';
    process.env.OPENAI_API_KEY = 'synthetic-openai';
    process.env.JOURNAL_TRANSCRIBE_PROVIDER = 'openai';
    mockGuardedFetch.mockResolvedValue(
      new Response(JSON.stringify({ text: 'Paid path' }), { status: 200 }),
    );

    await expect(transcribeJournalAudio(AUDIO_DATA_URL)).resolves.toBe('Paid path');
    expect(mockGuardedFetch).toHaveBeenCalledWith(
      'openai',
      'https://api.openai.com/v1/audio/transcriptions',
      expect.anything(),
      expect.anything(),
    );
  });

  it('fails closed when no free or paid transcribe provider is configured', async () => {
    await expect(transcribeJournalAudio(AUDIO_DATA_URL)).rejects.toThrow('NOT_CONFIGURED');
    expect(mockGuardedFetch).not.toHaveBeenCalled();
  });
});
