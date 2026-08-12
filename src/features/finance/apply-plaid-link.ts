import { createFinanceAccount, createFinanceHolding, createFinanceTransaction } from '@/features/finance/create';
import type { PlaidExchangeResult, PlaidSyncResult } from '@/services/finance/plaid';
import { useFinance } from '@/store/finance';
import { todayKey } from '@/utils/date';

import { mapPlaidAccountKind } from './plaid-account-kind';

type SuccessfulPlaidData = {
  itemId: string;
  institutionName?: string;
  purpose: 'transactions' | 'investments';
  accounts: Extract<PlaidExchangeResult, { ok: true }>['accounts'];
  holdings: Extract<PlaidExchangeResult, { ok: true }>['holdings'];
  transactions: Extract<PlaidExchangeResult, { ok: true }>['transactions'];
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
    (account) => account.plaidItemId === result.itemId,
  );
  const byPlaid = new Map(
    existingForItem
      .filter((account) => account.plaidAccountId)
      .map((account) => [account.plaidAccountId!, account]),
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
    for (const placeholder of existingForItem.filter((account) => !account.plaidAccountId)) {
      useFinance.getState().removeAccount(placeholder.id);
    }
  }

  if (!result.accounts.length) {
    for (const prior of existingForItem) {
      if (prior.plaidAccountId) accountIds.set(prior.plaidAccountId, prior.id);
      else accountIds.set('default', prior.id);
      if (prior.linkStatus !== linkStatus) saveAccount({ ...prior, linkStatus });
    }
    if (existingForItem.length) return accountIds;

    const account = createFinanceAccount({
      name: result.institutionName || 'Linked account',
      kind: result.purpose === 'investments' ? 'other_investment' : 'bank',
      currency: baseCurrency,
      linkStatus,
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
      .filter((account) => account.plaidItemId === result.itemId)
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
      }),
    ];
  });
  useFinance.getState().reconcilePlaidTransactions(
    transactions,
    result.removedExternalIds,
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
  const institutionName = useFinance.getState().accounts.find(
    (account) => account.plaidItemId === itemId,
  )?.plaidInstitutionName;
  applyPlaidData({ ...result, itemId, institutionName }, entityId, baseCurrency);
}
