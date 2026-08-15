import { useFinance } from '@/store/finance';

import { detectLocalSubscriptionCandidates } from './subscriptions';

export function refreshLocalSubscriptionCandidates(): void {
  const state = useFinance.getState();
  const authoritative = [
    ...state.subscriptionCandidates.filter((candidate) => candidate.source === 'plaid'),
    ...state.bills
      .filter((bill) =>
        bill.subscriptionLink && bill.subscriptionLink.source !== 'local',
      )
      .map((bill) => ({ name: bill.name, accountId: bill.accountId, currency: bill.currency })),
  ];
  const candidates = detectLocalSubscriptionCandidates(
    state.transactions,
    state.accounts,
    authoritative,
  );
  state.reconcileSubscriptionCandidates('local', undefined, candidates);
}
