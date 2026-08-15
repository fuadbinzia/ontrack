import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useFinance } from '@/store/finance';

import { createFinanceTransaction } from '../create';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function transaction(id: string, amount: number) {
  return createFinanceTransaction({
    id,
    amount,
    date: '2026-08-14',
    merchant: `Merchant ${id}`,
    categoryId: 'other',
    entityId: 'personal',
  });
}

describe('Finance store', () => {
  beforeEach(() => useFinance.getState().reset());

  it('batch-upserts transactions in one state change while preserving stable order', () => {
    useFinance.getState().saveTransactions([
      transaction('existing', 10),
      transaction('untouched', 20),
    ]);

    useFinance.getState().saveTransactions([
      transaction('existing', 15),
      transaction('new', 30),
      transaction('new', 35),
    ]);

    expect(useFinance.getState().transactions.map(({ id, amount }) => ({ id, amount }))).toEqual([
      { id: 'existing', amount: 15 },
      { id: 'untouched', amount: 20 },
      { id: 'new', amount: 35 },
    ]);
  });

  it('does not update Finance state for an empty batch', () => {
    const before = useFinance.getState().updatedAt;
    useFinance.getState().saveTransactions([]);
    expect(useFinance.getState().updatedAt).toBe(before);
  });

  it('repairs already-imported CSV and PDF E-ZPass duplicates', () => {
    const shared = {
      amount: 2.25,
      date: '2026-08-13',
      categoryId: 'transport',
      entityId: 'personal',
      source: 'ezpass' as const,
      activity: 'expense' as const,
      activityTime: '16:25:15',
    };
    useFinance.setState({
      transactions: [
        createFinanceTransaction({ ...shared, id: 'pdf', merchant: 'Gsp' }),
        createFinanceTransaction({
          ...shared,
          id: 'csv',
          merchant: 'UNI - Union',
          ezPassFriendId: 'friend-synthetic',
          ezPassFriendName: 'Sample Friend',
        }),
      ],
    });

    useFinance.getState().repairEzPassDuplicates();

    expect(useFinance.getState().transactions).toEqual([
      expect.objectContaining({
        id: 'csv',
        merchant: 'UNI - Union',
        ezPassFriendId: 'friend-synthetic',
      }),
    ]);
  });

  it('applies a selected category to every matching merchant transaction', () => {
    useFinance.getState().saveTransactions([
      createFinanceTransaction({
        id: 'passny-one', amount: 25, date: '2026-08-13', merchant: 'Passny',
        categoryId: 'other', entityId: 'personal', source: 'plaid',
      }),
      createFinanceTransaction({
        id: 'passny-two', amount: 25, date: '2026-08-12', merchant: 'PASS-NY',
        categoryId: 'other', entityId: 'personal', source: 'teller',
      }),
      createFinanceTransaction({
        id: 'passny-cafe', amount: 12, date: '2026-08-11', merchant: 'Passny Cafe',
        categoryId: 'other', entityId: 'personal', source: 'manual',
      }),
    ]);

    useFinance.getState().categorizeMerchantTransactions(
      'Pass ny',
      'ezpass_replenishment',
    );

    expect(useFinance.getState().transactions.map(({ id, categoryId }) => ({ id, categoryId })))
      .toEqual([
        { id: 'passny-one', categoryId: 'ezpass_replenishment' },
        { id: 'passny-two', categoryId: 'ezpass_replenishment' },
        { id: 'passny-cafe', categoryId: 'other' },
      ]);
  });
});
