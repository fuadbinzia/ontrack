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
import { gatePaidApiRequest } from '../api-gate';

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
