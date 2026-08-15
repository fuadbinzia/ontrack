import { mapPlaidAccountKind } from '@/features/finance/plaid-account-kind';

import type {
  PlaidLinkedAccount,
  PlaidLinkedHolding,
  PlaidRecurringStatus,
  PlaidRecurringOutflow,
  PlaidLinkedTransaction,
} from './plaid';
import { PlaidServerError, plaidRequest } from './plaid-server';

type PlaidAccountRow = {
  account_id?: string;
  name?: string;
  official_name?: string;
  mask?: string;
  type?: string;
  subtype?: string;
  balances?: {
    current?: number;
    iso_currency_code?: string;
    unofficial_currency_code?: string;
  };
};

type PlaidTransactionRow = {
  transaction_id?: string;
  account_id?: string;
  amount?: number;
  date?: string;
  name?: string;
  merchant_name?: string;
  pending?: boolean;
  iso_currency_code?: string;
  unofficial_currency_code?: string;
  category?: string[];
  personal_finance_category?: { primary?: string; detailed?: string };
};

type PlaidRecurringStreamRow = {
  stream_id?: string;
  account_id?: string;
  description?: string;
  merchant_name?: string | null;
  predicted_next_date?: string | null;
  frequency?: string;
  average_amount?: number | {
    amount?: number;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
  last_amount?: number | {
    amount?: number;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
  is_active?: boolean;
  personal_finance_category?: { primary?: string; detailed?: string };
};

function recurringAmount(value: PlaidRecurringStreamRow['last_amount']): {
  amount?: number;
  currency?: string;
} {
  if (typeof value === 'number') return { amount: value };
  return {
    amount: value?.amount,
    currency: value?.iso_currency_code || value?.unofficial_currency_code || undefined,
  };
}

function recurringFrequency(value: string | undefined): PlaidRecurringOutflow['frequency'] | undefined {
  switch (value?.toUpperCase()) {
    case 'WEEKLY': return 'weekly';
    case 'BIWEEKLY': return 'biweekly';
    case 'MONTHLY': return 'monthly';
    case 'ANNUALLY': return 'yearly';
    default: return undefined;
  }
}

export function mapPlaidRecurringOutflows(
  rows: PlaidRecurringStreamRow[] | undefined,
): PlaidRecurringOutflow[] {
  return (rows ?? []).flatMap((row) => {
    const frequency = recurringFrequency(row.frequency);
    const last = recurringAmount(row.last_amount);
    const average = recurringAmount(row.average_amount);
    const amount = last.amount ?? average.amount;
    if (
      !row.stream_id ||
      !row.account_id ||
      !row.predicted_next_date ||
      !frequency ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) return [];
    return [{
      streamId: row.stream_id,
      accountId: row.account_id,
      name: row.merchant_name || row.description || 'Subscription',
      amount,
      currency: last.currency || average.currency,
      frequency,
      predictedNextDate: row.predicted_next_date,
      categoryHint:
        row.personal_finance_category?.detailed || row.personal_finance_category?.primary,
      active: row.is_active !== false,
    }];
  });
}

export function mapPlaidAccounts(rows: PlaidAccountRow[] | undefined): PlaidLinkedAccount[] {
  return (rows ?? []).map((row) => ({
    accountId: row.account_id,
    name: row.official_name || row.name || 'Account',
    mask: row.mask,
    type: row.type,
    subtype: row.subtype,
    kind: mapPlaidAccountKind(row.type, row.subtype),
    balance:
      typeof row.balances?.current === 'number' && Number.isFinite(row.balances.current)
        ? row.balances.current
        : undefined,
    currency:
      row.balances?.iso_currency_code || row.balances?.unofficial_currency_code || undefined,
  }));
}

function mapExpenseTransaction(row: PlaidTransactionRow): PlaidLinkedTransaction | undefined {
  if (
    !row.transaction_id ||
    !row.account_id ||
    !row.date ||
    typeof row.amount !== 'number' ||
    !Number.isFinite(row.amount) ||
    row.amount <= 0
  ) {
    return undefined;
  }
  return {
    externalId: row.transaction_id,
    accountId: row.account_id,
    amount: row.amount,
    currency: row.iso_currency_code || row.unofficial_currency_code || undefined,
    date: row.date,
    merchant: row.merchant_name || row.name || 'Transaction',
    categoryHint:
      row.personal_finance_category?.detailed ||
      row.personal_finance_category?.primary ||
      row.category?.[0],
  };
}

type TransactionSyncBody = {
  added?: PlaidTransactionRow[];
  modified?: PlaidTransactionRow[];
  removed?: { transaction_id?: string }[];
  next_cursor?: string;
  has_more?: boolean;
};

export type PlaidTransactionChanges = {
  transactions: PlaidLinkedTransaction[];
  removedExternalIds: string[];
  cursor: string;
  pending: boolean;
};

async function transactionSyncAttempt(
  accessToken: string,
  initialCursor: string | null,
): Promise<PlaidTransactionChanges> {
  let cursor = initialCursor;
  const transactions = new Map<string, PlaidLinkedTransaction>();
  const removed = new Set<string>();

  for (let page = 0; page < 100; page += 1) {
    const response = await plaidRequest<TransactionSyncBody>('/transactions/sync', {
      access_token: accessToken,
      count: 500,
      ...(cursor !== null ? { cursor } : {}),
    });
    for (const row of [...(response.added ?? []), ...(response.modified ?? [])]) {
      if (!row.transaction_id) continue;
      const mapped = mapExpenseTransaction(row);
      if (mapped) {
        transactions.set(mapped.externalId, mapped);
        removed.delete(mapped.externalId);
      } else {
        transactions.delete(row.transaction_id);
        removed.add(row.transaction_id);
      }
    }
    for (const row of response.removed ?? []) {
      if (!row.transaction_id) continue;
      transactions.delete(row.transaction_id);
      removed.add(row.transaction_id);
    }
    if (typeof response.next_cursor !== 'string') {
      throw new PlaidServerError('Plaid did not return a transaction cursor.', 'INVALID_RESPONSE');
    }
    cursor = response.next_cursor;
    if (!response.has_more) {
      return {
        transactions: [...transactions.values()],
        removedExternalIds: [...removed],
        cursor,
        pending: initialCursor === null && cursor === '' && transactions.size === 0,
      };
    }
  }
  throw new PlaidServerError('Plaid transaction pagination exceeded its safety limit.', 'PAGINATION_LIMIT');
}

export async function syncPlaidTransactionChanges(
  accessToken: string,
  cursor: string | null,
): Promise<PlaidTransactionChanges> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await transactionSyncAttempt(accessToken, cursor);
    } catch (error) {
      if (
        !(error instanceof PlaidServerError) ||
        error.code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }
  throw new PlaidServerError('Plaid transaction sync could not stabilize.', 'SYNC_RETRY_EXHAUSTED');
}

type HoldingsBody = {
  accounts?: PlaidAccountRow[];
  holdings?: {
    account_id?: string;
    security_id?: string;
    quantity?: number;
    institution_value?: number;
    iso_currency_code?: string;
    unofficial_currency_code?: string;
  }[];
  securities?: { security_id?: string; ticker_symbol?: string; name?: string }[];
};

export async function loadPlaidHoldings(accessToken: string): Promise<{
  accounts: PlaidLinkedAccount[];
  holdings: PlaidLinkedHolding[];
}> {
  const body = await plaidRequest<HoldingsBody>('/investments/holdings/get', {
    access_token: accessToken,
  });
  const securities = new Map(
    (body.securities ?? [])
      .filter((row) => row.security_id)
      .map((row) => [row.security_id!, row]),
  );
  const asOf = new Date().toISOString().slice(0, 10);
  return {
    accounts: mapPlaidAccounts(body.accounts),
    holdings: (body.holdings ?? [])
      .filter(
        (row) =>
          row.account_id &&
          row.security_id &&
          typeof row.institution_value === 'number' &&
          Number.isFinite(row.institution_value),
      )
      .map((row) => {
        const security = securities.get(row.security_id!);
        return {
          accountId: row.account_id,
          externalId: `${row.account_id}:${row.security_id}`,
          symbol: security?.ticker_symbol || undefined,
          name: security?.name || security?.ticker_symbol || 'Holding',
          quantity:
            typeof row.quantity === 'number' && Number.isFinite(row.quantity)
              ? row.quantity
              : undefined,
          value: row.institution_value!,
          currency: row.iso_currency_code || row.unofficial_currency_code || 'USD',
          asOf,
        };
      }),
  };
}

export async function loadPlaidAccounts(accessToken: string): Promise<PlaidLinkedAccount[]> {
  const body = await plaidRequest<{ accounts?: PlaidAccountRow[] }>('/accounts/get', {
    access_token: accessToken,
  });
  return mapPlaidAccounts(body.accounts);
}

export async function loadPlaidRecurringOutflows(
  accessToken: string,
): Promise<PlaidRecurringOutflow[]> {
  const body = await plaidRequest<{ outflow_streams?: PlaidRecurringStreamRow[] }>(
    '/transactions/recurring/get',
    {
      access_token: accessToken,
      options: { personal_finance_category_version: 'v2' },
    },
  );
  return mapPlaidRecurringOutflows(body.outflow_streams);
}

export async function loadPlaidRecurringResult(accessToken: string): Promise<{
  outflows: PlaidRecurringOutflow[];
  status: PlaidRecurringStatus;
}> {
  try {
    return { outflows: await loadPlaidRecurringOutflows(accessToken), status: 'ready' };
  } catch (error) {
    if (error instanceof PlaidServerError && error.code === 'PRODUCT_NOT_READY') {
      return { outflows: [], status: 'pending' };
    }
    const unavailableCodes = new Set([
      'ADDITIONAL_CONSENT_REQUIRED',
      'INVALID_PRODUCT',
      'PRODUCTS_NOT_SUPPORTED',
      'RECURRING_TRANSACTIONS_NOT_SUPPORTED',
    ]);
    if (error instanceof PlaidServerError && error.code && unavailableCodes.has(error.code)) {
      return { outflows: [], status: 'unavailable' };
    }
    return { outflows: [], status: 'error' };
  }
}
