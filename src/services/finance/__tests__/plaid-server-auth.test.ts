import {
  plaidConfigured,
  PlaidServerError,
  plaidRequest,
  withPlaidApiAuth,
} from '../plaid-server';

const mockAuthenticateApiRequest = jest.fn();
const mockIsApiRequestBlocked = jest.fn();
const mockApiRateLimitSubject = jest.fn(() => 'user:user-1');
const mockCheckApiRateLimit = jest.fn();

jest.mock('@/services/http/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
  isApiRequestBlocked: (...args: unknown[]) => mockIsApiRequestBlocked(...args),
  apiRateLimitSubject: (...args: unknown[]) => mockApiRateLimitSubject(...args),
}));
jest.mock('@/services/http/api-rate-limit', () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
jest.mock('@/services/http/cors', () => ({
  apiCorsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://ontrack.example' }),
  apiOptionsResponse: () => new Response(null, { status: 204 }),
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

describe('Plaid server authentication boundary', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateApiRequest.mockReset();
    mockIsApiRequestBlocked.mockReset();
    mockApiRateLimitSubject.mockReset();
    mockCheckApiRateLimit.mockReset();
    process.env.PLAID_CLIENT_ID = 'client-test';
    process.env.PLAID_SECRET = 'secret-test';
    process.env.PLAID_ENV = 'sandbox';
    process.env.SUPABASE_URL = 'https://project.supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'user-1' });
    mockIsApiRequestBlocked.mockReturnValue(false);
    mockApiRateLimitSubject.mockReturnValue('user:user-1');
    mockCheckApiRateLimit.mockReturnValue('allowed');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('rejects unauthenticated requests before configuration checks or route work', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'missing' });
    mockIsApiRequestBlocked.mockReturnValueOnce(true);
    const handler = jest.fn();

    const response = await withPlaidApiAuth(
      new Request('https://ontrack.example/api/finance/plaid/sync'),
      handler,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(handler).not.toHaveBeenCalled();
    expect(mockCheckApiRateLimit).not.toHaveBeenCalled();
  });

  it('rate-limits authenticated Plaid work before invoking the handler', async () => {
    mockCheckApiRateLimit.mockReturnValueOnce('limited');
    const handler = jest.fn();

    const response = await withPlaidApiAuth(
      new Request('https://ontrack.example/api/finance/plaid/sync'),
      handler,
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('finance', 'user:user-1');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps revocation callable when the regular finance request bucket is exhausted', async () => {
    mockCheckApiRateLimit.mockReturnValueOnce('limited');
    const handler = jest.fn().mockResolvedValue({ ok: true });

    const response = await withPlaidApiAuth(
      new Request('https://ontrack.example/api/finance/plaid/disconnect'),
      handler,
      { rateLimit: false },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledWith(expect.any(Request), 'user-1');
    expect(mockCheckApiRateLimit).not.toHaveBeenCalled();
  });

  it('reports missing server configuration without running route work', async () => {
    delete process.env.PLAID_SECRET;
    const handler = jest.fn();

    expect(plaidConfigured()).toBe(false);
    const response = await withPlaidApiAuth(
      new Request('https://ontrack.example/api/finance/plaid/sync'),
      handler,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ configured: false });
    expect(handler).not.toHaveBeenCalled();
  });

  it('maps typed Plaid failures to their safe API status and code', async () => {
    const response = await withPlaidApiAuth(
      new Request('https://ontrack.example/api/finance/plaid/exchange'),
      async () => {
        throw new PlaidServerError('Link is still completing.', 'LINK_PENDING', 409);
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      configured: true,
      error: 'Link is still completing.',
      code: 'LINK_PENDING',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://ontrack.example');
  });

  it('allows only a fixed Plaid environment host', async () => {
    process.env.PLAID_ENV = 'https://attacker.example';
    global.fetch = jest.fn();

    await expect(plaidRequest('/accounts/get', {})).rejects.toMatchObject({
      code: 'INVALID_ENV',
      status: 503,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
