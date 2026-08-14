import type { EzPassSharedLedger } from '@/services/finance/ezpass-collaboration';

import { deduplicateEzPassTransactions } from './ezpass-deduplication';
import { ezPassFirstName } from './ezpass-model';
import type { FinanceTransaction } from './types';

export type EzPassLedgerActivity = FinanceTransaction & {
  ezPassLedgerId?: string;
  ezPassSharedTransactionId?: string;
  ezPassLedgerRole?: 'owner' | 'member';
};

export function ezPassLedgerLabel(
  ledger: EzPassSharedLedger,
  currentUserId: string | undefined,
): string {
  if (ledger.ownerUserId === currentUserId) return 'My E-ZPass';
  const owner = ledger.members.find((member) => member.role === 'owner');
  const ownerFirstName = ezPassFirstName(owner?.displayName);
  return ownerFirstName ? `${ownerFirstName}'s E-ZPass` : 'Shared E-ZPass';
}

export function sharedEzPassActivities(ledger: EzPassSharedLedger): EzPassLedgerActivity[] {
  return deduplicateEzPassTransactions(ledger.transactions.map((transaction) => ({
    id: `${ledger.id}:${transaction.id}`,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    merchant: transaction.merchant,
    categoryId: transaction.activity === 'transfer' ? 'ezpass_replenishment' : 'transport',
    entityId: '',
    source: 'ezpass',
    activity: transaction.activity,
    activityTime: transaction.activityTime,
    ezPassFriendId: transaction.assignedUserId,
    ezPassFriendName: transaction.assignedUserName,
    createdAt: transaction.updatedAt,
    updatedAt: transaction.updatedAt,
    ezPassLedgerId: ledger.id,
    ezPassSharedTransactionId: transaction.id,
    ezPassLedgerRole: ledger.role,
  })));
}
