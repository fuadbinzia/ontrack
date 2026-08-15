import {
  syncPlaidItem,
  syncTellerEnrollment,
} from '@/services/finance';
import { useFinance } from '@/store/finance';

import { applyPlaidSyncResult } from './apply-plaid-link';
import { applyTellerSyncResult } from './apply-teller-link';
import type { FinanceAccount, FinanceConnectionProvider } from './types';

export type FinanceSubscriptionConnection = {
  provider: FinanceConnectionProvider;
  connectionId: string;
};

export type FinanceSubscriptionRefreshResult = {
  connectionCount: number;
  syncedCount: number;
  transactionCount: number;
  candidateCount: number;
  errors: string[];
};

export function financeSubscriptionConnections(
  accounts: FinanceAccount[],
): FinanceSubscriptionConnection[] {
  const connections = new Map<string, FinanceSubscriptionConnection>();
  for (const account of accounts) {
    const provider = account.provider ?? (account.plaidItemId ? 'plaid' : undefined);
    const connectionId = account.connectionId ?? account.plaidItemId;
    if (!provider || !connectionId) continue;
    connections.set(`${provider}:${connectionId}`, { provider, connectionId });
  }
  return [...connections.values()];
}

export async function refreshFinanceSubscriptions(
  entityId: string,
  baseCurrency: string,
): Promise<FinanceSubscriptionRefreshResult> {
  const connections = financeSubscriptionConnections(useFinance.getState().accounts);
  const results = await Promise.all(connections.map(async ({ provider, connectionId }) => {
    try {
      if (provider === 'teller') {
        const result = await syncTellerEnrollment(connectionId);
        if (!result.ok) return result.error;
        applyTellerSyncResult(result, entityId, baseCurrency);
        return result.syncStatus === 'error'
          ? result.syncError ?? 'Teller could not refresh this connection.'
          : undefined;
      }
      const result = await syncPlaidItem(connectionId);
      if (!result.ok) return result.error;
      applyPlaidSyncResult(connectionId, result, entityId, baseCurrency);
      return result.syncStatus === 'error'
        ? result.syncError ?? 'Plaid could not refresh this connection.'
        : undefined;
    } catch (error) {
      return error instanceof Error ? error.message : 'A financial connection could not refresh.';
    }
  }));
  const errors = results.filter((error): error is string => Boolean(error));
  if (connections.length > 0 && errors.length === connections.length) {
    useFinance.getState().setSubscriptionDetectionStatus('error');
  }
  const refreshedState = useFinance.getState();
  const linkedAccountIds = new Set(
    refreshedState.accounts
      .filter((account) => account.provider)
      .map((account) => account.id),
  );
  return {
    connectionCount: connections.length,
    syncedCount: connections.length - errors.length,
    transactionCount: refreshedState.transactions.filter(
      (transaction) => transaction.accountId && linkedAccountIds.has(transaction.accountId),
    ).length,
    candidateCount: refreshedState.subscriptionCandidates.length,
    errors,
  };
}
