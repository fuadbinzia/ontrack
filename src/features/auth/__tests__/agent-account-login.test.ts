import { signInAgentTestAccount } from '../agent-account-login';

const auth = {
  getSession: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(async () => ({ error: null })),
};

let mockFlagResult: { data: { agent_test?: boolean } | null; error: unknown } = {
  data: { agent_test: true },
  error: null,
};

const mockClient = {
  auth,
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(async () => mockFlagResult),
      })),
    })),
  })),
};

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockClient),
}));

const mockLoadAccountFlags = jest.fn(async () => undefined);
jest.mock('@/services/cloud/account-flags', () => ({
  loadAccountFlags: (userId: string) => mockLoadAccountFlags(userId),
}));

function session(user: { id: string; email: string } | null) {
  return { data: { session: user ? { user } : null }, error: null };
}

describe('agent account sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlagResult = { data: { agent_test: true }, error: null };
    auth.getSession.mockResolvedValue(session(null));
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('never signs in outside __DEV__ builds', async () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const result = await signInAgentTestAccount({
        email: 'agent_1@example.com',
        password: 'test-only',
      });
      expect(result.ok).toBe(false);
      expect(result.detail).toContain('__DEV__');
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in an agent_test account and loads its flags', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'agent-1', email: 'agent_1@example.com' } },
      error: null,
    });

    const result = await signInAgentTestAccount({
      email: 'Agent_1@Example.com',
      password: 'test-only',
    });

    expect(result).toMatchObject({ ok: true, userId: 'agent-1' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'agent_1@example.com',
      password: 'test-only',
    });
    expect(mockLoadAccountFlags).toHaveBeenCalledWith('agent-1');
  });

  it('signs back out when the account is not flagged agent_test', async () => {
    mockFlagResult = { data: { agent_test: false }, error: null };
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'real-user', email: 'person@example.com' } },
      error: null,
    });

    const result = await signInAgentTestAccount({
      email: 'person@example.com',
      password: 'test-only',
    });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('agent_test');
    expect(auth.signOut).toHaveBeenCalled();
    expect(mockLoadAccountFlags).not.toHaveBeenCalled();
  });

  it('clears local data before switching away from another account', async () => {
    auth.getSession.mockResolvedValue(
      session({ id: 'other', email: 'agent_2@example.com' }),
    );
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'agent-1', email: 'agent_1@example.com' } },
      error: null,
    });
    const onAccountSwitch = jest.fn(async () => undefined);

    const result = await signInAgentTestAccount({
      email: 'agent_1@example.com',
      password: 'test-only',
      onAccountSwitch,
    });

    expect(result.ok).toBe(true);
    expect(auth.signOut).toHaveBeenCalled();
    expect(onAccountSwitch).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the same agent account is already signed in', async () => {
    auth.getSession.mockResolvedValue(
      session({ id: 'agent-1', email: 'agent_1@example.com' }),
    );

    const result = await signInAgentTestAccount({
      email: 'agent_1@example.com',
      password: 'test-only',
    });

    expect(result).toMatchObject({ ok: true, userId: 'agent-1' });
    expect(result.detail).toContain('already signed in');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('reports the provider error without leaking the password', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await signInAgentTestAccount({
      email: 'agent_1@example.com',
      password: 'wrong-password',
    });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Invalid login credentials');
    expect(result.detail).not.toContain('wrong-password');
  });
});
