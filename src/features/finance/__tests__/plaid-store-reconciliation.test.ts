import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { createFinanceAccount, createFinanceHolding, createFinanceTransaction } from '../create';
import { useFinance } from '@/store/finance';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('Plaid local reconciliation', () => {
  beforeEach(() => useFinance.getState().reset());

  it('replaces a current holdings snapshot so sold positions disappear', () => {
    const account = createFinanceAccount({
      name: 'Brokerage',
      kind: 'brokerage',
      currency: 'USD',
      linkStatus: 'linked',
      plaidItemId: 'item-1',
      plaidAccountId: 'plaid-account-1',
    });
    useFinance.getState().saveAccount(account);
    useFinance.getState().saveHolding(createFinanceHolding({
      accountId: account.id,
      name: 'Sold Fund',
      value: 100,
      currency: 'USD',
      asOf: '2026-08-10',
      externalId: 'sold-security',
    }));

    useFinance.getState().replacePlaidHoldings([account.id], [
      createFinanceHolding({
        accountId: account.id,
        name: 'Current Fund',
        value: 250,
        currency: 'USD',
        asOf: '2026-08-12',
        externalId: 'current-security',
      }),
    ]);

    expect(useFinance.getState().holdings.map((holding) => holding.externalId)).toEqual([
      'current-security',
    ]);
  });

  it('preserves holding identity and positions outside the refreshed Plaid accounts', () => {
    const refreshed = createFinanceAccount({
      name: 'Brokerage',
      kind: 'brokerage',
      currency: 'USD',
      linkStatus: 'linked',
      plaidItemId: 'item-1',
      plaidAccountId: 'plaid-account-1',
    });
    const untouched = createFinanceAccount({
      name: 'Retirement',
      kind: 'retirement_401k',
      currency: 'USD',
      linkStatus: 'linked',
      plaidItemId: 'item-2',
      plaidAccountId: 'plaid-account-2',
    });
    useFinance.getState().saveAccount(refreshed);
    useFinance.getState().saveAccount(untouched);
    const prior = createFinanceHolding({
      id: 'stable-holding-id',
      accountId: refreshed.id,
      name: 'Index Fund',
      value: 100,
      currency: 'USD',
      asOf: '2026-08-10',
      externalId: 'security-1',
    });
    const otherItem = createFinanceHolding({
      accountId: untouched.id,
      name: 'Target Fund',
      value: 300,
      currency: 'USD',
      asOf: '2026-08-10',
      externalId: 'security-2',
    });
    useFinance.getState().saveHolding(prior);
    useFinance.getState().saveHolding(otherItem);

    useFinance.getState().replacePlaidHoldings([refreshed.id], [
      createFinanceHolding({
        accountId: refreshed.id,
        name: 'Index Fund',
        value: 125,
        currency: 'USD',
        asOf: '2026-08-12',
        externalId: 'security-1',
      }),
    ]);

    expect(useFinance.getState().holdings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'stable-holding-id', externalId: 'security-1', value: 125 }),
        expect.objectContaining({ id: otherItem.id, externalId: 'security-2', value: 300 }),
      ]),
    );
  });

  it('updates and removes Plaid transactions without duplicating modified rows', () => {
    const prior = createFinanceTransaction({
      id: 'stable-transaction-id',
      amount: 10,
      date: '2026-08-10',
      merchant: 'Old merchant',
      categoryId: 'dining',
      entityId: 'personal',
      source: 'plaid',
      externalId: 'modified-1',
    });
    const removed = createFinanceTransaction({
      amount: 30,
      date: '2026-08-10',
      merchant: 'Removed merchant',
      categoryId: 'other',
      entityId: 'personal',
      source: 'plaid',
      externalId: 'removed-1',
    });
    useFinance.getState().saveTransaction(prior);
    useFinance.getState().saveTransaction(removed);

    useFinance.getState().reconcilePlaidTransactions([
      createFinanceTransaction({
        amount: 15,
        date: '2026-08-11',
        merchant: 'Updated merchant',
        categoryId: 'other',
        entityId: 'personal',
        source: 'plaid',
        externalId: 'modified-1',
      }),
    ], ['removed-1']);

    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({
        id: 'stable-transaction-id',
        externalId: 'modified-1',
        amount: 15,
        merchant: 'Updated merchant',
        categoryId: 'dining',
      }),
    ]);
  });

  it('inherits a known category for new transactions from the same merchant', () => {
    useFinance.getState().saveTransaction(createFinanceTransaction({
      amount: 25,
      date: '2026-08-10',
      merchant: 'Passny',
      categoryId: 'ezpass_replenishment',
      entityId: 'personal',
      source: 'plaid',
      externalId: 'passny-old',
    }));

    useFinance.getState().reconcilePlaidTransactions([
      createFinanceTransaction({
        amount: 25,
        date: '2026-08-13',
        merchant: 'PASS-NY',
        categoryId: 'other',
        entityId: 'personal',
        source: 'plaid',
        externalId: 'passny-new',
      }),
    ], []);

    expect(useFinance.getState().transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        externalId: 'passny-new',
        categoryId: 'ezpass_replenishment',
      }),
    ]));
  });

  it('removes every local row owned by a disconnected Item', () => {
    const linked = createFinanceAccount({
      name: 'Checking',
      kind: 'bank',
      currency: 'USD',
      linkStatus: 'linked',
      plaidItemId: 'item-1',
      plaidAccountId: 'plaid-account-1',
    });
    const manual = createFinanceAccount({
      name: 'Cash',
      kind: 'cash',
      currency: 'USD',
      linkStatus: 'manual',
    });
    useFinance.getState().saveAccount(linked);
    useFinance.getState().saveAccount(manual);
    useFinance.getState().saveTransaction(createFinanceTransaction({
      amount: 10,
      date: '2026-08-12',
      merchant: 'Cafe',
      categoryId: 'dining',
      entityId: 'personal',
      accountId: linked.id,
      source: 'plaid',
      externalId: 'transaction-1',
    }));
    const manualOnLinkedAccount = createFinanceTransaction({
      amount: 12,
      date: '2026-08-12',
      merchant: 'Manual expense',
      categoryId: 'dining',
      entityId: 'personal',
      accountId: linked.id,
      source: 'manual',
    });
    useFinance.getState().saveTransaction(manualOnLinkedAccount);
    useFinance.getState().saveHolding(createFinanceHolding({
      accountId: linked.id,
      name: 'Linked holding',
      value: 100,
      currency: 'USD',
      asOf: '2026-08-12',
      externalId: 'holding-1',
    }));

    useFinance.getState().removePlaidItem('item-1');

    expect(useFinance.getState().accounts.map((account) => account.id)).toEqual([manual.id]);
    expect(useFinance.getState().holdings).toEqual([]);
    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({ id: manualOnLinkedAccount.id, accountId: undefined }),
    ]);
  });
});
