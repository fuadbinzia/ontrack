import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuthSession } from '@/features/auth/auth-provider';
import {
  loadEzPassSharedLedgers,
  subscribeToEzPassChanges,
  syncOwnedEzPassTransactions,
  type EzPassSharedLedger,
} from '@/services/finance/ezpass-collaboration';
import type { FinanceTransaction } from '@/features/finance/types';

export function useEzPassCollaboration(transactions: FinanceTransaction[]) {
  const { user } = useAuthSession();
  const [ledgers, setLedgers] = useState<EzPassSharedLedger[]>([]);
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const refreshing = useRef(false);
  const localEzPass = useMemo(
    () => transactions.filter((transaction) => transaction.source === 'ezpass'),
    [transactions],
  );
  const localRevision = useMemo(
    () => localEzPass
      .map((transaction) => `${transaction.id}:${transaction.updatedAt}`)
      .sort()
      .join('|'),
    [localEzPass],
  );
  const ownsLedger = ledgers.some((ledger) => ledger.role === 'owner');

  const refresh = useCallback(async (options?: { syncOwned?: boolean }) => {
    if (!user || refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError(undefined);
    try {
      if (options?.syncOwned && localEzPass.length) {
        await syncOwnedEzPassTransactions(localEzPass);
      }
      const snapshot = await loadEzPassSharedLedgers();
      setUserId(snapshot.userId);
      setLedgers(snapshot.ledgers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Shared E-ZPass activity could not be loaded.');
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, [localEzPass, user]);

  useEffect(() => {
    if (!user) {
      setLedgers([]);
      setUserId(undefined);
      setError(undefined);
      return;
    }
    // Loading a signed-in screen is read-only until the user explicitly adds
    // the first shared driver and creates an owned ledger.
    void refresh();
  }, [refresh, user]);

  useEffect(() => {
    if (!user || !ownsLedger) return;
    void refresh({ syncOwned: true });
  }, [localRevision, ownsLedger, refresh, user]);

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToEzPassChanges(() => void refresh());
    return () => {
      void channel?.unsubscribe();
    };
  }, [refresh, user]);

  return { authenticated: Boolean(user), userId, ledgers, loading, error, refresh };
}
