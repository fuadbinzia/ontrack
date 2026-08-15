import {
  addDays,
  formatDateKey,
  todayKey,
  type DateDisplayFormat,
} from '@/utils/date';

import { financeCategoryById } from './categories';
import type { FinanceTransaction } from './types';

export type FinanceTransactionSort =
  | 'newest'
  | 'oldest'
  | 'amount_high'
  | 'amount_low'
  | 'merchant'
  | 'category';

export const FINANCE_TRANSACTION_SORT_OPTIONS: readonly {
  value: FinanceTransactionSort;
  label: string;
}[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'amount_high', label: 'Amount: High to Low' },
  { value: 'amount_low', label: 'Amount: Low to High' },
  { value: 'merchant', label: 'Merchant: A–Z' },
  { value: 'category', label: 'Category: A–Z' },
];

export function financeTransactionCountLabel(visible: number, total: number): string {
  if (visible !== total) return `${visible} of ${total}`;
  return `${total} ${total === 1 ? 'Transaction' : 'Transactions'}`;
}

export type FinanceTransactionDateGroup = {
  date: string;
  transactions: FinanceTransaction[];
};

export function groupFinanceTransactionsByDate(
  transactions: readonly FinanceTransaction[],
  sort: FinanceTransactionSort,
): FinanceTransactionDateGroup[] {
  const byDate = new Map<string, FinanceTransaction[]>();
  for (const transaction of transactions) {
    const dateTransactions = byDate.get(transaction.date) ?? [];
    dateTransactions.push(transaction);
    byDate.set(transaction.date, dateTransactions);
  }
  const direction = sort === 'oldest' ? 1 : -1;
  return [...byDate.entries()]
    .sort(([left], [right]) => direction * left.localeCompare(right))
    .map(([date, dateTransactions]) => ({ date, transactions: dateTransactions }));
}

export function financeTransactionDateLabel(
  date: string,
  format: DateDisplayFormat,
  today = todayKey(),
): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDateKey(date, format);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNewest(left: FinanceTransaction, right: FinanceTransaction): number {
  return right.date.localeCompare(left.date) ||
    right.createdAt.localeCompare(left.createdAt) ||
    compareText(left.id, right.id);
}

function transactionComparator(sort: FinanceTransactionSort) {
  return (left: FinanceTransaction, right: FinanceTransaction): number => {
    switch (sort) {
      case 'oldest':
        return left.date.localeCompare(right.date) ||
          left.createdAt.localeCompare(right.createdAt) ||
          compareText(left.id, right.id);
      case 'amount_high':
        return right.amount - left.amount || compareNewest(left, right);
      case 'amount_low':
        return left.amount - right.amount || compareNewest(left, right);
      case 'merchant':
        return compareText(left.merchant, right.merchant) || compareNewest(left, right);
      case 'category':
        return compareText(
          financeCategoryById(left.categoryId).label,
          financeCategoryById(right.categoryId).label,
        ) || compareNewest(left, right);
      case 'newest':
      default:
        return compareNewest(left, right);
    }
  };
}

export function filterAndSortFinanceTransactions(
  transactions: FinanceTransaction[],
  categoryIds: readonly string[],
  sort: FinanceTransactionSort,
): FinanceTransaction[] {
  const selectedCategories = new Set(categoryIds);
  return transactions
    .filter((transaction) =>
      selectedCategories.size === 0 || selectedCategories.has(transaction.categoryId),
    )
    .sort(transactionComparator(sort));
}
