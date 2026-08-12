import {
  CloudAccountError,
  deleteOwnCloudAccount,
  resetOwnCloudData,
} from '@/services/cloud/account';

const mockRpc = jest.fn();
const mockRemove = jest.fn();
const mockSignOut = jest.fn();
const mockStorageFrom = jest.fn(() => ({ remove: mockRemove }));
const mockClient = {
  rpc: mockRpc,
  storage: { from: mockStorageFrom },
  auth: { signOut: mockSignOut },
};

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: () => mockClient,
}));

function storageRows(bucket: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    bucket_id: bucket,
    name: `user/file-${index}.jpg`,
  }));
}

describe('destructive cloud account operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'list_own_storage_objects') return { data: [], error: null };
      return { data: null, error: null };
    });
    mockRemove.mockResolvedValue({ data: [], error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('removes every listed object in per-bucket batches before resetting rows', async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'list_own_storage_objects') {
        return {
          data: [
            ...storageRows('app-media', 1_001),
            ...storageRows('profile-avatars', 2),
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    await resetOwnCloudData();

    expect(mockStorageFrom).toHaveBeenNthCalledWith(1, 'app-media');
    expect(mockStorageFrom).toHaveBeenNthCalledWith(2, 'app-media');
    expect(mockStorageFrom).toHaveBeenNthCalledWith(3, 'profile-avatars');
    expect(mockRemove.mock.calls.map(([names]) => names.length)).toEqual([1_000, 1, 2]);
    expect(mockRpc).toHaveBeenLastCalledWith('reset_own_data');
    expect(mockRemove.mock.invocationCallOrder[2]).toBeLessThan(
      mockRpc.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('never purges database rows when Storage API deletion fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ bucket_id: 'app-media', name: 'user/photo.jpg' }],
      error: null,
    });
    mockRemove.mockResolvedValueOnce({ data: null, error: { message: 'storage unavailable' } });

    await expect(resetOwnCloudData()).rejects.toThrow(CloudAccountError);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalledWith('reset_own_data');
  });

  it('never starts deletion when owned-object discovery fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'list denied' } });

    await expect(deleteOwnCloudAccount()).rejects.toThrow('list denied');

    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalledWith('delete_own_account');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('deletes media, then auth data, and tolerates post-delete local sign-out errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ bucket_id: 'meal-photos', name: 'user/meal.jpg' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    mockSignOut.mockResolvedValueOnce({ error: { message: 'user is already gone' } });

    await expect(deleteOwnCloudAccount()).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'list_own_storage_objects');
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'delete_own_account');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockRemove.mock.invocationCallOrder[0]).toBeLessThan(
      mockRpc.mock.invocationCallOrder[1],
    );
    expect(mockRpc.mock.invocationCallOrder[1]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });
});
