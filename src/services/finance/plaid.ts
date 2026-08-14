import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { mapPlaidAccountKind } from '@/features/finance/plaid-account-kind';
import type { FinanceAccountKind } from '@/features/finance/types';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

export class FinanceServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'FinanceServiceError';
  }
}

export type PlaidLinkPurpose = 'transactions' | 'investments';
export type PlaidSyncStatus = 'ready' | 'pending' | 'error';

export type PlaidLinkTokenResult =
  | {
      ok: true;
      linkToken: string;
      hostedLinkUrl: string;
      completionRedirectUri: string;
    }
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

export type PlaidLinkedTransaction = {
  externalId: string;
  accountId: string;
  amount: number;
  currency?: string;
  date: string;
  merchant: string;
  categoryHint?: string;
};

type PlaidDataResult = {
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
  purpose: PlaidLinkPurpose;
  accounts: PlaidLinkedAccount[];
  holdings: PlaidLinkedHolding[];
  transactions: PlaidLinkedTransaction[];
  removedExternalIds: string[];
  syncStatus: PlaidSyncStatus;
  syncError?: string;
};

export type PlaidExchangeResult =
  | ({ ok: true; itemId: string } & Omit<PlaidDataResult, 'itemId'>)
  | { ok: false; error: string; configured: boolean };

export type PlaidSyncResult =
  | ({ ok: true } & Omit<PlaidDataResult, 'itemId' | 'institutionId' | 'institutionName'>)
  | { ok: false; error: string; configured: boolean };

type PlaidApiData = {
  item_id?: string;
  institution_id?: string;
  institution_name?: string;
  purpose?: PlaidLinkPurpose;
  accounts?: PlaidLinkedAccount[];
  holdings?: PlaidLinkedHolding[];
  transactions?: PlaidLinkedTransaction[];
  removed_external_ids?: string[];
  sync_status?: PlaidSyncStatus;
  sync_error?: string;
  error?: string;
  configured?: boolean;
};

function financeApiUrl(path: string): string {
  const useHostedApi = __DEV__ && Platform.OS !== 'web';
  const configuredBaseUrl = useHostedApi
    ? process.env.EXPO_PUBLIC_FINANCE_API_BASE_URL || 'https://ontrack.expo.app'
    : process.env.EXPO_PUBLIC_API_BASE_URL;
  return resolveExpoApiUrl(path, {
    configuredBaseUrl,
    preferConfiguredFirst: useHostedApi || !__DEV__,
    requireHttpsInProduction: true,
    createNotConfiguredError: () =>
      new FinanceServiceError(
        'Finance services are not configured for this build.',
        'NOT_CONFIGURED',
      ),
  });
}

function request<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T, FinanceServiceError>({
    url: financeApiUrl(path),
    method: 'POST',
    body,
    authenticate: true,
    timeoutMs: 60_000,
    offlineMessage: 'Connect to the internet to use bank linking.',
    unavailableMessage: 'Bank linking is temporarily unavailable.',
    createError: (message, code, status) => new FinanceServiceError(message, code, status),
  });
}

function normalizeAccounts(rows: PlaidLinkedAccount[] | undefined): PlaidLinkedAccount[] {
  return (rows ?? []).map((row) => ({
    ...row,
    kind: row.kind ?? mapPlaidAccountKind(row.type, row.subtype),
  }));
}

function normalizeResult(data: PlaidApiData): PlaidDataResult {
  return {
    itemId: data.item_id,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    purpose: data.purpose === 'investments' ? 'investments' : 'transactions',
    accounts: normalizeAccounts(data.accounts),
    holdings: data.holdings ?? [],
    transactions: data.transactions ?? [],
    removedExternalIds: data.removed_external_ids ?? [],
    syncStatus:
      data.sync_status === 'pending' || data.sync_status === 'error'
        ? data.sync_status
        : 'ready',
    syncError: data.sync_error,
  };
}

export async function createPlaidLinkToken(
  purpose: Extract<PlaidLinkPurpose, 'investments'> = 'investments',
): Promise<PlaidLinkTokenResult> {
  try {
    const data = await request<{
      link_token?: string;
      hosted_link_url?: string;
      completion_redirect_uri?: string;
      configured?: boolean;
      error?: string;
    }>('/api/finance/plaid/link-token', {
      purpose,
      native: Platform.OS !== 'web',
    });
    if (data.link_token && data.hosted_link_url && data.completion_redirect_uri) {
      return {
        ok: true,
        linkToken: data.link_token,
        hostedLinkUrl: data.hosted_link_url,
        completionRedirectUri: data.completion_redirect_uri,
      };
    }
    return {
      ok: false,
      error: data.error ?? 'Plaid did not return a Hosted Link session.',
      configured: data.configured === true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not start bank link',
      configured: !(error instanceof FinanceServiceError && error.code === 'NOT_CONFIGURED'),
    };
  }
}

export async function openPlaidHostedLink(
  session: Extract<PlaidLinkTokenResult, { ok: true }>,
): Promise<void> {
  const result = await WebBrowser.openAuthSessionAsync(
    session.hostedLinkUrl,
    session.completionRedirectUri,
  );
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new FinanceServiceError('Plaid Link was cancelled.', 'CANCELLED');
  }
  if (result.type !== 'success') {
    throw new FinanceServiceError('Plaid Link did not finish.', 'LINK_INCOMPLETE');
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function completePlaidLink(linkToken: string): Promise<PlaidExchangeResult> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const data = await request<PlaidApiData>('/api/finance/plaid/exchange', {
        link_token: linkToken,
      });
      if (!data.item_id) {
        return {
          ok: false,
          error: data.error ?? 'Plaid Link did not create an Item.',
          configured: data.configured === true,
        };
      }
      return { ok: true, itemId: data.item_id, ...normalizeResult(data) };
    } catch (error) {
      if (
        error instanceof FinanceServiceError &&
        error.code === 'LINK_PENDING' &&
        attempt < 4
      ) {
        await wait(400 * (attempt + 1));
        continue;
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not finish bank link',
        configured: !(error instanceof FinanceServiceError && error.code === 'NOT_CONFIGURED'),
      };
    }
  }
  return { ok: false, error: 'Plaid Link is still completing.', configured: true };
}

export async function syncPlaidItem(itemId: string): Promise<PlaidSyncResult> {
  try {
    const data = await request<PlaidApiData>('/api/finance/plaid/sync', {
      item_id: itemId,
    });
    return { ok: true, ...normalizeResult(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not sync',
      configured: !(error instanceof FinanceServiceError && error.code === 'NOT_CONFIGURED'),
    };
  }
}

export async function disconnectPlaidItem(itemId: string): Promise<void> {
  await request('/api/finance/plaid/disconnect', { item_id: itemId });
}
