import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { applyPlaidExchangeResult, applyPlaidSyncResult } from '../apply-plaid-link';
import { createFinanceTransaction } from '../create';
import { useFinance } from '@/store/finance';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('applying Plaid server results', () => {
  beforeEach(() => useFinance.getState().reset());

  it('maps each expense to its Plaid account and ignores transactions for unknown accounts', () => {
    const entityId = useFinance.getState().entities[0]!.id;

    applyPlaidExchangeResult({
      ok: true,
      itemId: 'item-1',
      institutionName: 'Example Bank',
      purpose: 'transactions',
      accounts: [
        {
          accountId: 'checking-1',
          name: 'Checking',
          kind: 'bank',
          currency: 'USD',
        },
        {
          accountId: 'card-1',
          name: 'Card',
          kind: 'card',
          currency: 'USD',
        },
      ],
      holdings: [],
      transactions: [
        {
          externalId: 'checking-expense',
          accountId: 'checking-1',
          amount: 20,
          date: '2026-08-11',
          merchant: 'Market',
        },
        {
          externalId: 'card-expense',
          accountId: 'card-1',
          amount: 30,
          date: '2026-08-12',
          merchant: 'Cafe',
        },
        {
          externalId: 'unknown-expense',
          accountId: 'missing-account',
          amount: 40,
          date: '2026-08-12',
          merchant: 'Unknown',
        },
      ],
      removedExternalIds: [],
      syncStatus: 'ready',
    }, entityId, 'USD');

    const state = useFinance.getState();
    const checking = state.accounts.find((account) => account.plaidAccountId === 'checking-1');
    const card = state.accounts.find((account) => account.plaidAccountId === 'card-1');
    expect(state.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'checking-expense', accountId: checking?.id }),
        expect.objectContaining({ externalId: 'card-expense', accountId: card?.id }),
      ]),
    );
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.some((row) => row.externalId === 'unknown-expense')).toBe(false);
  });

  it('replaces a pending placeholder with real accounts and preserves the Item identity', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    applyPlaidExchangeResult({
      ok: true,
      itemId: 'item-pending',
      institutionName: 'Example Bank',
      purpose: 'transactions',
      accounts: [],
      holdings: [],
      transactions: [],
      removedExternalIds: [],
      syncStatus: 'pending',
    }, entityId, 'USD');

    const placeholder = useFinance.getState().accounts[0];
    expect(placeholder).toMatchObject({
      plaidItemId: 'item-pending',
      linkStatus: 'pending',
    });
    expect(placeholder?.plaidAccountId).toBeUndefined();

    applyPlaidSyncResult('item-pending', {
      ok: true,
      purpose: 'transactions',
      accounts: [
        {
          accountId: 'checking-real',
          name: 'Checking',
          kind: 'bank',
          currency: 'USD',
        },
      ],
      holdings: [],
      transactions: [],
      removedExternalIds: [],
      syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().accounts).toEqual([
      expect.objectContaining({
        plaidItemId: 'item-pending',
        plaidAccountId: 'checking-real',
        linkStatus: 'linked',
        plaidInstitutionName: 'Example Bank',
      }),
    ]);
    expect(useFinance.getState().accounts[0]?.id).not.toBe(placeholder?.id);
  });

  it('surfaces initial sync failure on the linked placeholder instead of false success', () => {
    const entityId = useFinance.getState().entities[0]!.id;

    applyPlaidExchangeResult({
      ok: true,
      itemId: 'item-error',
      institutionName: 'Example Bank',
      purpose: 'investments',
      accounts: [],
      holdings: [],
      transactions: [],
      removedExternalIds: [],
      syncStatus: 'error',
      syncError: 'Holdings are temporarily unavailable.',
    }, entityId, 'USD');

    expect(useFinance.getState().accounts).toEqual([
      expect.objectContaining({
        plaidItemId: 'item-error',
        kind: 'other_investment',
        linkStatus: 'error',
      }),
    ]);
  });

  it('applies server removals while retaining unrelated local transactions', () => {
    const entityId = useFinance.getState().entities[0]!.id;
    const unrelated = createFinanceTransaction({
      amount: 8,
      date: '2026-08-12',
      merchant: 'Manual entry',
      categoryId: 'other',
      entityId,
      source: 'manual',
    });
    const removed = createFinanceTransaction({
      amount: 18,
      date: '2026-08-11',
      merchant: 'Pending expense',
      categoryId: 'other',
      entityId,
      source: 'plaid',
      externalId: 'removed-by-plaid',
    });
    useFinance.getState().saveTransaction(unrelated);
    useFinance.getState().saveTransaction(removed);

    applyPlaidExchangeResult({
      ok: true,
      itemId: 'item-1',
      institutionName: 'Example Bank',
      purpose: 'transactions',
      accounts: [],
      holdings: [],
      transactions: [],
      removedExternalIds: ['removed-by-plaid'],
      syncStatus: 'ready',
    }, entityId, 'USD');

    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({ id: unrelated.id, source: 'manual' }),
    ]);
  });
});
