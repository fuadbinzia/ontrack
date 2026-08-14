import { sumAmounts, transactionsInMonth } from './model';
import type { FinanceTransaction } from './types';

export function formatEzPassActivityTime(activityTime: string | undefined): string | undefined {
  const match = activityTime?.match(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]}:${match[3]} ${hour < 12 ? 'AM' : 'PM'}`;
}

export type EzPassImportSaveMode = 'import' | 'times' | 'file';

export function ezPassImportSaveMode(input: {
  uniqueCount: number;
  timeBackfillCount: number;
  parsedCount: number;
  exactDuplicateCount: number;
}): EzPassImportSaveMode | undefined {
  if (input.uniqueCount > 0) return 'import';
  if (input.timeBackfillCount > 0) return 'times';
  if (input.parsedCount > 0 && input.exactDuplicateCount > 0) return 'file';
  return undefined;
}

export interface EzPassFinanceSummary {
  activities: FinanceTransaction[];
  roadActivities: FinanceTransaction[];
  tollActivities: FinanceTransaction[];
  refunds: FinanceTransaction[];
  replenishments: FinanceTransaction[];
  tollTotal: number;
  refundTotal: number;
  replenishmentTotal: number;
  spendTotal: number;
  monthSpend: number;
}

export interface EzPassMonthlyPoint {
  key: string;
  label: string;
  fullLabel: string;
  activityCount: number;
  tollTotal: number;
  refundTotal: number;
  replenishmentTotal: number;
  netTotal: number;
}

export type EzPassDriverFilter = 'all' | 'mine' | `friend:${string}`;

export interface EzPassFriendFilterOption {
  value: EzPassDriverFilter;
  label: string;
}

export interface EzPassDayGroup {
  date: string;
  transactions: FinanceTransaction[];
}

export function ezPassFirstName(displayName: string | undefined): string | undefined {
  const normalized = displayName?.trim();
  return normalized ? normalized.split(/\s+/)[0] : undefined;
}

export function groupEzPassActivitiesByDay(
  transactions: FinanceTransaction[],
): EzPassDayGroup[] {
  const byDate = new Map<string, FinanceTransaction[]>();
  const sorted = [...transactions].sort((left, right) => {
    const byDay = right.date.localeCompare(left.date);
    if (byDay !== 0) return byDay;
    const byTime = (right.activityTime ?? '').localeCompare(left.activityTime ?? '');
    return byTime !== 0 ? byTime : right.createdAt.localeCompare(left.createdAt);
  });
  for (const transaction of sorted) {
    const group = byDate.get(transaction.date) ?? [];
    group.push(transaction);
    byDate.set(transaction.date, group);
  }
  return [...byDate].map(([date, groupedTransactions]) => ({
    date,
    transactions: groupedTransactions,
  }));
}

export function ezPassFriendFilterOptions(
  transactions: FinanceTransaction[],
  roster: readonly { userId: string; displayName: string }[] = [],
): EzPassFriendFilterOption[] {
  const friends = new Map<string, string>();
  for (const person of roster) {
    const firstName = ezPassFirstName(person.displayName);
    if (person.userId && firstName) friends.set(person.userId, firstName);
  }
  for (const transaction of transactions) {
    if (transaction.ezPassFriendId && transaction.ezPassFriendName) {
      friends.set(
        transaction.ezPassFriendId,
        ezPassFirstName(transaction.ezPassFriendName) ?? transaction.ezPassFriendName,
      );
    }
  }
  return [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
    ...[...friends]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, label]) => ({ value: `friend:${id}` as const, label })),
  ];
}

export function filterEzPassActivitiesByDriver(
  transactions: FinanceTransaction[],
  filter: EzPassDriverFilter,
): FinanceTransaction[] {
  if (filter === 'all') return transactions;
  if (filter === 'mine') {
    return transactions.filter((transaction) => !transaction.ezPassFriendId);
  }
  const friendId = filter.slice('friend:'.length);
  return transactions.filter((transaction) => transaction.ezPassFriendId === friendId);
}

export function buildEzPassFinanceSummary(
  transactions: FinanceTransaction[],
  now = new Date(),
): EzPassFinanceSummary {
  const activities = transactions
    .filter((transaction) => transaction.source === 'ezpass')
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
    });
  const roadActivities = activities.filter((transaction) => transaction.activity !== 'transfer');
  const tollActivities = roadActivities.filter((transaction) => transaction.activity !== 'refund');
  const refunds = roadActivities.filter((transaction) => transaction.activity === 'refund');
  const replenishments = activities.filter((transaction) => transaction.activity === 'transfer');
  const tollTotal = sumAmounts(tollActivities);
  const refundTotal = sumAmounts(refunds);
  return {
    activities,
    roadActivities,
    tollActivities,
    refunds,
    replenishments,
    tollTotal,
    refundTotal,
    replenishmentTotal: replenishments.reduce((sum, transaction) => sum + transaction.amount, 0),
    spendTotal: tollTotal + refundTotal,
    monthSpend: sumAmounts(
      transactionsInMonth(activities, now.getFullYear(), now.getMonth()),
    ),
  };
}

export function buildEzPassMonthlySeries(
  transactions: FinanceTransaction[],
  monthsBack = 6,
  anchor = new Date(),
): EzPassMonthlyPoint[] {
  const points: EzPassMonthlyPoint[] = [];
  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    const month = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const summary = buildEzPassFinanceSummary(
      transactions.filter((transaction) => transaction.date.startsWith(key)),
      month,
    );
    points.push({
      key,
      label: month.toLocaleString(undefined, { month: 'short' }),
      fullLabel: month.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      activityCount: summary.activities.length,
      tollTotal: summary.tollTotal,
      refundTotal: summary.refundTotal,
      replenishmentTotal: summary.replenishmentTotal,
      netTotal: summary.spendTotal,
    });
  }
  return points;
}
