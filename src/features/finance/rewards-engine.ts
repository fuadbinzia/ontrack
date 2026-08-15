import type { FinanceAccount, FinanceTransaction } from './types';
import type {
  FinanceRewardCardProfile,
  FinanceRewardCapPeriod,
  FinanceRewardRule,
} from './rewards-types';

export type FinanceRewardConfidence = 'high' | 'medium' | 'low';

export interface FinanceRewardTransactionResult {
  transactionId: string;
  profileId: string;
  amount: number;
  multiplier: number;
  points: number;
  value: number;
  ruleName: string;
  confidence: FinanceRewardConfidence;
}

export interface FinanceRewardProfileResult {
  profileId: string;
  spend: number;
  points: number;
  value: number;
  annualizedRewards: number;
  annualValue: number;
  transactionResults: FinanceRewardTransactionResult[];
}

export interface FinanceRewardsAnalysis {
  profileResults: FinanceRewardProfileResult[];
  actualValue: number;
  walletBest?: FinanceRewardProfileResult;
  marketBest?: FinanceRewardProfileResult;
  missedWalletValue: number;
  missedMarketValue: number;
  skippedTransactionIds: string[];
}

type CapLedger = Map<string, number>;

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function periodKey(date: string, period: FinanceRewardCapPeriod): string {
  if (period === 'lifetime') return 'lifetime';
  const year = date.slice(0, 4);
  if (period === 'year') return year;
  const month = Number(date.slice(5, 7));
  if (period === 'month') return `${year}-${String(month).padStart(2, '0')}`;
  return `${year}-Q${Math.floor((Math.max(1, month) - 1) / 3) + 1}`;
}

function ruleMatch(
  rule: FinanceRewardRule,
  transaction: FinanceTransaction,
): FinanceRewardConfidence | undefined {
  if (!rule.active) return undefined;
  if (rule.startsOn && transaction.date < rule.startsOn) return undefined;
  if (rule.endsOn && transaction.date > rule.endsOn) return undefined;
  const source = normalized(transaction.sourceCategory ?? '');
  if (source && rule.sourceCategories.some((category) => normalized(category) === source)) {
    return 'high';
  }
  if (rule.categoryIds.includes(transaction.categoryId)) return 'medium';
  return undefined;
}

function ruleForTransaction(
  profile: FinanceRewardCardProfile,
  transaction: FinanceTransaction,
): { rule?: FinanceRewardRule; confidence: FinanceRewardConfidence } {
  const matches = profile.rules
    .flatMap((rule) => {
      const confidence = ruleMatch(rule, transaction);
      return confidence ? [{ rule, confidence }] : [];
    })
    .sort((left, right) => right.rule.multiplier - left.rule.multiplier);
  return matches[0] ?? { confidence: 'low' };
}

function signedAmount(transaction: FinanceTransaction): number | undefined {
  const activity = transaction.activity ?? 'expense';
  if (activity === 'transfer' || activity === 'adjustment') return undefined;
  return activity === 'refund' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);
}

function evaluateProfile(
  profile: FinanceRewardCardProfile,
  transactions: FinanceTransaction[],
  periodDays: number,
): FinanceRewardProfileResult {
  const caps: CapLedger = new Map();
  const transactionResults: FinanceRewardTransactionResult[] = [];
  let spend = 0;
  let points = 0;
  let value = 0;

  for (const transaction of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const amount = signedAmount(transaction);
    if (amount === undefined) continue;
    const { rule, confidence } = ruleForTransaction(profile, transaction);
    let multiplier = Math.max(0, rule?.multiplier ?? profile.baseMultiplier);
    let bonusEligibleAmount = amount;

    if (rule?.capAmount && rule.capAmount > 0) {
      const period = rule.capPeriod ?? 'year';
      const group = rule.capGroup?.trim() || rule.id;
      const key = `${group}:${periodKey(transaction.date, period)}`;
      const used = caps.get(key) ?? 0;
      if (amount >= 0) {
        bonusEligibleAmount = Math.min(amount, Math.max(0, rule.capAmount - used));
        caps.set(key, used + bonusEligibleAmount);
      } else {
        bonusEligibleAmount = amount;
        caps.set(key, Math.max(0, used + amount));
      }
    }

    const baseAmount = amount - bonusEligibleAmount;
    const transactionPoints =
      bonusEligibleAmount * multiplier + baseAmount * Math.max(0, profile.baseMultiplier);
    const transactionValue = transactionPoints * profile.pointValueCents / 100;
    spend += amount;
    points += transactionPoints;
    value += transactionValue;
    transactionResults.push({
      transactionId: transaction.id,
      profileId: profile.id,
      amount,
      multiplier,
      points: transactionPoints,
      value: transactionValue,
      ruleName: rule?.name ?? 'Base Rate',
      confidence,
    });
  }

  const annualizedRewards = periodDays > 0 ? value * (365 / periodDays) : value;
  const benefitValue = profile.benefits.reduce(
    (total, benefit) => total + (benefit.enabled ? Math.max(0, benefit.userValue) : 0),
    0,
  );
  return {
    profileId: profile.id,
    spend,
    points,
    value,
    annualizedRewards,
    annualValue: annualizedRewards - Math.max(0, profile.annualFee) + benefitValue,
    transactionResults,
  };
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 365;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function analyzeFinanceRewards(input: {
  transactions: FinanceTransaction[];
  accounts: FinanceAccount[];
  profiles: FinanceRewardCardProfile[];
  from: string;
  to: string;
  currency?: string;
}): FinanceRewardsAnalysis {
  const currency = input.currency ?? 'USD';
  const included = input.transactions.filter(
    (transaction) =>
      transaction.date >= input.from &&
      transaction.date <= input.to &&
      transaction.currency === currency &&
      signedAmount(transaction) !== undefined,
  );
  const skippedTransactionIds = input.transactions
    .filter(
      (transaction) =>
        transaction.date >= input.from &&
        transaction.date <= input.to &&
        transaction.currency !== currency,
    )
    .map((transaction) => transaction.id);
  const periodDays = inclusiveDays(input.from, input.to);
  const profileResults = input.profiles.map((profile) =>
    evaluateProfile(profile, included, periodDays),
  );
  const resultByProfile = new Map(profileResults.map((result) => [result.profileId, result]));
  const profileByAccount = new Map(
    input.accounts.flatMap((account) =>
      account.rewardProfileId ? [[account.id, account.rewardProfileId] as const] : [],
    ),
  );
  const actualValue = input.profiles.reduce((total, profile) => {
    const actualTransactions = included.filter((transaction) =>
      transaction.accountId != null &&
      profileByAccount.get(transaction.accountId) === profile.id,
    );
    return total + evaluateProfile(profile, actualTransactions, periodDays).value;
  }, 0);
  const sortedOwned = input.profiles
    .filter((profile) => profile.ownership === 'owned')
    .map((profile) => resultByProfile.get(profile.id))
    .filter((result): result is FinanceRewardProfileResult => Boolean(result))
    .sort((a, b) => b.value - a.value);
  const sortedMarket = input.profiles
    .filter((profile) => profile.ownership === 'market')
    .map((profile) => resultByProfile.get(profile.id))
    .filter((result): result is FinanceRewardProfileResult => Boolean(result))
    .sort((a, b) => b.value - a.value);
  return {
    profileResults,
    actualValue,
    walletBest: sortedOwned[0],
    marketBest: sortedMarket[0],
    missedWalletValue: Math.max(0, (sortedOwned[0]?.value ?? 0) - actualValue),
    missedMarketValue: Math.max(0, (sortedMarket[0]?.value ?? 0) - actualValue),
    skippedTransactionIds,
  };
}
