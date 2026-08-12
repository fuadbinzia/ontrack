import {
  bucketProgress,
  bucketSavedAmount,
  categoryBreakdown,
  highestAprAccounts,
  monthlySpendSeries,
  sumAmounts,
  transactionsInMonth,
  upcomingBills,
} from './model';
import {
  aprBeatsCash,
  describeAprVsCash,
  referenceSavingsAprPercent,
} from './rate-context';
import type {
  FinanceAccount,
  FinanceBucket,
  FinanceRecurringBill,
  FinanceTransaction,
} from './types';

export interface FinanceCoachInsight {
  id: string;
  title: string;
  body: string;
  priority: number;
}

/** Local heuristics — optional LLM polish via `/api/finance/coach`. */
export function buildFinanceCoachInsights(input: {
  transactions: FinanceTransaction[];
  bills: FinanceRecurringBill[];
  buckets: FinanceBucket[];
  accounts: FinanceAccount[];
  now?: Date;
  /** Override HYSA / cash reference APR (%). */
  referenceSavingsApr?: number;
}): FinanceCoachInsight[] {
  const now = input.now ?? new Date();
  const savingsApr = referenceSavingsAprPercent(input.referenceSavingsApr);
  const insights: FinanceCoachInsight[] = [];
  const monthTx = transactionsInMonth(input.transactions, now.getFullYear(), now.getMonth());
  const monthTotal = sumAmounts(monthTx);
  const series = monthlySpendSeries(input.transactions, 3, now);
  const prev = series.length >= 2 ? series[series.length - 2]?.amount ?? 0 : 0;

  if (prev > 0 && monthTotal > prev * 1.15) {
    const pct = Math.round(((monthTotal - prev) / prev) * 100);
    insights.push({
      id: 'spend-up',
      title: 'Spending Is Up This Month',
      body: `You're about ${pct}% above last month. Review your top categories before new discretionary buys.`,
      priority: 80,
    });
  } else if (prev > 0 && monthTotal < prev * 0.9) {
    insights.push({
      id: 'spend-down',
      title: 'Nice Slowdown',
      body: 'This month is tracking below last month — keep protecting that gap into a savings bucket.',
      priority: 40,
    });
  }

  const top = categoryBreakdown(monthTx)[0];
  if (top && top.amount > 0 && monthTotal > 0 && top.amount / monthTotal >= 0.35) {
    insights.push({
      id: 'category-focus',
      title: `Focus On ${top.label}`,
      body: `${top.label} is ${Math.round((top.amount / monthTotal) * 100)}% of this month's spend. Trim here first for the biggest impact.`,
      priority: 70,
    });
  }

  const highApr = highestAprAccounts(input.accounts);
  const highBillApr = [...input.bills]
    .filter((b) => b.active && typeof b.aprPercent === 'number' && (b.aprPercent ?? 0) >= 10)
    .sort((a, b) => (b.aprPercent ?? 0) - (a.aprPercent ?? 0));
  const aprTarget = highApr[0] ?? undefined;
  const billApr = highBillApr[0];
  if (aprTarget && (aprTarget.aprPercent ?? 0) > 0) {
    const apr = aprTarget.aprPercent ?? 0;
    insights.push({
      id: 'apr-card',
      title: aprBeatsCash(apr, savingsApr)
        ? `Pay Down ${aprTarget.name} First`
        : `Review ${aprTarget.name}`,
      body: describeAprVsCash(apr, savingsApr),
      priority: aprBeatsCash(apr, savingsApr) ? 95 : 70,
    });
  } else if (billApr) {
    const apr = billApr.aprPercent ?? 0;
    insights.push({
      id: 'apr-loan',
      title: aprBeatsCash(apr, savingsApr)
        ? `Prioritize ${billApr.name}`
        : `Watch ${billApr.name}`,
      body: describeAprVsCash(apr, savingsApr),
      priority: aprBeatsCash(apr, savingsApr) ? 90 : 65,
    });
  }

  insights.push({
    id: 'rate-context',
    title: 'Cash vs Debt Rates',
    body: `Using ~${savingsApr.toFixed(1)}% as a cash/HYSA reference. High-APR cards above that usually deserve payments before extra savings.`,
    priority: 25,
  });

  const due = upcomingBills(input.bills, 14, now);
  if (due.length >= 3) {
    insights.push({
      id: 'bills-cluster',
      title: `${due.length} Bills Due Soon`,
      body: 'A cluster of bills is landing in the next two weeks — keep cash ready and pause non-essentials until they clear.',
      priority: 75,
    });
  }

  const laggingBucket = [...input.buckets]
    .map((b) => ({ bucket: b, progress: bucketProgress(b), saved: bucketSavedAmount(b) }))
    .filter((row) => row.bucket.goalAmount > 0 && row.progress < 0.5)
    .sort((a, b) => a.progress - b.progress)[0];
  if (laggingBucket) {
    insights.push({
      id: 'bucket-lag',
      title: `Boost “${laggingBucket.bucket.name}”`,
      body: `You're at ${Math.round(laggingBucket.progress * 100)}% of this goal. Automate a small weekly transfer so the purchase date stays realistic.`,
      priority: 55,
    });
  }

  const subs = input.bills.filter((b) => b.active && b.kind === 'subscription');
  if (subs.length >= 3) {
    const subTotal = subs.reduce((sum, b) => sum + b.amount, 0);
    insights.push({
      id: 'subs',
      title: 'Audit Subscriptions',
      body: `${subs.length} active subscriptions (~${subTotal.toFixed(0)}/cycle). Cancel one unused service before adding another.`,
      priority: 60,
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'baseline',
      title: 'Keep Logging Spend',
      body: 'Add a few expenses, bills, and APRs on your cards so coaching can focus on rate-aware priorities.',
      priority: 10,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 4);
}
