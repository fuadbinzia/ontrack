import { toDateKey } from '@/utils/date';

import { financeCategoryById, taxBucketLabel, type FinanceTaxBucket } from './categories';
import type {
  FinanceAccount,
  FinanceBucket,
  FinanceRecurringBill,
  FinanceTaxChecklistKey,
  FinanceTaxYear,
  FinanceTransaction,
} from './types';
import { isFinanceAssetKind } from './types';

const CHECKLIST_KEYS: FinanceTaxChecklistKey[] = [
  'entities_scoped',
  'income_docs',
  'expenses_categorized',
  'property_docs',
  'export_ready',
];

export function bucketSavedAmount(bucket: FinanceBucket): number {
  return bucket.contributions.reduce((sum, c) => sum + c.amount, 0);
}

export function bucketProgress(bucket: FinanceBucket): number {
  if (bucket.goalAmount <= 0) return 0;
  return Math.min(1, bucketSavedAmount(bucket) / bucket.goalAmount);
}

export function transactionsInMonth(
  transactions: FinanceTransaction[],
  year: number,
  monthIndex: number,
): FinanceTransaction[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return transactions.filter((t) => t.date.startsWith(prefix));
}

export function isSpendingTransaction(transaction: FinanceTransaction): boolean {
  return (
    transaction.activity === undefined ||
    transaction.activity === 'expense' ||
    transaction.activity === 'refund'
  );
}

export function sumAmounts(transactions: FinanceTransaction[]): number {
  return transactions.reduce(
    (sum, transaction) =>
      isSpendingTransaction(transaction) ? sum + transaction.amount : sum,
    0,
  );
}

export function categoryBreakdown(
  transactions: FinanceTransaction[],
): { categoryId: string; label: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (!isSpendingTransaction(t)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      label: financeCategoryById(categoryId).label,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlySpendSeries(
  transactions: FinanceTransaction[],
  monthsBack: number,
  now = new Date(),
): { key: string; label: string; amount: number }[] {
  const series: { key: string; label: string; amount: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const amount = sumAmounts(transactionsInMonth(transactions, d.getFullYear(), d.getMonth()));
    series.push({
      key,
      label: d.toLocaleString(undefined, { month: 'short' }),
      amount,
    });
  }
  return series;
}

export function upcomingBills(
  bills: FinanceRecurringBill[],
  withinDays = 30,
  today = new Date(),
): FinanceRecurringBill[] {
  const start = toDateKey(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + withinDays);
  const end = toDateKey(endDate);
  return bills
    .filter((b) => b.active && b.nextDue >= start && b.nextDue <= end)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

export function advanceBillDue(cadence: FinanceRecurringBill['cadence'], from: string): string {
  const [y, m, d] = from.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  switch (cadence) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'once':
      break;
  }
  return toDateKey(date);
}

export function taxYearReadiness(taxYear: FinanceTaxYear): number {
  const done = CHECKLIST_KEYS.filter((key) => taxYear.checklist[key]).length;
  return done / CHECKLIST_KEYS.length;
}

export function taxChecklistKeys(): FinanceTaxChecklistKey[] {
  return [...CHECKLIST_KEYS];
}

export function taxChecklistLabel(key: FinanceTaxChecklistKey): string {
  const labels: Record<FinanceTaxChecklistKey, string> = {
    entities_scoped: 'Entities Scoped for This Year',
    income_docs: 'Income Documents Uploaded (W-2 / 1099 / K-1)',
    expenses_categorized: 'Expenses Categorized',
    property_docs: 'Property Docs Attached (If Applicable)',
    export_ready: 'Export Package Ready',
  };
  return labels[key];
}

export function groupTransactionsByTaxBucket(
  transactions: FinanceTransaction[],
): { bucket: FinanceTaxBucket; label: string; amount: number; count: number }[] {
  const map = new Map<FinanceTaxBucket, { amount: number; count: number }>();
  for (const t of transactions) {
    if (!isSpendingTransaction(t)) continue;
    const bucket = financeCategoryById(t.categoryId).taxBucket;
    const prev = map.get(bucket) ?? { amount: 0, count: 0 };
    map.set(bucket, { amount: prev.amount + t.amount, count: prev.count + 1 });
  }
  return [...map.entries()]
    .map(([bucket, { amount, count }]) => ({
      bucket,
      label: taxBucketLabel(bucket),
      amount,
      count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function highestAprAccounts(accounts: FinanceAccount[]): FinanceAccount[] {
  return accounts
    .filter((a) => typeof a.aprPercent === 'number' && a.aprPercent > 0)
    .sort((a, b) => (b.aprPercent ?? 0) - (a.aprPercent ?? 0));
}

/** Sum known balances on asset accounts (bank, cash, investments). Cards excluded. */
export function sumAssetBalances(accounts: FinanceAccount[]): number {
  return accounts.reduce((sum, account) => {
    if (!isFinanceAssetKind(account.kind)) return sum;
    if (typeof account.balance !== 'number' || !Number.isFinite(account.balance)) {
      return sum;
    }
    return sum + account.balance;
  }, 0);
}
