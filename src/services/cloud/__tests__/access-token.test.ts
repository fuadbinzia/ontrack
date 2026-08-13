const mockGetSupabaseClient = jest.fn();

jest.mock('../supabase', () => ({
  getSupabaseClient: (...args: unknown[]) => mockGetSupabaseClient(...args),
}));

// eslint-disable-next-line import/first
import { authHeader, getAccessToken } from '../access-token';

describe('server-route access token boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns no credential when cloud services are not configured', async () => {
    mockGetSupabaseClient.mockReturnValue(undefined);
    await expect(getAccessToken()).resolves.toBeUndefined();
    await expect(authHeader()).resolves.toEqual({});
  });

  it('returns no authorization header for a configured client without a session', async () => {
    mockGetSupabaseClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });
    await expect(authHeader()).resolves.toEqual({});
  });

  it('formats the active session token as a bearer header', async () => {
    mockGetSupabaseClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'synthetic-token' } } }) },
    });
    await expect(getAccessToken()).resolves.toBe('synthetic-token');
    await expect(authHeader()).resolves.toEqual({ Authorization: 'Bearer synthetic-token' });
  });
});

