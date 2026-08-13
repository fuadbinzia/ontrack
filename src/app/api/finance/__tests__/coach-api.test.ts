const mockAuthorizeFinanceCoach = jest.fn();
const mockPolishFinanceCoachInsights = jest.fn();

jest.mock('@/services/finance/coach-server', () => ({
  authorizeFinanceCoach: (...args: unknown[]) => mockAuthorizeFinanceCoach(...args),
  polishFinanceCoachInsights: (...args: unknown[]) => mockPolishFinanceCoachInsights(...args),
}));

const route = require('../coach+api') as typeof import('../coach+api');

describe('Finance coach API route', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const insight = { id: 'insight-1', title: 'Build a buffer', body: 'Save a little each week.' };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('rejects malformed JSON without invoking paid services', async () => {
    const response = await route.POST(new Request('https://api.example.test/api/finance/coach', {
      method: 'POST',
      body: '{',
    }));

    expect(response.status).toBe(400);
    expect(mockAuthorizeFinanceCoach).not.toHaveBeenCalled();
    expect(mockPolishFinanceCoachInsights).not.toHaveBeenCalled();
  });

  it('returns local educational insights when AI is not configured', async () => {
    const response = await route.POST(new Request('https://api.example.test/api/finance/coach', {
      method: 'POST',
      body: JSON.stringify({ insights: [insight] }),
    }));
    const body = await response.json();

    expect(body).toMatchObject({ insights: [insight], source: 'local' });
    expect(body.disclaimer).toContain('not personalized financial');
    expect(mockAuthorizeFinanceCoach).not.toHaveBeenCalled();
  });

  it('uses the authenticated user and finite reference APR for AI polish', async () => {
    process.env.OPENAI_API_KEY = 'synthetic-key';
    mockAuthorizeFinanceCoach.mockResolvedValue({ auth: { status: 'ok', userId: 'user-1' } });
    mockPolishFinanceCoachInsights.mockResolvedValue([{ ...insight, title: 'Polished' }]);
    const request = new Request('https://api.example.test/api/finance/coach', {
      method: 'POST',
      body: JSON.stringify({ insights: [insight], referenceSavingsApr: 5.1 }),
    });

    const response = await route.POST(request);

    expect(mockAuthorizeFinanceCoach).toHaveBeenCalledWith(request);
    expect(mockPolishFinanceCoachInsights).toHaveBeenCalledWith([insight], {
      referenceSavingsApr: 5.1,
      safetyIdentifier: 'user-1',
    });
    await expect(response.json()).resolves.toMatchObject({ source: 'ai' });
  });

  it('falls back to local insights when authorization or polishing fails', async () => {
    process.env.OPENAI_API_KEY = 'synthetic-key';
    mockAuthorizeFinanceCoach.mockResolvedValueOnce({ response: new Response(null, { status: 429 }) });
    const limited = await route.POST(new Request('https://api.example.test/api/finance/coach', {
      method: 'POST', body: JSON.stringify({ insights: [insight] }),
    }));
    await expect(limited.json()).resolves.toMatchObject({ insights: [insight], source: 'local' });

    mockAuthorizeFinanceCoach.mockResolvedValueOnce({ auth: { status: 'ok', userId: 'user-1' } });
    mockPolishFinanceCoachInsights.mockRejectedValueOnce(new Error('provider unavailable'));
    const failed = await route.POST(new Request('https://api.example.test/api/finance/coach', {
      method: 'POST', body: JSON.stringify({ insights: [insight] }),
    }));
    await expect(failed.json()).resolves.toMatchObject({ insights: [insight], source: 'local' });
  });
});
