/* eslint-disable import/first -- Jest mocks must initialize before the module under test. */
const mockGetSupabaseClient = jest.fn();

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

import {
  addEzPassFriendMembers,
  EzPassCollaborationError,
  loadEzPassSharedLedgers,
  removeEzPassMember,
  setEzPassMemberRole,
  syncOwnedEzPassTransactions,
  tagEzPassSharedTransaction,
} from '../ezpass-collaboration';

function authenticatedClient() {
  const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-synthetic' } } },
        error: null,
      }),
    },
    rpc,
  };
  mockGetSupabaseClient.mockReturnValue(client);
  return { client, rpc };
}

describe('E-ZPass collaboration RPC boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires a configured signed-in Supabase client before data access', async () => {
    mockGetSupabaseClient.mockReturnValueOnce(undefined);
    await expect(loadEzPassSharedLedgers()).rejects.toThrow(EzPassCollaborationError);

    const { client } = authenticatedClient();
    client.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(loadEzPassSharedLedgers()).rejects.toThrow('Sign in to share an E-ZPass ledger.');
  });

  it('loads and normalizes the current user ledger snapshots', async () => {
    const { rpc } = authenticatedClient();
    rpc.mockResolvedValueOnce({
      data: [{
        id: 'ledger-synthetic',
        ownerUserId: 'user-synthetic',
        role: 'owner',
        members: [],
        transactions: [],
      }],
      error: null,
    });

    await expect(loadEzPassSharedLedgers()).resolves.toMatchObject({
      userId: 'user-synthetic',
      ledgers: [{ id: 'ledger-synthetic', role: 'owner' }],
    });
    expect(rpc).toHaveBeenCalledWith('ezpass_ledger_snapshots');
  });

  it('syncs only deduplicated E-ZPass transactions through the owned-ledger RPC', async () => {
    const { rpc } = authenticatedClient();
    rpc.mockResolvedValueOnce({ data: 'ledger-synthetic', error: null });

    await expect(syncOwnedEzPassTransactions([
      {
        id: 'toll-synthetic',
        date: '2026-08-14',
        merchant: 'Synthetic Toll',
        amount: 4.5,
        currency: 'USD',
        categoryId: 'transport',
        entityId: 'entity-synthetic',
        source: 'ezpass',
        createdAt: '2026-08-14T12:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
      },
      {
        id: 'manual-synthetic',
        date: '2026-08-14',
        merchant: 'Manual Expense',
        amount: 10,
        currency: 'USD',
        categoryId: 'other',
        entityId: 'entity-synthetic',
        source: 'manual',
        createdAt: '2026-08-14T12:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
      },
    ])).resolves.toBe('ledger-synthetic');
    expect(rpc).toHaveBeenCalledWith('sync_ezpass_transactions', {
      transactions_payload: [expect.objectContaining({ id: 'toll-synthetic' })],
    });
  });

  it('uses separate friend and existing-ledger membership RPCs', async () => {
    const { rpc } = authenticatedClient();

    await addEzPassFriendMembers({ userIds: ['friend-synthetic'] });
    await addEzPassFriendMembers({
      ledgerId: 'ledger-synthetic',
      userIds: ['friend-synthetic'],
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'add_ezpass_friend_members', {
      requested_user_ids: ['friend-synthetic'],
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'add_ezpass_ledger_members', {
      requested_ledger_id: 'ledger-synthetic',
      requested_user_ids: ['friend-synthetic'],
    });
  });

  it('routes role, removal, and tag mutations with server-shaped arguments', async () => {
    const { rpc } = authenticatedClient();

    await setEzPassMemberRole({
      ledgerId: 'ledger-synthetic', userId: 'friend-synthetic', role: 'cohost',
    });
    await removeEzPassMember({ ledgerId: 'ledger-synthetic', userId: 'friend-synthetic' });
    await tagEzPassSharedTransaction({
      ledgerId: 'ledger-synthetic',
      transactionId: 'transaction-synthetic',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'set_ezpass_member_role', {
      requested_ledger_id: 'ledger-synthetic',
      requested_user_id: 'friend-synthetic',
      requested_role: 'cohost',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'remove_ezpass_ledger_member', {
      requested_ledger_id: 'ledger-synthetic',
      requested_user_id: 'friend-synthetic',
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'tag_ezpass_transaction', {
      requested_ledger_id: 'ledger-synthetic',
      requested_transaction_id: 'transaction-synthetic',
      requested_user_id: null,
    });
  });

  it('surfaces database mutation failures with a safe collaboration error', async () => {
    const { rpc } = authenticatedClient();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Synthetic database rejection' } });

    await expect(removeEzPassMember({
      ledgerId: 'ledger-synthetic', userId: 'friend-synthetic',
    })).rejects.toThrow('Synthetic database rejection');
  });
});
