import type { EzPassActivityDraft, EzPassActivityKind } from './ezpass-parser';
import type { FinanceTransaction } from './types';

type EzPassCrossFormatIdentity = Pick<
  FinanceTransaction,
  'date' | 'amount' | 'activityTime' | 'activity'
>;

export function ezPassCrossFormatDuplicateKey(
  transaction: EzPassCrossFormatIdentity,
): string | undefined {
  if (!transaction.activityTime) return undefined;
  return [
    transaction.date,
    transaction.activityTime,
    transaction.amount.toFixed(2),
    transaction.activity ?? 'expense',
  ].join('|');
}

export function deduplicateEzPassDrafts(
  drafts: EzPassActivityDraft[],
  existingExternalIds: Iterable<string>,
  existingProbableKeys: Iterable<string> = [],
  existingCrossFormatKeys: Iterable<string> = [],
): { unique: EzPassActivityDraft[]; exactDuplicates: number; probableDuplicateKeys: Set<string> } {
  const existing = new Set(existingExternalIds);
  const existingProbable = new Set(existingProbableKeys);
  const existingCrossFormat = new Set(existingCrossFormatKeys);
  const seen = new Set<string>();
  const probableCounts = new Map<string, number>();
  const unique: EzPassActivityDraft[] = [];
  let exactDuplicates = 0;
  for (const draft of drafts) {
    const crossFormatKey = ezPassCrossFormatDuplicateKey(draft);
    if (
      existing.has(draft.fingerprint) ||
      seen.has(draft.fingerprint) ||
      (crossFormatKey && existingCrossFormat.has(crossFormatKey))
    ) {
      exactDuplicates += 1;
      continue;
    }
    seen.add(draft.fingerprint);
    probableCounts.set(
      draft.probableDuplicateKey,
      (probableCounts.get(draft.probableDuplicateKey) ?? 0) + 1,
    );
    unique.push(draft);
  }
  return {
    unique,
    exactDuplicates,
    probableDuplicateKeys: new Set(
      [...probableCounts]
        .filter(([key, count]) => count > 1 || existingProbable.has(key))
        .map(([key]) => key),
    ),
  };
}

export function deduplicateEzPassDraftsAgainstTransactions(
  drafts: EzPassActivityDraft[],
  transactions: FinanceTransaction[],
): ReturnType<typeof deduplicateEzPassDrafts> {
  const externalIds: string[] = [];
  const probableKeys: string[] = [];
  const crossFormatKeys: string[] = [];
  for (const transaction of transactions) {
    if (transaction.externalId) externalIds.push(transaction.externalId);
    const probableKey = ezPassProbableKeyForTransaction(transaction);
    if (probableKey) probableKeys.push(probableKey);
    if (transaction.source === 'ezpass') {
      const crossFormatKey = ezPassCrossFormatDuplicateKey(transaction);
      if (crossFormatKey) crossFormatKeys.push(crossFormatKey);
    }
  }
  return deduplicateEzPassDrafts(drafts, externalIds, probableKeys, crossFormatKeys);
}

function duplicatePreference(transaction: FinanceTransaction): number {
  return (transaction.ezPassFriendId ? 10_000 : 0) + transaction.merchant.length;
}

function mergeCrossFormatDuplicate<T extends FinanceTransaction>(left: T, right: T): T {
  const preferred = duplicatePreference(right) > duplicatePreference(left) ? right : left;
  const alternate = preferred === left ? right : left;
  return {
    ...alternate,
    ...preferred,
    merchant: left.merchant.length >= right.merchant.length ? left.merchant : right.merchant,
    ezPassFriendId: preferred.ezPassFriendId ?? alternate.ezPassFriendId,
    ezPassFriendName: preferred.ezPassFriendName ?? alternate.ezPassFriendName,
    createdAt: left.createdAt < right.createdAt ? left.createdAt : right.createdAt,
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
  };
}

export function deduplicateEzPassTransactions<T extends FinanceTransaction>(
  transactions: T[],
): T[] {
  const result: T[] = [];
  const indexByCrossFormatKey = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.source !== 'ezpass') {
      result.push(transaction);
      continue;
    }
    const key = ezPassCrossFormatDuplicateKey(transaction);
    if (!key) {
      result.push(transaction);
      continue;
    }
    const existingIndex = indexByCrossFormatKey.get(key);
    if (existingIndex === undefined) {
      indexByCrossFormatKey.set(key, result.length);
      result.push(transaction);
      continue;
    }
    result[existingIndex] = mergeCrossFormatDuplicate(result[existingIndex], transaction);
  }
  return result;
}

export function ezPassProbableKeyForTransaction(
  transaction: FinanceTransaction,
): string | undefined {
  if (transaction.source !== 'ezpass') return undefined;
  const notes = transaction.notes?.toLowerCase() ?? '';
  const kind: EzPassActivityKind = transaction.activity === 'transfer'
    ? 'replenishment'
    : transaction.activity === 'refund'
      ? 'refund'
      : transaction.activity === 'adjustment'
        ? 'adjustment'
        : notes.includes('parking')
          ? 'parking'
          : notes.includes('fee')
            ? 'fee'
            : 'toll';
  return [
    transaction.date,
    transaction.amount.toFixed(2),
    kind,
    transaction.merchant.toLowerCase(),
  ].join('|');
}
