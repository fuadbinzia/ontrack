import { createFinanceAccount, createFinanceHolding, createFinanceTransaction } from '@/features/finance/create';
import type { PlaidExchangeResult, PlaidSyncResult } from '@/services/finance/plaid';
import { useFinance } from '@/store/finance';
import { todayKey } from '@/utils/date';

import { mapPlaidAccountKind } from './plaid-account-kind';
import { refreshLocalSubscriptionCandidates } from './refresh-subscription-candidates';
import {
  recurringKindForDescription,
  subscriptionMaterialFingerprint,
} from './subscriptions';
import type { FinanceSubscriptionCandidate } from './types';

type SuccessfulPlaidData = {
  itemId: string;
  institutionName?: string;
  purpose: 'transactions' | 'investments';
  accounts: Extract<PlaidExchangeResult, { ok: true }>['accounts'];
  holdings: Extract<PlaidExchangeResult, { ok: true }>['holdings'];
  transactions: Extract<PlaidExchangeResult, { ok: true }>['transactions'];
  recurringOutflows?: Extract<PlaidExchangeResult, { ok: true }>['recurringOutflows'];
  recurringStatus?: Extract<PlaidExchangeResult, { ok: true }>['recurringStatus'];
  removedExternalIds: string[];
  syncStatus: Extract<PlaidExchangeResult, { ok: true }>['syncStatus'];
};

function linkStatusForSync(
  status: SuccessfulPlaidData['syncStatus'],
): 'linked' | 'pending' | 'error' {
  if (status === 'error') return 'error';
  if (status === 'pending') return 'pending';
  return 'linked';
}

function upsertLinkedAccounts(
  result: SuccessfulPlaidData,
  baseCurrency: string,
): Map<string, string> {
  const asOf = todayKey();
  const saveAccount = useFinance.getState().saveAccount;
  const existing = useFinance.getState().accounts;
  const existingForItem = existing.filter(
    (account) => account.connectionId === result.itemId || account.plaidItemId === result.itemId,
  );
  const byPlaid = new Map(
    existingForItem
      .filter((account) => account.externalAccountId || account.plaidAccountId)
      .map((account) => [(account.externalAccountId ?? account.plaidAccountId)!, account]),
  );
  const accountIds = new Map<string, string>();
  const linkStatus = linkStatusForSync(result.syncStatus);

  for (const row of result.accounts) {
    const prior = row.accountId ? byPlaid.get(row.accountId) : undefined;
    const account = createFinanceAccount({
      id: prior?.id,
      name: row.name || result.institutionName || 'Linked account',
      kind: row.kind ?? mapPlaidAccountKind(row.type, row.subtype),
      last4: row.mask ?? prior?.last4,
      balance: row.balance ?? prior?.balance,
      balanceAsOf: row.balance != null ? asOf : prior?.balanceAsOf,
      currency: row.currency || prior?.currency || baseCurrency,
      linkStatus,
      provider: 'plaid',
      connectionId: result.itemId,
      institutionName: result.institutionName ?? prior?.institutionName,
      externalAccountId: row.accountId,
      plaidItemId: result.itemId,
      plaidInstitutionName: result.institutionName ?? prior?.plaidInstitutionName,
      plaidAccountId: row.accountId,
      aprPercent: prior?.aprPercent,
      createdAt: prior?.createdAt,
    });
    saveAccount(account);
    if (row.accountId) accountIds.set(row.accountId, account.id);
  }

  if (result.accounts.length) {
    for (const placeholder of existingForItem.filter(
      (account) => !account.externalAccountId && !account.plaidAccountId,
    )) {
      useFinance.getState().removeAccount(placeholder.id);
    }
  }

  if (!result.accounts.length) {
    for (const prior of existingForItem) {
      const externalAccountId = prior.externalAccountId ?? prior.plaidAccountId;
      if (externalAccountId) accountIds.set(externalAccountId, prior.id);
      else accountIds.set('default', prior.id);
      if (prior.linkStatus !== linkStatus) saveAccount({ ...prior, linkStatus });
    }
    if (existingForItem.length) return accountIds;

    const account = createFinanceAccount({
      name: result.institutionName || 'Linked account',
      kind: result.purpose === 'investments' ? 'other_investment' : 'bank',
      currency: baseCurrency,
      linkStatus,
      provider: 'plaid',
      connectionId: result.itemId,
      institutionName: result.institutionName,
      plaidItemId: result.itemId,
      plaidInstitutionName: result.institutionName,
    });
    saveAccount(account);
    accountIds.set('default', account.id);
  }

  return accountIds;
}

function reconcileHoldings(
  result: SuccessfulPlaidData,
  accountIds: Map<string, string>,
  baseCurrency: string,
) {
  const localAccountIds = [...new Set([
    ...accountIds.values(),
    ...useFinance.getState().accounts
      .filter((account) =>
        account.connectionId === result.itemId || account.plaidItemId === result.itemId,
      )
      .map((account) => account.id),
  ])];
  const fallbackAccountId = localAccountIds[0];
  const holdings = result.holdings
    .map((row) =>
      createFinanceHolding({
        accountId:
          (row.accountId ? accountIds.get(row.accountId) : undefined) ??
          fallbackAccountId ??
          '',
        symbol: row.symbol,
        name: row.name,
        quantity: row.quantity,
        value: row.value,
        currency: row.currency || baseCurrency,
        asOf: row.asOf,
        externalId: row.externalId,
      }),
    )
    .filter((holding) => holding.accountId);
  useFinance.getState().replacePlaidHoldings(localAccountIds, holdings);
}

function reconcileTransactions(
  result: SuccessfulPlaidData,
  accountIds: Map<string, string>,
  entityId: string,
  baseCurrency: string,
) {
  const transactions = result.transactions.flatMap((row) => {
    const accountId = accountIds.get(row.accountId);
    if (!accountId) return [];
    return [
      createFinanceTransaction({
        amount: row.amount,
        currency: row.currency || baseCurrency,
        date: row.date,
        merchant: row.merchant,
        categoryId: 'other',
        entityId,
        accountId,
        source: 'plaid',
        externalId: row.externalId,
        sourceCategory: row.categoryHint,
      }),
    ];
  });
  useFinance.getState().reconcilePlaidTransactions(
    transactions,
    result.removedExternalIds,
  );
}

function reconcileSubscriptions(
  result: SuccessfulPlaidData,
  accountIds: Map<string, string>,
  baseCurrency: string,
) {
  useFinance.getState().setSubscriptionDetectionStatus(
    result.recurringStatus === 'ready'
      ? 'ready'
      : result.recurringStatus === 'pending'
        ? 'pending'
        : 'fallback',
  );
  const now = new Date().toISOString();
  const candidates: FinanceSubscriptionCandidate[] = result.recurringStatus === 'ready'
      ? (result.recurringOutflows ?? []).flatMap((row) => {
        const accountId = accountIds.get(row.accountId);
        const suggestedKind = recurringKindForDescription(row.name, row.categoryHint);
        if (!accountId || !suggestedKind) return [];
        const materialFingerprint = subscriptionMaterialFingerprint({
          amount: row.amount,
          cadence: row.frequency,
          active: row.active,
        });
        return [{
          id: `subscription:plaid:${result.itemId}:${row.streamId}`,
          source: 'plaid' as const,
          status: 'pending' as const,
          provider: 'plaid' as const,
          connectionId: result.itemId,
          externalStreamId: row.streamId,
          name: row.name,
          amount: row.amount,
          currency: row.currency || baseCurrency,
          cadence: row.frequency,
          nextDue: row.predictedNextDate,
          accountId,
          categoryHint: row.categoryHint,
          suggestedKind,
          confidence: 0.98,
          active: row.active,
          materialFingerprint,
          detectedAt: now,
        }];
      })
    : [];
  useFinance.getState().reconcileSubscriptionCandidates(
    'plaid',
    result.itemId,
    candidates,
  );
}

function applyPlaidData(
  result: SuccessfulPlaidData,
  entityId: string,
  baseCurrency: string,
) {
  const accountIds = upsertLinkedAccounts(result, baseCurrency);
  if (result.purpose === 'investments') {
    reconcileHoldings(result, accountIds, baseCurrency);
  } else {
    reconcileTransactions(result, accountIds, entityId, baseCurrency);
    reconcileSubscriptions(result, accountIds, baseCurrency);
    refreshLocalSubscriptionCandidates();
  }
}

/** Persist linked accounts and the first server-side Plaid sync. */
export function applyPlaidExchangeResult(
  result: Extract<PlaidExchangeResult, { ok: true }>,
  entityId: string,
  baseCurrency: string,
): void {
  applyPlaidData(result, entityId, baseCurrency);
}

/** Reconcile a later Item sync without exposing the Item access token. */
export function applyPlaidSyncResult(
  itemId: string,
  result: Extract<PlaidSyncResult, { ok: true }>,
  entityId: string,
  baseCurrency: string,
): void {
  const linkedAccount = useFinance.getState().accounts.find(
    (account) => account.connectionId === itemId || account.plaidItemId === itemId,
  );
  const institutionName = linkedAccount?.institutionName ?? linkedAccount?.plaidInstitutionName;
  applyPlaidData({ ...result, itemId, institutionName }, entityId, baseCurrency);
}
