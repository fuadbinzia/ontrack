import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useFinance } from '@/store/finance';

import { createFinanceAccount } from '../create';
import {
  financeSubscriptionConnections,
  refreshFinanceSubscriptions,
} from '../refresh-finance-subscriptions';

const mockSyncPlaidItem = jest.fn();
const mockSyncTellerEnrollment = jest.fn();
const mockApplyPlaidSyncResult = jest.fn();
const mockApplyTellerSyncResult = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@/services/finance', () => ({
  syncPlaidItem: (...args: unknown[]) => mockSyncPlaidItem(...args),
  syncTellerEnrollment: (...args: unknown[]) => mockSyncTellerEnrollment(...args),
}));
jest.mock('../apply-plaid-link', () => ({
  applyPlaidSyncResult: (...args: unknown[]) => mockApplyPlaidSyncResult(...args),
}));
jest.mock('../apply-teller-link', () => ({
  applyTellerSyncResult: (...args: unknown[]) => mockApplyTellerSyncResult(...args),
}));

function account(input: {
  id: string;
  provider?: 'plaid' | 'teller';
  connectionId?: string;
  plaidItemId?: string;
}) {
  return createFinanceAccount({
    id: input.id,
    name: `Account ${input.id}`,
    kind: 'card',
    currency: 'USD',
    linkStatus: 'linked',
    provider: input.provider,
    connectionId: input.connectionId,
    plaidItemId: input.plaidItemId,
  });
}

describe('Finance subscription refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFinance.getState().reset();
  });

  it('deduplicates accounts that belong to the same connection and supports legacy Plaid items', () => {
    expect(financeSubscriptionConnections([
      account({ id: 'one', provider: 'plaid', connectionId: 'item-1' }),
      account({ id: 'two', provider: 'plaid', connectionId: 'item-1' }),
      account({ id: 'three', provider: 'teller', connectionId: 'enrollment-1' }),
      account({ id: 'legacy', plaidItemId: 'legacy-item' }),
    ])).toEqual([
      { provider: 'plaid', connectionId: 'item-1' },
      { provider: 'teller', connectionId: 'enrollment-1' },
      { provider: 'plaid', connectionId: 'legacy-item' },
    ]);
  });

  it('refreshes every unique provider connection and reports partial failures', async () => {
    useFinance.getState().saveAccount(
      account({ id: 'plaid', provider: 'plaid', connectionId: 'item-1' }),
    );
    useFinance.getState().saveAccount(
      account({ id: 'teller', provider: 'teller', connectionId: 'enrollment-1' }),
    );
    mockSyncPlaidItem.mockResolvedValue({
      ok: true,
      purpose: 'transactions',
      accounts: [],
      holdings: [],
      transactions: [],
      removedExternalIds: [],
      syncStatus: 'ready',
    });
    mockSyncTellerEnrollment.mockResolvedValue({
      ok: false,
      configured: true,
      error: 'Teller is unavailable.',
    });

    await expect(refreshFinanceSubscriptions('personal', 'USD')).resolves.toEqual({
      connectionCount: 2,
      syncedCount: 1,
      transactionCount: 0,
      candidateCount: 0,
      errors: ['Teller is unavailable.'],
    });
    expect(mockSyncPlaidItem).toHaveBeenCalledWith('item-1');
    expect(mockApplyPlaidSyncResult).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ ok: true }),
      'personal',
      'USD',
    );
    expect(mockSyncTellerEnrollment).toHaveBeenCalledWith('enrollment-1');
    expect(mockApplyTellerSyncResult).not.toHaveBeenCalled();
  });

  it('returns an empty result without making provider calls when nothing is linked', async () => {
    await expect(refreshFinanceSubscriptions('personal', 'USD')).resolves.toEqual({
      connectionCount: 0,
      syncedCount: 0,
      transactionCount: 0,
      candidateCount: 0,
      errors: [],
    });
    expect(mockSyncPlaidItem).not.toHaveBeenCalled();
    expect(mockSyncTellerEnrollment).not.toHaveBeenCalled();
  });
});
