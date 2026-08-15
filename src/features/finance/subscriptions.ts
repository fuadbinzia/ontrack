import { addDays, DAY_MS, fromDateKey, todayKey } from '@/utils/date';

import { advanceBillDue } from './model';
import { financeBillCategoryForKind } from './create';
import { stableFinanceHash } from './stable-hash';
import type {
  FinanceAccount,
  FinanceBillCadence,
  FinanceBillKind,
  FinanceRecurringBill,
  FinanceSubscriptionCandidate,
  FinanceTransaction,
} from './types';

export function categorizeRecurringExpense(
  expense: FinanceRecurringBill,
  kind: FinanceBillKind,
): FinanceRecurringBill {
  return editRecurringExpense(expense, { kind, name: expense.name });
}

export function editRecurringExpense(
  expense: FinanceRecurringBill,
  changes: Pick<FinanceRecurringBill, 'kind' | 'name'>,
): FinanceRecurringBill {
  return {
    ...expense,
    name: changes.name.trim() || expense.name,
    kind: changes.kind,
    categoryId: financeBillCategoryForKind(changes.kind),
    aprPercent: changes.kind === 'loan' ? expense.aprPercent : undefined,
  };
}

type RecurringCadence = Exclude<FinanceBillCadence, 'once'>;

const MONTHLY_CADENCE_MULTIPLIER: Record<FinanceBillCadence, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  once: 0,
};

const NON_EXPENSE_CATEGORY_TERMS = [
  'income',
  'transfer',
];

const BILL_CATEGORY_TERMS = [
  'insurance',
  'loan',
  'mortgage',
  'rent',
  'tax',
  'utilities',
  'utility',
];

const BILL_MERCHANT_TERMS = [
  'electric',
  'energy',
  'gas bill',
  'insurance',
  'mortgage',
  'property tax',
  'rent payment',
  'student loan',
  'water bill',
];

const EXPLICIT_RECURRING_TERMS = [
  'autopay',
  'membership',
  'recurring',
  'subscription',
];

export function normalizeSubscriptionMerchant(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:payment|purchase|debit|credit|card)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function daysBetween(first: string, second: string): number {
  return Math.round((fromDateKey(second).getTime() - fromDateKey(first).getTime()) / DAY_MS);
}

function cadenceForInterval(days: number): RecurringCadence | undefined {
  if (days >= 5 && days <= 9) return 'weekly';
  if (days >= 11 && days <= 18) return 'biweekly';
  if (days >= 24 && days <= 38) return 'monthly';
  if (days >= 75 && days <= 105) return 'quarterly';
  if (days >= 330 && days <= 400) return 'yearly';
  return undefined;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function isLikelySubscriptionDescription(
  merchant: string,
  categoryHint?: string,
): boolean {
  return recurringKindForDescription(merchant, categoryHint) === 'subscription';
}

export function recurringKindForDescription(
  merchant: string,
  categoryHint?: string,
): FinanceBillKind | undefined {
  const combined = [merchant, categoryHint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  if (NON_EXPENSE_CATEGORY_TERMS.some((term) => combined.includes(term))) return undefined;
  if (combined.includes('insurance')) return 'insurance';
  if (combined.includes('loan') || combined.includes('mortgage')) return 'loan';
  if (combined.includes('tax')) return 'tax';
  if (
    BILL_CATEGORY_TERMS.some((term) => combined.includes(term)) ||
    BILL_MERCHANT_TERMS.some((term) => combined.includes(term))
  ) return 'bill';
  return 'subscription';
}

function explicitRecurringKindForDescription(
  merchant: string,
  categoryHint?: string,
): FinanceBillKind | undefined {
  const combined = [merchant, categoryHint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  const kind = recurringKindForDescription(merchant, categoryHint);
  if (!kind) return undefined;
  if (kind !== 'subscription') return kind;
  return EXPLICIT_RECURRING_TERMS.some((term) => combined.includes(term))
    ? 'subscription'
    : undefined;
}

function recurringKindForGroup(group: FinanceTransaction[]): FinanceBillKind | undefined {
  const combined = group
    .flatMap((transaction) => [transaction.sourceCategory, transaction.merchant])
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  return recurringKindForDescription(combined);
}

export function subscriptionMaterialFingerprint(input: {
  amount: number;
  cadence: RecurringCadence;
  active: boolean;
}): string {
  return `${Math.round(input.amount * 100)}:${input.cadence}:${input.active ? 'active' : 'inactive'}`;
}

function localCandidate(
  group: FinanceTransaction[],
  account: FinanceAccount,
  now: string,
): FinanceSubscriptionCandidate | undefined {
  const ordered = [...group].sort((a, b) => a.date.localeCompare(b.date));
  const last = ordered[ordered.length - 1];
  if (!last) return undefined;
  const intervals = ordered.slice(1).map((transaction, index) =>
    daysBetween(ordered[index].date, transaction.date),
  );
  const cadence = intervals.length ? cadenceForInterval(median(intervals)) : 'monthly';
  if (!cadence) return undefined;
  const suggestedKind = ordered.length === 1
    ? explicitRecurringKindForDescription(last.merchant, last.sourceCategory)
    : recurringKindForGroup(ordered);
  if (!suggestedKind) return undefined;
  const amounts = ordered.map((transaction) => transaction.amount);
  const amount = median(amounts);
  const amountTolerance = suggestedKind === 'subscription' ? 0.25 : 0.65;
  if (amount <= 0 || amounts.some((value) => Math.abs(value - amount) / amount > amountTolerance)) {
    return undefined;
  }

  let nextDue = advanceBillDue(cadence, last.date);
  const cadenceGraceDays: Record<RecurringCadence, number> = {
    weekly: 10,
    biweekly: 21,
    monthly: 45,
    quarterly: 120,
    yearly: 420,
  };
  const active = now <= addDays(nextDue, cadenceGraceDays[cadence]);
  while (active && nextDue < now) nextDue = advanceBillDue(cadence, nextDue);
  const provider = last.source === 'teller' ? 'teller' : 'plaid';
  const merchantKey = normalizeSubscriptionMerchant(last.merchant);
  const identity = `${provider}|${account.connectionId ?? ''}|${account.id}|${last.currency}|${merchantKey}`;

  return {
    id: `subscription:local:${stableFinanceHash(identity)}`,
    source: 'local',
    status: 'pending',
    provider,
    connectionId: account.connectionId,
    name: last.merchant.trim() || 'Subscription',
    amount,
    currency: last.currency,
    cadence,
    nextDue,
    accountId: account.id,
    categoryHint: last.sourceCategory,
    suggestedKind,
    confidence: ordered.length === 1
      ? 0.55
      : Math.min(0.95, 0.65 + ordered.length * 0.05),
    active,
    materialFingerprint: subscriptionMaterialFingerprint({ amount, cadence, active }),
    detectedAt: new Date().toISOString(),
  };
}

function candidateMatchKey(candidate: Pick<FinanceSubscriptionCandidate, 'name' | 'accountId' | 'currency'>) {
  return `${candidate.accountId ?? ''}|${candidate.currency}|${normalizeSubscriptionMerchant(candidate.name)}`;
}

export function detectLocalSubscriptionCandidates(
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  authoritativeCandidates: Pick<FinanceSubscriptionCandidate, 'name' | 'accountId' | 'currency'>[] = [],
  now = todayKey(),
): FinanceSubscriptionCandidate[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const groups = new Map<string, FinanceTransaction[]>();
  for (const transaction of transactions) {
    if (
      (transaction.source !== 'plaid' && transaction.source !== 'teller') ||
      transaction.activity === 'refund' ||
      transaction.activity === 'transfer' ||
      transaction.amount <= 0 ||
      !transaction.accountId
    ) continue;
    const merchant = normalizeSubscriptionMerchant(transaction.merchant);
    if (!merchant) continue;
    const key = `${transaction.accountId}|${transaction.currency}|${merchant}`;
    const group = groups.get(key);
    if (group) group.push(transaction);
    else groups.set(key, [transaction]);
  }

  const authoritativeKeys = new Set(authoritativeCandidates.map(candidateMatchKey));
  return [...groups.values()].flatMap((group) => {
    const accountId = group[0]?.accountId;
    const account = accountId ? accountsById.get(accountId) : undefined;
    if (!account) return [];
    const candidate = localCandidate(group, account, now);
    return candidate && !authoritativeKeys.has(candidateMatchKey(candidate)) ? [candidate] : [];
  });
}

export function monthlyRecurringAmount(
  recurringExpenses: Pick<FinanceRecurringBill, 'amount' | 'cadence' | 'active'>[],
): number {
  return recurringExpenses.reduce((total, expense) => {
    if (!expense.active) return total;
    return total + expense.amount * MONTHLY_CADENCE_MULTIPLIER[expense.cadence];
  }, 0);
}

/** Backward-compatible name for subscription-only callers. */
export const monthlySubscriptionAmount = monthlyRecurringAmount;
