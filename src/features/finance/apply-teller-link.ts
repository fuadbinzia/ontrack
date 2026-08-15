import { createFinanceAccount, createFinanceTransaction } from '@/features/finance/create';
import type { TellerSyncResult } from '@/services/finance/teller';
import { useFinance } from '@/store/finance';
import { todayKey } from '@/utils/date';

import { refreshLocalSubscriptionCandidates } from './refresh-subscription-candidates';

type SuccessfulTellerSync = Extract<TellerSyncResult, { ok: true }>;

export function applyTellerSyncResult(
  result: SuccessfulTellerSync,
  entityId: string,
  baseCurrency: string,
): void {
  const state = useFinance.getState();
  const existing = state.accounts.filter(
    (account) => account.provider === 'teller' && account.connectionId === result.connectionId,
  );
  const byExternalId = new Map(
    existing
      .filter((account) => account.externalAccountId)
      .map((account) => [account.externalAccountId!, account]),
  );
  const localIds = new Map<string, string>();

  for (const row of result.accounts) {
    const prior = byExternalId.get(row.accountId);
    const account = createFinanceAccount({
      id: prior?.id,
      name: row.name,
      kind: row.kind,
      last4: row.mask ?? prior?.last4,
      balance: row.balance ?? prior?.balance,
      balanceAsOf: row.balance != null ? todayKey() : prior?.balanceAsOf,
      currency: row.currency || prior?.currency || baseCurrency,
      linkStatus: result.syncStatus === 'error' ? 'error' : 'linked',
      provider: 'teller',
      connectionId: result.connectionId,
      institutionName: result.institutionName ?? prior?.institutionName,
      externalAccountId: row.accountId,
      aprPercent: prior?.aprPercent,
      createdAt: prior?.createdAt,
    });
    state.saveAccount(account);
    localIds.set(row.accountId, account.id);
  }

  const currentExternalIds = new Set(result.accounts.map((account) => account.accountId));
  for (const stale of existing) {
    if (stale.externalAccountId && !currentExternalIds.has(stale.externalAccountId)) {
      for (const transaction of useFinance.getState().transactions) {
        if (transaction.accountId !== stale.id) continue;
        if (transaction.source === 'teller') state.removeTransaction(transaction.id);
        else state.saveTransaction({ ...transaction, accountId: undefined });
      }
      state.removeAccount(stale.id);
    }
  }

  const transactions = result.transactions.flatMap((row) => {
    const accountId = localIds.get(row.accountId);
    if (!accountId) return [];
    return [createFinanceTransaction({
      amount: row.amount,
      currency: row.currency || baseCurrency,
      date: row.date,
      merchant: row.merchant,
      categoryId: 'other',
      entityId,
      accountId,
      source: 'teller',
      externalId: row.externalId,
      sourceCategory: row.categoryHint,
    })];
  });
  state.reconcileLinkedTransactions(
    'teller',
    [...localIds.values()],
    transactions,
    result.refreshedFrom,
  );
  refreshLocalSubscriptionCandidates();
  useFinance.getState().setSubscriptionDetectionStatus('fallback');
}
