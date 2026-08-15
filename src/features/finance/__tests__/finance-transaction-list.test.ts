import {
  filterAndSortFinanceTransactions,
  financeTransactionDateLabel,
  financeTransactionCountLabel,
  groupFinanceTransactionsByDate,
  type FinanceTransactionSort,
} from '../finance-transaction-list';
import type { FinanceTransaction } from '../types';

function transaction(
  id: string,
  merchant: string,
  amount: number,
  date: string,
  categoryId: string,
): FinanceTransaction {
  return {
    id,
    merchant,
    amount,
    date,
    categoryId,
    currency: 'USD',
    entityId: 'personal',
    source: 'plaid',
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe('Finance transaction filtering and sorting', () => {
  const rows = [
    transaction('zebra', 'Zebra Cafe', 20, '2026-08-01', 'dining'),
    transaction('apple', 'Apple Market', 5, '2026-08-03', 'groceries'),
    transaction('cafe', 'Cafe Central', 50, '2026-08-02', 'dining'),
    transaction('bistro', 'Bistro Utility', 5, '2026-08-02', 'utilities'),
  ];

  it('filters by any of the selected categories and treats an empty selection as all', () => {
    expect(filterAndSortFinanceTransactions(rows, ['dining', 'utilities'], 'newest')
      .map((row) => row.id)).toEqual(['bistro', 'cafe', 'zebra']);
    expect(filterAndSortFinanceTransactions(rows, [], 'newest')).toHaveLength(4);
  });

  it.each<[FinanceTransactionSort, string[]]>([
    ['newest', ['apple', 'bistro', 'cafe', 'zebra']],
    ['oldest', ['zebra', 'bistro', 'cafe', 'apple']],
    ['amount_high', ['cafe', 'zebra', 'apple', 'bistro']],
    ['amount_low', ['apple', 'bistro', 'zebra', 'cafe']],
    ['merchant', ['apple', 'bistro', 'cafe', 'zebra']],
    ['category', ['cafe', 'zebra', 'apple', 'bistro']],
  ])('sorts transactions by %s', (sort, expectedIds) => {
    expect(filterAndSortFinanceTransactions(rows, [], sort).map((row) => row.id))
      .toEqual(expectedIds);
  });

  it('does not mutate the input transaction order', () => {
    filterAndSortFinanceTransactions(rows, [], 'amount_high');
    expect(rows.map((row) => row.id)).toEqual(['zebra', 'apple', 'cafe', 'bistro']);
  });

  it('formats polished visible-result counts for empty, singular, and filtered lists', () => {
    expect(financeTransactionCountLabel(0, 0)).toBe('0 Transactions');
    expect(financeTransactionCountLabel(1, 1)).toBe('1 Transaction');
    expect(financeTransactionCountLabel(2, 5)).toBe('2 of 5');
  });

  it('groups transactions by date with newest groups first for non-date sorts', () => {
    const sorted = filterAndSortFinanceTransactions(rows, [], 'amount_high');
    expect(groupFinanceTransactionsByDate(sorted, 'amount_high').map((group) => ({
      date: group.date,
      ids: group.transactions.map((row) => row.id),
    }))).toEqual([
      { date: '2026-08-03', ids: ['apple'] },
      { date: '2026-08-02', ids: ['cafe', 'bistro'] },
      { date: '2026-08-01', ids: ['zebra'] },
    ]);
  });

  it('shows oldest date groups first only when Oldest First is selected', () => {
    const sorted = filterAndSortFinanceTransactions(rows, [], 'oldest');
    expect(groupFinanceTransactionsByDate(sorted, 'oldest').map((group) => group.date))
      .toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('labels current and recent date groups without losing locale formatting', () => {
    expect(financeTransactionDateLabel('2026-08-14', 'en-US', '2026-08-14')).toBe('Today');
    expect(financeTransactionDateLabel('2026-08-13', 'en-US', '2026-08-14')).toBe('Yesterday');
    expect(financeTransactionDateLabel('2026-08-12', 'en-US', '2026-08-14')).toBe('8/12/2026');
  });
});
