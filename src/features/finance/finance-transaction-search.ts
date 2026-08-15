import { formatMoney } from '@/features/travel/expenses/format-money';
import { formatDateKey, type DateDisplayFormat } from '@/utils/date';

import { financeCategoryById } from './categories';
import { displayEzPassMerchantName } from './ezpass-locations';
import { formatEzPassActivityTime } from './ezpass-model';
import type { FinanceTransaction } from './types';

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function financeTransactionMatchesQuery(
  transaction: FinanceTransaction,
  query: string,
  dateDisplayFormat: DateDisplayFormat,
): boolean {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const category = financeCategoryById(transaction.categoryId);
  const visibleMerchant = transaction.source === 'ezpass'
    ? displayEzPassMerchantName(transaction.merchant)
    : transaction.merchant;
  const haystack = normalizeSearchText([
    visibleMerchant,
    transaction.merchant,
    category.label,
    transaction.categoryId,
    transaction.source,
    transaction.activity,
    transaction.sourceCategory,
    transaction.notes,
    transaction.ezPassFriendName,
    transaction.date,
    formatDateKey(transaction.date, dateDisplayFormat),
    transaction.activityTime,
    transaction.activityTime ? formatEzPassActivityTime(transaction.activityTime) : '',
    transaction.amount,
    transaction.currency,
    formatMoney(transaction.amount, transaction.currency),
  ].join(' '));

  return terms.every((term) => haystack.includes(term));
}

export function searchFinanceTransactions(
  transactions: FinanceTransaction[],
  query: string,
  dateDisplayFormat: DateDisplayFormat,
): FinanceTransaction[] {
  return transactions.filter((transaction) =>
    financeTransactionMatchesQuery(transaction, query, dateDisplayFormat));
}
