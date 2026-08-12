import {
  resetAccountDataFlow,
  type AuthExitControls,
} from '@/features/auth/auth-account-exit';

const mockResetOwnCloudData = jest.fn();
const mockClearLocalAccountData = jest.fn();
const mockResumeCloudSyncAfterReset = jest.fn();
const mockFriendsClear = jest.fn();
const mockResetAccess = jest.fn();

jest.mock('@/services/cloud/account', () => ({
  accessibleAuthError: (error: unknown) =>
    error instanceof Error ? error.message : 'Account operation failed.',
  deleteOwnCloudAccount: jest.fn(),
  resetOwnCloudData: (...args: unknown[]) => mockResetOwnCloudData(...args),
  signOutLocalSession: jest.fn(),
}));

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: () => null,
}));

jest.mock('@/services/cloud/sync', () => ({
  clearLocalAccountData: (...args: unknown[]) => mockClearLocalAccountData(...args),
  flushCloudSync: jest.fn(),
  resumeCloudSyncAfterReset: (...args: unknown[]) => mockResumeCloudSyncAfterReset(...args),
}));

jest.mock('@/store/friends', () => ({
  useFriends: { getState: () => ({ clear: mockFriendsClear }) },
}));

jest.mock('@/store/auth-access', () => ({
  useAuthAccess: { getState: () => ({ resetAccess: mockResetAccess }) },
}));

function controls(): AuthExitControls & {
  setPhase: jest.Mock;
  setSession: jest.Mock;
  setError: jest.Mock;
} {
  return {
    setPhase: jest.fn(),
    setSession: jest.fn(),
    setError: jest.fn(),
    invalidateInit: jest.fn(),
    setExplicitSignOut: jest.fn(),
    clearLock: jest.fn(),
  };
}

const signedInSession = {
  user: { id: 'test-user', email: 'synthetic@example.com' },
} as import('@supabase/supabase-js').Session;

describe('resetAccountDataFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetOwnCloudData.mockResolvedValue(undefined);
    mockClearLocalAccountData.mockResolvedValue(undefined);
  });

  it('resets cloud and local content while keeping the signed-in session active', async () => {
    const target = controls();

    await expect(resetAccountDataFlow(signedInSession, target)).resolves.toEqual({
      status: 'reset',
    });

    expect(mockResetOwnCloudData).toHaveBeenCalledTimes(1);
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({
      markSignedOut: false,
      preserveAccountAccess: true,
      preserveAccountFlags: true,
    });
    expect(mockFriendsClear).toHaveBeenCalledTimes(1);
    expect(mockResetAccess).not.toHaveBeenCalled();
    expect(mockResumeCloudSyncAfterReset).toHaveBeenCalledWith(
      'test-user',
      'synthetic@example.com',
    );
    expect(target.setSession).not.toHaveBeenCalled();
    expect(target.setPhase.mock.calls).toEqual([['loading'], ['authenticated']]);
  });

  it('performs a device-only reset for guests and returns to welcome', async () => {
    const target = controls();

    await expect(resetAccountDataFlow(null, target)).resolves.toEqual({ status: 'reset' });

    expect(mockResetOwnCloudData).not.toHaveBeenCalled();
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({
      markSignedOut: false,
      preserveAccountAccess: false,
      preserveAccountFlags: false,
    });
    expect(mockResetAccess).toHaveBeenCalledTimes(1);
    expect(mockResumeCloudSyncAfterReset).not.toHaveBeenCalled();
    expect(target.setPhase.mock.calls).toEqual([['loading'], ['welcome']]);
  });

  it('does not wipe local data when the cloud purge fails', async () => {
    const target = controls();
    mockResetOwnCloudData.mockRejectedValueOnce(new Error('cloud purge failed'));

    await expect(resetAccountDataFlow(signedInSession, target)).resolves.toEqual({
      status: 'failed',
      message: 'cloud purge failed',
    });

    expect(mockClearLocalAccountData).not.toHaveBeenCalled();
    expect(mockFriendsClear).not.toHaveBeenCalled();
    expect(mockResumeCloudSyncAfterReset).not.toHaveBeenCalled();
    expect(target.setError).toHaveBeenCalledWith('cloud purge failed');
    expect(target.setPhase.mock.calls).toEqual([['loading'], ['authenticated']]);
  });
});
