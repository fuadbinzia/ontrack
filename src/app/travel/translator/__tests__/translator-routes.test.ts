const mockAuthorize = jest.fn();
const mockParseLanguages = jest.fn();
const mockResolveLanguages = jest.fn();
const mockParseTurn = jest.fn();
const mockTranslateTurn = jest.fn();

jest.mock('@/services/travel/translator-server', () => ({
  authorizeTravelTranslator: (...args: unknown[]) => mockAuthorize(...args),
  parseTravelTranslatorLanguagesInput: (...args: unknown[]) => mockParseLanguages(...args),
  resolveTravelTranslatorLanguages: (...args: unknown[]) => mockResolveLanguages(...args),
  parseTravelTranslatorTurnInput: (...args: unknown[]) => mockParseTurn(...args),
  translateTravelTranslatorTurn: (...args: unknown[]) => mockTranslateTurn(...args),
}));

const languagesRoute = require('../languages+api') as typeof import('../languages+api');
const turnRoute = require('../turn+api') as typeof import('../turn+api');

function requireResponse(response: Response | undefined): Response {
  if (!response) throw new Error('Expected route response');
  return response;
}

describe('travel translator routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorize.mockResolvedValue({ auth: { status: 'ok', userId: 'user-1' } });
  });

  it('returns authentication and rate-limit responses without provider work', async () => {
    mockAuthorize.mockResolvedValue({
      response: Response.json({ code: 'RATE_LIMITED' }, { status: 429 }),
    });
    const response = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', {
        method: 'POST',
        body: '{}',
      }),
    ));
    expect(response.status).toBe(429);
    expect(mockParseTurn).not.toHaveBeenCalled();
    expect(mockTranslateTurn).not.toHaveBeenCalled();
  });

  it('rejects invalid language and turn bodies', async () => {
    mockParseLanguages.mockReturnValue(undefined);
    mockParseTurn.mockReturnValue(undefined);
    const languages = requireResponse(await languagesRoute.POST(
      new Request('https://api.example.test/travel/translator/languages', {
        method: 'POST',
        body: '{}',
      }),
    ));
    const turn = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', {
        method: 'POST',
        body: '{}',
      }),
    ));
    expect(languages.status).toBe(400);
    expect(turn.status).toBe(400);
  });

  it('uses the authenticated safety identifier and returns sanitized service results', async () => {
    mockParseLanguages.mockReturnValue({ destination: 'Paris', homeLocale: 'en-US' });
    mockResolveLanguages.mockResolvedValue({ home: { code: 'en' }, destination: { code: 'fr' }, alternatives: [] });
    mockParseTurn.mockReturnValue({ destination: 'Paris', text: 'Hello' });
    mockTranslateTurn.mockResolvedValue({ transcript: 'Hello', translatedText: 'Bonjour' });

    const languageResponse = requireResponse(await languagesRoute.POST(
      new Request('https://api.example.test/travel/translator/languages', {
        method: 'POST',
        body: '{}',
      }),
    ));
    const turnResponse = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', {
        method: 'POST',
        body: '{}',
      }),
    ));
    expect(mockResolveLanguages).toHaveBeenCalledWith(
      { destination: 'Paris', homeLocale: 'en-US' },
      expect.stringMatching(/^[a-f0-9]{32}$/),
    );
    expect(mockTranslateTurn).toHaveBeenCalledWith(
      { destination: 'Paris', text: 'Hello' },
      expect.stringMatching(/^[a-f0-9]{32}$/),
    );
    await expect(languageResponse.json()).resolves.toMatchObject({ destination: { code: 'fr' } });
    await expect(turnResponse.json()).resolves.toEqual({ transcript: 'Hello', translatedText: 'Bonjour' });
  });

  it('maps unavailable and invalid provider failures to explicit statuses', async () => {
    mockParseTurn.mockReturnValue({ destination: 'Paris', text: 'Hello' });
    mockTranslateTurn.mockRejectedValueOnce(new Error('NOT_CONFIGURED'));
    const unavailable = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', { method: 'POST', body: '{}' }),
    ));
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({ code: 'NOT_CONFIGURED' });

    mockTranslateTurn.mockRejectedValueOnce(new Error('INVALID_TRANSCRIPT'));
    const invalid = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', { method: 'POST', body: '{}' }),
    ));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ code: 'INVALID_INPUT' });

    mockTranslateTurn.mockRejectedValueOnce(new Error('TRANSCRIPTION_FAILED'));
    const providerFailure = requireResponse(await turnRoute.POST(
      new Request('https://api.example.test/travel/translator/turn', { method: 'POST', body: '{}' }),
    ));
    expect(providerFailure.status).toBe(502);
    await expect(providerFailure.json()).resolves.toMatchObject({ code: 'PROVIDER_FAILURE' });
  });
});
