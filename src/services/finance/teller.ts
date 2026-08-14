import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import type { FinanceAccountKind } from '@/features/finance/types';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

import { FinanceServiceError } from './plaid';

export type TellerLinkedAccount = {
  accountId: string;
  name: string;
  mask?: string;
  kind: FinanceAccountKind;
  balance?: number;
  currency?: string;
};

export type TellerLinkedTransaction = {
  externalId: string;
  accountId: string;
  amount: number;
  currency?: string;
  date: string;
  merchant: string;
  categoryHint?: string;
};

export type TellerSyncResult =
  | {
      ok: true;
      connectionId: string;
      institutionName?: string;
      accounts: TellerLinkedAccount[];
      transactions: TellerLinkedTransaction[];
      refreshedFrom?: string;
      syncStatus: 'ready' | 'error';
      syncError?: string;
    }
  | { ok: false; error: string; configured: boolean };

type TellerSessionResult =
  | {
      ok: true;
      sessionId: string;
      connectUrl: string;
      completionRedirectUri: string;
    }
  | { ok: false; error: string; configured: boolean };

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
      new FinanceServiceError('Finance services are not configured for this build.', 'NOT_CONFIGURED'),
  });
}

async function request<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T, FinanceServiceError>({
    url: financeApiUrl(path),
    method: 'POST',
    body,
    authenticate: true,
    timeoutMs: 120_000,
    offlineMessage: 'Connect to the internet to use bank linking.',
    unavailableMessage: 'Bank linking is temporarily unavailable.',
    createError: (message, code, status) => new FinanceServiceError(message, code, status),
  });
}

function failure(error: unknown, fallback: string): { ok: false; error: string; configured: boolean } {
  return {
    ok: false,
    error: error instanceof Error ? error.message : fallback,
    configured: !(error instanceof FinanceServiceError && error.code === 'NOT_CONFIGURED'),
  };
}

export async function createTellerLinkSession(): Promise<TellerSessionResult> {
  try {
    const data = await request<{
      session_id?: string;
      connect_url?: string;
      completion_redirect_uri?: string;
    }>('/api/finance/teller/session', { native: Platform.OS !== 'web' });
    if (!data.session_id || !data.connect_url || !data.completion_redirect_uri) {
      return { ok: false, error: 'Teller did not return a link session.', configured: true };
    }
    return {
      ok: true,
      sessionId: data.session_id,
      connectUrl: data.connect_url,
      completionRedirectUri: data.completion_redirect_uri,
    };
  } catch (error) {
    return failure(error, 'Could not start Teller Connect');
  }
}

export async function openTellerConnect(
  session: Extract<TellerSessionResult, { ok: true }>,
): Promise<void> {
  const result = await WebBrowser.openAuthSessionAsync(
    session.connectUrl,
    session.completionRedirectUri,
  );
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new FinanceServiceError('Teller Connect was cancelled.', 'CANCELLED');
  }
  if (result.type !== 'success') {
    throw new FinanceServiceError('Teller Connect did not finish.', 'LINK_INCOMPLETE');
  }
  if (result.url?.includes('status=cancelled')) {
    throw new FinanceServiceError('Teller Connect was cancelled.', 'CANCELLED');
  }
}

export async function finishTellerLink(sessionId: string): Promise<TellerSyncResult> {
  try {
    const completed = await request<{ enrollment_id?: string }>(
      '/api/finance/teller/finish',
      { session_id: sessionId },
    );
    if (!completed.enrollment_id) {
      return { ok: false, error: 'Teller enrollment is still completing.', configured: true };
    }
    return syncTellerEnrollment(completed.enrollment_id);
  } catch (error) {
    return failure(error, 'Could not finish Teller Connect');
  }
}

export async function syncTellerEnrollment(connectionId: string): Promise<TellerSyncResult> {
  try {
    const data = await request<{
      enrollment_id: string;
      institution_name?: string;
      accounts?: TellerLinkedAccount[];
      transactions?: TellerLinkedTransaction[];
      refreshed_from?: string;
      sync_status?: 'ready' | 'error';
      sync_error?: string;
    }>('/api/finance/teller/sync', { enrollment_id: connectionId });
    return {
      ok: true,
      connectionId: data.enrollment_id,
      institutionName: data.institution_name,
      accounts: data.accounts ?? [],
      transactions: data.transactions ?? [],
      refreshedFrom: data.refreshed_from,
      syncStatus: data.sync_status === 'error' ? 'error' : 'ready',
      syncError: data.sync_error,
    };
  } catch (error) {
    return failure(error, 'Could not sync Teller');
  }
}

export async function disconnectTellerEnrollment(connectionId: string): Promise<void> {
  await request('/api/finance/teller/disconnect', { enrollment_id: connectionId });
}
