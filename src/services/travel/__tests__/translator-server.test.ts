const mockFetchOpenAIResponses = jest.fn();
const mockGuardedFetch = jest.fn();

jest.mock('@/services/ai', () => ({
  defaultOpenAIModel: (...models: (string | undefined)[]) =>
    models.find(Boolean) ?? 'gpt-5.6-luna',
  fetchOpenAIResponses: (...args: unknown[]) => mockFetchOpenAIResponses(...args),
  parseOpenAIJsonResponse: (body: { output_text?: string }) =>
    JSON.parse(body.output_text ?? '{}'),
}));

jest.mock('@/services/http/dependency-guard', () => ({
  guardedFetch: (...args: unknown[]) => mockGuardedFetch(...args),
}));

const server = require('../translator-server') as typeof import('../translator-server');

const english = { code: 'en', displayName: 'English', speechLocale: 'en-US' };
const spanish = { code: 'es', displayName: 'Spanish', speechLocale: 'es-DO' };

describe('travel translator server', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'synthetic-key';
    server.resetTravelTranslatorLanguageCacheForTests();
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('accepts bounded language and typed-turn inputs while rejecting unknown fields', () => {
    expect(
      server.parseTravelTranslatorLanguagesInput({
        destination: 'Santo Domingo, Dominican Republic',
        homeLocale: 'en-US',
      }),
    ).toBeTruthy();
    expect(
      server.parseTravelTranslatorLanguagesInput({
        destination: 'Santo Domingo',
        homeLocale: 'en-US',
        privateNote: 'do not send',
      }),
    ).toBeUndefined();
    expect(
      server.parseTravelTranslatorTurnInput({
        destination: 'Santo Domingo',
        sourceLanguage: english,
        targetLanguage: spanish,
        text: 'Where is the hotel?',
      }),
    ).toMatchObject({ text: 'Where is the hotel?' });
    expect(
      server.parseTravelTranslatorTurnInput({
        destination: 'Santo Domingo',
        sourceLanguage: english,
        targetLanguage: spanish,
        text: 'hello',
        audioDataUrl: 'data:audio/m4a;base64,YQ==',
      }),
    ).toBeUndefined();
  });

  it('rejects empty, overlong, malformed, and oversized recordings', () => {
    const base = {
      destination: 'Santo Domingo',
      sourceLanguage: english,
      targetLanguage: spanish,
    };
    expect(server.parseTravelTranslatorTurnInput({ ...base, text: 'x'.repeat(1_001) })).toBeUndefined();
    expect(server.parseTravelTranslatorTurnInput({ ...base, audioDataUrl: 'data:audio/exe;base64,YQ==' })).toBeUndefined();
    expect(
      server.parseTravelTranslatorTurnInput({
        ...base,
        audioDataUrl: `data:audio/m4a;base64,${'A'.repeat(8_388_612)}`,
      }),
    ).toBeUndefined();
  });

  it('resolves destination languages once per app-process cache key', async () => {
    mockFetchOpenAIResponses.mockResolvedValue({
      output_text: JSON.stringify({
        home: english,
        destination: spanish,
        alternatives: [],
      }),
    });
    const input = { destination: 'Punta Cana', homeLocale: 'en-US' };

    await expect(server.resolveTravelTranslatorLanguages(input, 'user-1')).resolves.toMatchObject({
      home: english,
      destination: spanish,
    });
    await server.resolveTravelTranslatorLanguages(input, 'user-1');

    expect(mockFetchOpenAIResponses).toHaveBeenCalledTimes(1);
  });

  it('transcribes an audio turn, translates it, and preserves transliteration', async () => {
    mockGuardedFetch.mockResolvedValue(
      Response.json({ text: 'Where is the beach?' }),
    );
    mockFetchOpenAIResponses.mockResolvedValue({
      output_text: JSON.stringify({
        translatedText: '¿Dónde está la playa?',
        transliteration: null,
      }),
    });

    await expect(
      server.translateTravelTranslatorTurn(
        {
          destination: 'Punta Cana',
          sourceLanguage: english,
          targetLanguage: spanish,
          audioDataUrl: 'data:audio/m4a;base64,YXVkaW8=',
        },
        'user-1',
      ),
    ).resolves.toEqual({
      transcript: 'Where is the beach?',
      translatedText: '¿Dónde está la playa?',
    });
    const form = mockGuardedFetch.mock.calls[0][2].body as FormData;
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    expect(mockFetchOpenAIResponses).toHaveBeenCalledWith(
      expect.objectContaining({ safetyIdentifier: 'user-1' }),
    );
  });

  it('rejects empty or malformed provider output', async () => {
    mockFetchOpenAIResponses.mockResolvedValue({
      output_text: JSON.stringify({ translatedText: '', transliteration: null }),
    });
    await expect(
      server.translateTravelTranslatorTurn(
        {
          destination: 'Paris',
          sourceLanguage: english,
          targetLanguage: languageFromLocaleForTest('fr-FR', 'French'),
          text: 'Hello',
        },
        'user-1',
      ),
    ).rejects.toThrow('INVALID_RESPONSE');
  });
});

function languageFromLocaleForTest(speechLocale: string, displayName: string) {
  return {
    code: speechLocale.split('-')[0]!,
    displayName,
    speechLocale,
  };
}
