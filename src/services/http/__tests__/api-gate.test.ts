const mockAuthenticateApiRequest = jest.fn();
const mockIsApiRequestBlocked = jest.fn();
const mockApiRateLimitSubject = jest.fn();
const mockCheckApiRateLimit = jest.fn();

jest.mock('../api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
  isApiRequestBlocked: (...args: unknown[]) => mockIsApiRequestBlocked(...args),
  apiRateLimitSubject: (...args: unknown[]) => mockApiRateLimitSubject(...args),
}));

jest.mock('../api-rate-limit', () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

// eslint-disable-next-line import/first
import { gateGuestPaidApiRequest, gatePaidApiRequest } from '../api-gate';

describe('paid API request gate', () => {
  const request = new Request('https://api.example.test/paid');

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'user-1' });
    mockIsApiRequestBlocked.mockReturnValue(false);
    mockApiRateLimitSubject.mockReturnValue('user-1');
    mockCheckApiRateLimit.mockReturnValue('ok');
  });

  it('stops unauthenticated requests before rate-limit state is touched', async () => {
    mockIsApiRequestBlocked.mockReturnValue(true);

    await expect(gatePaidApiRequest(request, 'nutrition')).resolves.toBe('unauthenticated');
    expect(mockApiRateLimitSubject).not.toHaveBeenCalled();
    expect(mockCheckApiRateLimit).not.toHaveBeenCalled();
  });

  it('uses the authenticated subject and reports rate limiting', async () => {
    mockCheckApiRateLimit.mockReturnValue('limited');

    await expect(gatePaidApiRequest(request, 'nutrition')).resolves.toBe('rate_limited');
    expect(mockApiRateLimitSubject).toHaveBeenCalledWith(
      request,
      { status: 'ok', userId: 'user-1' },
    );
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('nutrition', 'user-1');
  });

  it('allows authenticated traffic below the configured limit', async () => {
    await expect(gatePaidApiRequest(request, 'flights')).resolves.toBe('ok');
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('flights', 'user-1');
  });
});

describe('guest paid companion gate', () => {
  const request = new Request('https://api.example.test/agents', {
    headers: { 'x-forwarded-for': '203.0.113.9' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'unauthenticated' });
    mockIsApiRequestBlocked.mockReturnValue(true);
    mockApiRateLimitSubject.mockReturnValue('anon:203.0.113.9');
    mockCheckApiRateLimit.mockReturnValue('ok');
  });

  it('allows unauthenticated callers and rate-limits them by anon subject', async () => {
    await expect(gateGuestPaidApiRequest(request, 'agents')).resolves.toBe('ok');
    expect(mockIsApiRequestBlocked).not.toHaveBeenCalled();
    expect(mockApiRateLimitSubject).toHaveBeenCalledWith(
      request,
      { status: 'unauthenticated' },
    );
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('agents', 'anon:203.0.113.9');
  });

  it('reports rate limiting for the anon subject', async () => {
    mockCheckApiRateLimit.mockReturnValue('limited');

    await expect(gateGuestPaidApiRequest(request, 'journal')).resolves.toBe('rate_limited');
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('journal', 'anon:203.0.113.9');
  });

  it('still authenticates signed-in callers and rate-limits by user id', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'user-1' });
    mockIsApiRequestBlocked.mockReturnValue(false);
    mockApiRateLimitSubject.mockReturnValue('user-1');

    await expect(gateGuestPaidApiRequest(request, 'agents')).resolves.toBe('ok');
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('agents', 'user-1');
  });

  it('does not fail-open without a rate-limit check', async () => {
    mockCheckApiRateLimit.mockReturnValue('limited');

    await expect(gateGuestPaidApiRequest(request, 'agents')).resolves.toBe('rate_limited');
    expect(mockCheckApiRateLimit).toHaveBeenCalled();
  });
});
