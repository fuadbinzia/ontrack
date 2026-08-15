import type { FinanceTransaction } from './types';

/** Exact merchant identity after ignoring display-only differences. */
export function financeMerchantKey(merchant: string): string {
  return merchant
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isGeneralTransaction(transaction: FinanceTransaction): boolean {
  return transaction.source !== 'ezpass';
}

function preferredCategoryTransaction(
  current: FinanceTransaction | undefined,
  candidate: FinanceTransaction,
): FinanceTransaction {
  if (!current) return candidate;
  const currentIsCategorized = current.categoryId !== 'other';
  const candidateIsCategorized = candidate.categoryId !== 'other';
  if (candidateIsCategorized !== currentIsCategorized) {
    return candidateIsCategorized ? candidate : current;
  }
  return candidate.updatedAt > current.updatedAt ? candidate : current;
}

export function financeMerchantCategory(
  transactions: readonly FinanceTransaction[],
  merchant: string,
): string | undefined {
  const key = financeMerchantKey(merchant);
  if (!key) return undefined;

  let preferred: FinanceTransaction | undefined;
  for (const transaction of transactions) {
    if (
      isGeneralTransaction(transaction) &&
      financeMerchantKey(transaction.merchant) === key
    ) {
      preferred = preferredCategoryTransaction(preferred, transaction);
    }
  }
  return preferred?.categoryId;
}

export function categorizeFinanceMerchant(
  transactions: readonly FinanceTransaction[],
  merchant: string,
  categoryId: string,
  updatedAt?: string,
): FinanceTransaction[] {
  const key = financeMerchantKey(merchant);
  if (!key) return [...transactions];

  return transactions.map((transaction) => {
    if (
      !isGeneralTransaction(transaction) ||
      financeMerchantKey(transaction.merchant) !== key ||
      transaction.categoryId === categoryId
    ) {
      return transaction;
    }
    return {
      ...transaction,
      categoryId,
      updatedAt: updatedAt ?? transaction.updatedAt,
    };
  });
}

export function saveFinanceTransactionForMerchant(
  transactions: readonly FinanceTransaction[],
  transaction: FinanceTransaction,
  updatedAt: string,
): FinanceTransaction[] {
  const existingCategory = financeMerchantCategory(
    transactions.filter((row) => row.id !== transaction.id),
    transaction.merchant,
  );
  const updated = {
    ...transaction,
    categoryId: existingCategory ?? transaction.categoryId,
    updatedAt,
  };
  const index = transactions.findIndex((row) => row.id === transaction.id);
  const next = [...transactions];
  if (index < 0) next.push(updated);
  else next[index] = updated;
  return harmonizeFinanceMerchantCategories(next);
}

/** Repairs legacy snapshots where the same merchant has multiple categories. */
export function harmonizeFinanceMerchantCategories(
  transactions: readonly FinanceTransaction[],
): FinanceTransaction[] {
  const preferredByMerchant = new Map<string, FinanceTransaction>();
  for (const transaction of transactions) {
    if (!isGeneralTransaction(transaction)) continue;
    const key = financeMerchantKey(transaction.merchant);
    if (!key) continue;
    preferredByMerchant.set(
      key,
      preferredCategoryTransaction(preferredByMerchant.get(key), transaction),
    );
  }

  return transactions.map((transaction) => {
    if (!isGeneralTransaction(transaction)) return transaction;
    const categoryId = preferredByMerchant.get(
      financeMerchantKey(transaction.merchant),
    )?.categoryId;
    return categoryId && categoryId !== transaction.categoryId
      ? { ...transaction, categoryId }
      : transaction;
  });
}
