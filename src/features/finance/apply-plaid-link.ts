import { createFinanceAccount, createFinanceHolding, createFinanceTransaction } from '@/features/finance/create';
import type { PlaidExchangeResult } from '@/services/finance/plaid';
import { savePlaidAccessToken } from '@/services/finance/plaid-secure';
import { useFinance } from '@/store/finance';
import { todayKey } from '@/utils/date';

import { mapPlaidAccountKind } from './plaid-account-kind';

function upsertLinkedAccounts(
  result: Extract<PlaidExchangeResult, { ok: true }>,
  baseCurrency: string,
): Map<string, string> {
  const asOf = todayKey();
  const saveAccount = useFinance.getState().saveAccount;
  const existing = useFinance.getState().accounts;
  const byPlaid = new Map(
    existing
      .filter((a) => a.plaidItemId === result.itemId && a.plaidAccountId)
      .map((a) => [a.plaidAccountId!, a]),
  );
  const accountIds = new Map<string, string>();

  for (const row of result.accounts) {
    const prior = row.accountId ? byPlaid.get(row.accountId) : undefined;
    const account = createFinanceAccount({
      id: prior?.id,
      name: row.name || result.institutionName || 'Linked account',
      kind: row.kind ?? mapPlaidAccountKind(row.type, row.subtype),
      last4: row.mask ?? prior?.last4,
      balance: row.balance ?? prior?.balance,
      balanceAsOf: row.balance != null ? asOf : prior?.balanceAsOf,
      currency: row.currency || baseCurrency,
      linkStatus: 'linked',
      plaidItemId: result.itemId,
      plaidInstitutionName: result.institutionName,
      plaidAccountId: row.accountId,
      aprPercent: prior?.aprPercent,
      createdAt: prior?.createdAt,
    });
    saveAccount(account);
    if (row.accountId) accountIds.set(row.accountId, account.id);
  }

  if (!result.accounts.length) {
    const account = createFinanceAccount({
      name: result.institutionName || 'Linked account',
      kind: result.purpose === 'investments' ? 'other_investment' : 'bank',
      currency: baseCurrency,
      linkStatus: 'linked',
      plaidItemId: result.itemId,
      plaidInstitutionName: result.institutionName,
    });
    saveAccount(account);
    accountIds.set('default', account.id);
  }

  return accountIds;
}

function applyHoldings(
  result: Extract<PlaidExchangeResult, { ok: true }>,
  accountIds: Map<string, string>,
  baseCurrency: string,
) {
  if (!result.holdings.length) return;
  const fallbackAccountId = [...accountIds.values()][0];
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
    .filter((h) => h.accountId);
  useFinance.getState().upsertHoldings(holdings);
}

/** Persist linked accounts + recent Plaid transactions / holdings after token exchange. */
export async function applyPlaidExchangeResult(
  result: Extract<PlaidExchangeResult, { ok: true }>,
  entityId: string,
  baseCurrency: string,
): Promise<void> {
  if (result.accessToken) {
    await savePlaidAccessToken(result.itemId, result.accessToken);
  }

  const accountIds = upsertLinkedAccounts(result, baseCurrency);
  applyHoldings(result, accountIds, baseCurrency);

  const defaultAccountId = [...accountIds.values()][0];
  if (result.transactions.length && defaultAccountId) {
    useFinance.getState().upsertPlaidTransactions(
      result.transactions.map((t) =>
        createFinanceTransaction({
          amount: t.amount,
          currency: baseCurrency,
          date: t.date,
          merchant: t.merchant,
          categoryId: 'other',
          entityId,
          accountId: defaultAccountId,
          source: 'plaid',
          externalId: t.externalId,
        }),
      ),
    );
  }
}
