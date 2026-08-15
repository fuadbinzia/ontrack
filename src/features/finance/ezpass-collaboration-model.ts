import type {
  EzPassMemberRole,
  EzPassSharedLedger,
} from '@/services/finance/ezpass-collaboration';

import { deduplicateEzPassTransactions } from './ezpass-deduplication';
import { ezPassFirstName } from './ezpass-model';
import type { FinanceTransaction } from './types';

export type EzPassLedgerActivity = FinanceTransaction & {
  ezPassLedgerId?: string;
  ezPassSharedTransactionId?: string;
  ezPassLedgerRole?: EzPassMemberRole;
};

export type EzPassTagPressIntent =
  | { action: 'open-picker' }
  | { action: 'blocked' }
  | { action: 'ignore' }
  | { action: 'update'; userId?: string };

export function ezPassTagPressIntent(input: {
  ledgerRole: EzPassMemberRole | undefined;
  currentUserId: string | undefined;
  assignedUserId: string | undefined;
}): EzPassTagPressIntent {
  if (input.ledgerRole !== 'member') return { action: 'open-picker' };
  if (!input.currentUserId) return { action: 'ignore' };
  if (input.assignedUserId && input.assignedUserId !== input.currentUserId) {
    return { action: 'blocked' };
  }
  return {
    action: 'update',
    userId: input.assignedUserId === input.currentUserId
      ? undefined
      : input.currentUserId,
  };
}

export function ezPassAssignableFriendIds(
  ledger: Pick<EzPassSharedLedger, 'members'> | undefined,
  currentUserId?: string,
): string[] {
  return ledger?.members
    .filter(
      (member) => member.role !== 'owner' && member.userId !== currentUserId,
    )
    .map((member) => member.userId) ?? [];
}

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
