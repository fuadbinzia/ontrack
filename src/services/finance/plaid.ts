import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

import { mapPlaidAccountKind } from '@/features/finance/plaid-account-kind';
import type { FinanceAccountKind } from '@/features/finance/types';

export class FinanceServiceError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'FinanceServiceError';
    this.code = code;
    this.status = status;
  }
}

export type PlaidLinkPurpose = 'transactions' | 'investments';

export type PlaidLinkTokenResult =
  | { ok: true; linkToken: string }
  | { ok: false; error: string; configured: boolean };

export type PlaidLinkedAccount = {
  accountId?: string;
  name: string;
  mask?: string;
  type?: string;
  subtype?: string;
  kind: FinanceAccountKind;
  balance?: number;
  currency?: string;
};

export type PlaidLinkedHolding = {
  accountId?: string;
  externalId: string;
  symbol?: string;
  name: string;
  quantity?: number;
  value: number;
  currency: string;
  asOf: string;
};

export type PlaidExchangeResult =
  | {
      ok: true;
      itemId: string;
      accessToken?: string;
      institutionName?: string;
      purpose: PlaidLinkPurpose;
      accounts: PlaidLinkedAccount[];
      holdings: PlaidLinkedHolding[];
      transactions: {
        externalId: string;
        amount: number;
        date: string;
        merchant: string;
        categoryHint?: string;
      }[];
    }
  | { ok: false; error: string; configured: boolean };

export type PlaidSyncResult =
  | {
      ok: true;
      purpose: PlaidLinkPurpose;
      accounts: PlaidLinkedAccount[];
      holdings: PlaidLinkedHolding[];
      transactions: {
        externalId: string;
        amount: number;
        date: string;
        merchant: string;
        categoryHint?: string;
      }[];
    }
  | { ok: false; error: string; configured: boolean };

type PlaidAccountPayload = {
  account_id?: string;
  name: string;
  mask?: string;
  type?: string;
  subtype?: string;
  balance?: number;
  currency?: string;
};

type PlaidHoldingPayload = {
  account_id?: string;
  external_id: string;
  symbol?: string;
  name: string;
  quantity?: number;
  value: number;
  currency: string;
  as_of: string;
};

function mapAccounts(rows: PlaidAccountPayload[] | undefined): PlaidLinkedAccount[] {
  return (rows ?? []).map((row) => ({
    accountId: row.account_id,
    name: row.name,
    mask: row.mask,
    type: row.type,
    subtype: row.subtype,
    kind: mapPlaidAccountKind(row.type, row.subtype),
    balance: typeof row.balance === 'number' ? row.balance : undefined,
    currency: row.currency,
  }));
}

function mapHoldings(rows: PlaidHoldingPayload[] | undefined): PlaidLinkedHolding[] {
  return (rows ?? []).map((row) => ({
    accountId: row.account_id,
    externalId: row.external_id,
    symbol: row.symbol,
    name: row.name,
    quantity: row.quantity,
    value: row.value,
    currency: row.currency,
    asOf: row.as_of,
  }));
}

function financeApiUrl(path: string): string {
  return resolveExpoApiUrl(path, {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    createNotConfiguredError: () =>
      new FinanceServiceError(
        'Finance services are not configured for this build.',
        'NOT_CONFIGURED',
      ),
  });
}

/** Create a Plaid Link token when server credentials are configured. */
export async function createPlaidLinkToken(
  purpose: PlaidLinkPurpose = 'transactions',
): Promise<PlaidLinkTokenResult> {
  try {
    const data = await apiRequest<{
      link_token?: string;
      error?: string;
      configured?: boolean;
    }, FinanceServiceError>({
      url: financeApiUrl('/api/finance/plaid/link-token'),
      method: 'POST',
      body: { purpose },
      authenticate: true,
      offlineMessage: 'Connect to the internet to link a bank account.',
      unavailableMessage: 'Bank linking is temporarily unavailable.',
      createError: (message, code, status) =>
        new FinanceServiceError(message, code, status),
    });
    if (data.link_token) return { ok: true, linkToken: data.link_token };
    return {
      ok: false,
      error: data.error ?? 'Plaid is not configured',
      configured: data.configured === true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start bank link';
    const configured = !(
      error instanceof FinanceServiceError && error.code === 'NOT_CONFIGURED'
    );
    return { ok: false, error: message, configured };
  }
}

/** Exchange a public token; server returns item metadata + recent transactions. */
export async function exchangePlaidPublicToken(
  publicToken: string,
  purpose: PlaidLinkPurpose = 'transactions',
): Promise<PlaidExchangeResult> {
  try {
    const data = await apiRequest<{
      item_id?: string;
      access_token?: string;
      institution_name?: string;
      purpose?: PlaidLinkPurpose;
      accounts?: PlaidAccountPayload[];
      holdings?: PlaidHoldingPayload[];
      transactions?: {
        external_id: string;
        amount: number;
        date: string;
        merchant: string;
        category_hint?: string;
      }[];
      error?: string;
      configured?: boolean;
    }, FinanceServiceError>({
      url: financeApiUrl('/api/finance/plaid/exchange'),
      method: 'POST',
      body: { public_token: publicToken, purpose },
      authenticate: true,
      offlineMessage: 'Connect to the internet to finish linking.',
      unavailableMessage: 'Bank linking is temporarily unavailable.',
      createError: (message, code, status) =>
        new FinanceServiceError(message, code, status),
    });
    if (!data.item_id) {
      return {
        ok: false,
        error: data.error ?? 'Exchange failed',
        configured: data.configured === true,
      };
    }
    return {
      ok: true,
      itemId: data.item_id,
      accessToken: data.access_token,
      institutionName: data.institution_name,
      purpose: data.purpose === 'investments' ? 'investments' : 'transactions',
      accounts: mapAccounts(data.accounts),
      holdings: mapHoldings(data.holdings),
      transactions: (data.transactions ?? []).map((t) => ({
        externalId: t.external_id,
        amount: t.amount,
        date: t.date,
        merchant: t.merchant,
        categoryHint: t.category_hint,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not link account',
      configured: false,
    };
  }
}

/** Refresh transactions or holdings for a linked item. */
export async function syncPlaidTransactions(
  accessToken: string,
  days = 30,
  purpose: PlaidLinkPurpose = 'transactions',
): Promise<PlaidSyncResult> {
  try {
    const data = await apiRequest<{
      purpose?: PlaidLinkPurpose;
      accounts?: PlaidAccountPayload[];
      holdings?: PlaidHoldingPayload[];
      transactions?: {
        external_id: string;
        amount: number;
        date: string;
        merchant: string;
        category_hint?: string;
      }[];
      error?: string;
      configured?: boolean;
    }, FinanceServiceError>({
      url: financeApiUrl('/api/finance/plaid/sync'),
      method: 'POST',
      body: { access_token: accessToken, days, purpose },
      authenticate: true,
      offlineMessage: 'Connect to the internet to sync transactions.',
      unavailableMessage: 'Bank sync is temporarily unavailable.',
      createError: (message, code, status) =>
        new FinanceServiceError(message, code, status),
    });
    if (data.error && !Array.isArray(data.transactions) && !Array.isArray(data.holdings)) {
      return {
        ok: false,
        error: data.error,
        configured: data.configured === true,
      };
    }
    return {
      ok: true,
      purpose: data.purpose === 'investments' ? 'investments' : 'transactions',
      accounts: mapAccounts(data.accounts),
      holdings: mapHoldings(data.holdings),
      transactions: (data.transactions ?? []).map((t) => ({
        externalId: t.external_id,
        amount: t.amount,
        date: t.date,
        merchant: t.merchant,
        categoryHint: t.category_hint,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not sync',
      configured: false,
    };
  }
}
