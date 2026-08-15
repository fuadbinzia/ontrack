import {
  financeTransactionMatchesQuery,
  searchFinanceTransactions,
} from '../finance-transaction-search';
import type { FinanceTransaction } from '../types';

function transaction(
  partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id'>,
): FinanceTransaction {
  return {
    amount: 25,
    currency: 'USD',
    date: '2026-08-13',
    merchant: 'E-ZPass NY Payment',
    categoryId: 'ezpass_replenishment',
    entityId: 'personal',
    source: 'ezpass',
    activity: 'transfer',
    activityTime: '16:25:15',
    createdAt: '2026-08-13T20:25:15.000Z',
    updatedAt: '2026-08-13T20:25:15.000Z',
    ...partial,
  };
}

describe('finance transaction search', () => {
  it('matches the merchant regardless of casing or punctuation', () => {
    const row = transaction({ id: 'toll' });

    expect(financeTransactionMatchesQuery(row, 'e zpass ny', 'en-US')).toBe(true);
    expect(financeTransactionMatchesQuery(row, 'PAYMENT', 'en-US')).toBe(true);
  });

  it('matches the visible category, source, and activity metadata', () => {
    const row = transaction({ id: 'toll' });

    expect(financeTransactionMatchesQuery(row, 'replenishment transfer', 'en-US')).toBe(true);
    expect(financeTransactionMatchesQuery(row, 'ezpass', 'en-US')).toBe(true);
    expect(financeTransactionMatchesQuery(row, 'groceries', 'en-US')).toBe(false);
  });

  it('matches displayed dates, times, and formatted amounts', () => {
    const row = transaction({ id: 'toll' });

    expect(financeTransactionMatchesQuery(row, '8/13/2026', 'en-US')).toBe(true);
    expect(financeTransactionMatchesQuery(row, '4:25 PM', 'en-US')).toBe(true);
    expect(financeTransactionMatchesQuery(row, '$25.00', 'en-US')).toBe(true);
  });

  it('requires every query term and preserves order for a blank query', () => {
    const rows = [
      transaction({ id: 'toll' }),
      transaction({ id: 'shop', merchant: 'Corner Shop', categoryId: 'groceries' }),
    ];

    expect(searchFinanceTransactions(rows, 'shop groceries', 'en-US').map((row) => row.id))
      .toEqual(['shop']);
    expect(searchFinanceTransactions(rows, 'shop transport', 'en-US')).toEqual([]);
    expect(searchFinanceTransactions(rows, '   ', 'en-US')).toEqual(rows);
  });
});
