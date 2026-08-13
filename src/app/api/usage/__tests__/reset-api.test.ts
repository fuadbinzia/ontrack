const mockAuthenticateApiRequest = jest.fn();
const mockApiRateLimitSubject = jest.fn();
const mockResetApiRateLimitsForSubject = jest.fn();

jest.mock('@/services/http/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
  apiRateLimitSubject: (...args: unknown[]) => mockApiRateLimitSubject(...args),
}));

jest.mock('@/services/http/api-rate-limit', () => ({
  resetApiRateLimitsForSubject: (...args: unknown[]) => mockResetApiRateLimitsForSubject(...args),
}));

const route = require('../reset+api') as typeof import('../reset+api');

describe('API usage reset route', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'user-1' });
    mockApiRateLimitSubject.mockReturnValue('user-1');
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('resets only the authenticated caller subject outside production', async () => {
    const request = new Request('https://api.example.test/api/usage/reset', { method: 'POST' });
    const response = await route.POST(request);

    expect(mockAuthenticateApiRequest).toHaveBeenCalledWith(request);
    expect(mockApiRateLimitSubject).toHaveBeenCalledWith(
      request,
      { status: 'ok', userId: 'user-1' },
    );
    expect(mockResetApiRateLimitsForSubject).toHaveBeenCalledWith('user-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, subject: 'user-1' });
  });

  it('never authenticates or clears buckets in production', async () => {
    process.env.NODE_ENV = 'production';
    const response = await route.POST(
      new Request('https://api.example.test/api/usage/reset', { method: 'POST' }),
    );

    expect(response.status).toBe(403);
    expect(mockAuthenticateApiRequest).not.toHaveBeenCalled();
    expect(mockResetApiRateLimitsForSubject).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });
});
