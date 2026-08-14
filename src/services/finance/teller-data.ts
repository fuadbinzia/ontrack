import type { TellerLinkedAccount, TellerLinkedTransaction } from './teller';
import {
  TellerServerError,
  tellerGatewayRequest,
  type StoredTellerEnrollment,
} from './teller-server';

type TellerAccountRow = {
  id?: string;
  name?: string;
  last_four?: string;
  currency?: string;
  type?: string;
  subtype?: string;
  status?: string;
  institution?: { name?: string };
  links?: { balances?: string; transactions?: string };
};

type TellerBalanceRow = { ledger?: string | null; available?: string | null };

type TellerTransactionRow = {
  id?: string;
  account_id?: string;
  amount?: string;
  date?: string;
  description?: string;
  status?: string;
  details?: {
    category?: string;
    counterparty?: { name?: string };
  };
};

function finite(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function accountKind(row: TellerAccountRow): TellerLinkedAccount['kind'] {
  if (row.type === 'credit' || row.subtype === 'credit_card') return 'card';
  return 'bank';
}

export function mapTellerTransaction(
  row: TellerTransactionRow,
): TellerLinkedTransaction | undefined {
  const amount = finite(row.amount);
  if (!row.id || !row.account_id || !row.date || amount === undefined || amount <= 0) {
    return undefined;
  }
  return {
    externalId: row.id,
    accountId: row.account_id,
    amount,
    date: row.date,
    merchant: row.details?.counterparty?.name || row.description || 'Transaction',
    categoryHint: row.details?.category,
  };
}

function overlapStart(lastSyncedAt: string | undefined): string | undefined {
  if (!lastSyncedAt) return undefined;
  const date = new Date(lastSyncedAt);
  if (!Number.isFinite(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() - 10);
  return date.toISOString().slice(0, 10);
}

async function loadTransactions(
  accessToken: string,
  accountId: string,
  startDate?: string,
): Promise<TellerLinkedTransaction[]> {
  const output = new Map<string, TellerLinkedTransaction>();
  let fromId: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const rows = await tellerGatewayRequest<TellerTransactionRow[]>({
      operation: 'transactions',
      accessToken,
      accountId,
      query: {
        count: '500',
        ...(startDate ? { start_date: startDate } : {}),
        ...(fromId ? { from_id: fromId } : {}),
      },
    });
    for (const row of rows) {
      const mapped = mapTellerTransaction(row);
      if (mapped) output.set(mapped.externalId, mapped);
    }
    if (rows.length < 500) return [...output.values()];
    const next = rows.at(-1)?.id;
    if (!next || next === fromId) {
      throw new TellerServerError('Teller transaction pagination did not advance.', 'PAGINATION_STALLED');
    }
    fromId = next;
  }
  throw new TellerServerError('Teller transaction pagination exceeded its safety limit.', 'PAGINATION_LIMIT');
}

export async function loadTellerEnrollmentData(enrollment: StoredTellerEnrollment): Promise<{
  institutionName?: string;
  accounts: TellerLinkedAccount[];
  transactions: TellerLinkedTransaction[];
  refreshedFrom?: string;
}> {
  const rows = await tellerGatewayRequest<TellerAccountRow[]>({
    operation: 'accounts',
    accessToken: enrollment.accessToken,
  });
  const openRows = rows.filter((row) => row.id && row.status !== 'closed');
  const refreshedFrom = overlapStart(enrollment.lastSyncedAt);
  const accounts: TellerLinkedAccount[] = [];
  const transactions: TellerLinkedTransaction[] = [];

  for (const row of openRows) {
    const accountId = row.id!;
    let balance: number | undefined;
    if (row.links?.balances) {
      const balances = await tellerGatewayRequest<TellerBalanceRow>({
        operation: 'balances',
        accessToken: enrollment.accessToken,
        accountId,
      });
      balance = finite(balances.ledger) ?? finite(balances.available);
    }
    accounts.push({
      accountId,
      name: row.name || 'Account',
      mask: row.last_four,
      kind: accountKind(row),
      balance,
      currency: row.currency,
    });
    if (row.links?.transactions) {
      transactions.push(...await loadTransactions(
        enrollment.accessToken,
        accountId,
        refreshedFrom,
      ));
    }
  }
  return {
    institutionName: enrollment.institutionName || openRows[0]?.institution?.name,
    accounts,
    transactions,
    refreshedFrom,
  };
}
