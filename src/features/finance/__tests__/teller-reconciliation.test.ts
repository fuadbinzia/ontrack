import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { applyTellerSyncResult } from '../apply-teller-link';
import { createFinanceTransaction } from '../create';
import { useFinance } from '@/store/finance';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('Teller local reconciliation', () => {
  beforeEach(() => useFinance.getState().reset());

  it('creates provider-neutral accounts and preserves identity on later syncs', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyTellerSyncResult({
      ok: true,
      connectionId: 'enr-1',
      institutionName: 'Example Bank',
      accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank', balance: 100 }],
      transactions: [{
        externalId: 'txn-1', accountId: 'acc-1', amount: 12, date: '2026-08-01', merchant: 'Cafe',
      }],
      syncStatus: 'ready',
    }, entityId, 'USD');
    const first = useFinance.getState().accounts[0]!;
    const firstTransaction = useFinance.getState().transactions[0]!;
    useFinance.getState().saveTransaction({
      ...firstTransaction,
      categoryId: 'dining',
    });
    expect(first).toMatchObject({
      provider: 'teller', connectionId: 'enr-1', externalAccountId: 'acc-1',
      institutionName: 'Example Bank',
    });
    expect(first.plaidItemId).toBeUndefined();

    applyTellerSyncResult({
      ok: true,
      connectionId: 'enr-1',
      institutionName: 'Example Bank',
      accounts: [{ accountId: 'acc-1', name: 'Checking Plus', kind: 'bank', balance: 125 }],
      transactions: [{
        externalId: 'txn-1', accountId: 'acc-1', amount: 15, date: '2026-08-02', merchant: 'Cafe',
      }],
      refreshedFrom: '2026-07-25',
      syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().accounts[0]).toMatchObject({ id: first.id, balance: 125 });
    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({
        externalId: 'txn-1',
        amount: 15,
        source: 'teller',
        categoryId: 'dining',
      }),
    ]);
  });

  it('inherits a known category when Teller imports another matching merchant', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyTellerSyncResult({
      ok: true,
      connectionId: 'enr-1',
      accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [{
        externalId: 'passny-old', accountId: 'acc-1', amount: 25,
        date: '2026-08-10', merchant: 'Passny',
      }],
      syncStatus: 'ready',
    }, entityId, 'USD');
    useFinance.getState().categorizeMerchantTransactions('Passny', 'ezpass_replenishment');

    applyTellerSyncResult({
      ok: true,
      connectionId: 'enr-1',
      accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [
        {
          externalId: 'passny-old', accountId: 'acc-1', amount: 25,
          date: '2026-08-10', merchant: 'Passny',
        },
        {
          externalId: 'passny-new', accountId: 'acc-1', amount: 25,
          date: '2026-08-13', merchant: 'PASS NY',
        },
      ],
      refreshedFrom: '2026-08-01',
      syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: 'passny-new',
        categoryId: 'ezpass_replenishment',
      }),
    ]));
  });

  it('removes missing Teller rows only inside the refreshed window and keeps manual data', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyTellerSyncResult({
      ok: true, connectionId: 'enr-1', accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [
        { externalId: 'old', accountId: 'acc-1', amount: 1, date: '2026-01-01', merchant: 'Old' },
        { externalId: 'recent', accountId: 'acc-1', amount: 2, date: '2026-08-10', merchant: 'Recent' },
      ], syncStatus: 'ready',
    }, entityId, 'USD');
    const accountId = useFinance.getState().accounts[0]!.id;
    useFinance.getState().saveTransaction(createFinanceTransaction({
      amount: 3, date: '2026-08-10', merchant: 'Manual', categoryId: 'other', entityId,
      accountId, source: 'manual',
    }));

    applyTellerSyncResult({
      ok: true, connectionId: 'enr-1', accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [], refreshedFrom: '2026-08-01', syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalId: 'old' }),
      expect.objectContaining({ source: 'manual', merchant: 'Manual' }),
    ]));
    expect(useFinance.getState().transactions.some((row) => row.externalId === 'recent')).toBe(false);
  });

  it('disconnect cleanup removes Teller imports and detaches manual rows', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyTellerSyncResult({
      ok: true, connectionId: 'enr-1', accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [{ externalId: 'txn-1', accountId: 'acc-1', amount: 2, date: '2026-08-10', merchant: 'Cafe' }],
      syncStatus: 'ready',
    }, entityId, 'USD');
    const accountId = useFinance.getState().accounts[0]!.id;
    useFinance.getState().saveTransaction(createFinanceTransaction({
      amount: 3, date: '2026-08-10', merchant: 'Manual', categoryId: 'other', entityId,
      accountId, source: 'manual',
    }));

    useFinance.getState().removeConnection('teller', 'enr-1');

    expect(useFinance.getState().accounts).toEqual([]);
    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({ source: 'manual', accountId: undefined }),
    ]);
  });

  it('removes imported rows for an account no longer returned by Teller', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyTellerSyncResult({
      ok: true, connectionId: 'enr-1', accounts: [
        { accountId: 'acc-1', name: 'Checking', kind: 'bank' },
        { accountId: 'acc-2', name: 'Closed card', kind: 'card' },
      ],
      transactions: [{
        externalId: 'closed-txn', accountId: 'acc-2', amount: 2,
        date: '2026-08-10', merchant: 'Cafe',
      }],
      syncStatus: 'ready',
    }, entityId, 'USD');

    applyTellerSyncResult({
      ok: true, connectionId: 'enr-1',
      accounts: [{ accountId: 'acc-1', name: 'Checking', kind: 'bank' }],
      transactions: [], refreshedFrom: '2026-08-01', syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().accounts.map((account) => account.externalAccountId)).toEqual(['acc-1']);
    expect(useFinance.getState().transactions).toEqual([]);
  });
});
