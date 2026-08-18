import { formatMoney } from '@/features/travel/expenses/format-money';
import { formatDateKey, type DateDisplayFormat } from '@/utils/date';
import { haystackMatchesQuery } from '@/utils/search-text';

import { financeCategoryById } from './categories';
import { displayEzPassMerchantName } from './ezpass-locations';
import { formatEzPassActivityTime } from './ezpass-model';
import type { FinanceTransaction } from './types';

export function financeTransactionMatchesQuery(
  transaction: FinanceTransaction,
  query: string,
  dateDisplayFormat: DateDisplayFormat,
): boolean {
  const category = financeCategoryById(transaction.categoryId);
  const visibleMerchant = transaction.source === 'ezpass'
    ? displayEzPassMerchantName(transaction.merchant)
    : transaction.merchant;
  return haystackMatchesQuery(
    [
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
    ],
    query,
  );
}

export function searchFinanceTransactions(
  transactions: FinanceTransaction[],
  query: string,
  dateDisplayFormat: DateDisplayFormat,
): FinanceTransaction[] {
  return transactions.filter((transaction) =>
    financeTransactionMatchesQuery(transaction, query, dateDisplayFormat));
}
