const mockExchangeCodeForSession = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  }),
}));

// eslint-disable-next-line import/first
import {
  beginBrowserSignIn,
  CloudAccountError,
  exchangeOAuthCallback,
  ProviderCancelledError,
  resetOAuthCallbackExchangeForTests,
} from '@/services/cloud/account';

describe('OAuth code exchange', () => {
  const redirect = 'ontrack://auth/callback';
  const url = `${redirect}?code=one-time-code`;

  beforeEach(() => {
    resetOAuthCallbackExchangeForTests();
    mockExchangeCodeForSession.mockReset();
    mockSignInWithOAuth.mockReset();
    mockOpenAuthSessionAsync.mockReset();
  });

  it('opens the Google account chooser after an app-local sign-out', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://accounts.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });

    await expect(beginBrowserSignIn('google')).rejects.toBeInstanceOf(ProviderCancelledError);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        queryParams: { prompt: 'select_account' },
      }),
    });
  });

  it('retries after a failed exchange instead of caching the failure', async () => {
    mockExchangeCodeForSession
      .mockResolvedValueOnce({ data: { session: null }, error: { message: 'network blip' } })
      .mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'token',
            user: { id: 'user-1' },
          },
        },
        error: null,
      });

    await expect(exchangeOAuthCallback(url)).rejects.toBeInstanceOf(CloudAccountError);
    const session = await exchangeOAuthCallback(url);
    expect(session?.user.id).toBe('user-1');
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(2);
  });

  it('rejects a successful response that did not establish a session', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(exchangeOAuthCallback(url)).rejects.toThrow(/establish a session/i);
  });
});
