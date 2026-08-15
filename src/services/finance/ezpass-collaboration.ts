import type { RealtimeChannel } from '@supabase/supabase-js';

import { deduplicateEzPassTransactions } from '@/features/finance/ezpass-deduplication';
import type { FinanceTransaction, FinanceTransactionActivity } from '@/features/finance/types';
import { getSupabaseClient } from '@/services/cloud/supabase';

export class EzPassCollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EzPassCollaborationError';
  }
}

export type EzPassMemberRole = 'owner' | 'cohost' | 'member';

export interface EzPassSharedMember {
  userId: string;
  displayName: string;
  role: EzPassMemberRole;
}

export interface EzPassSharedTransaction {
  id: string;
  date: string;
  activityTime?: string;
  merchant: string;
  amount: number;
  currency: string;
  activity: FinanceTransactionActivity;
  assignedUserId?: string;
  assignedUserName?: string;
  updatedAt: string;
}

export interface EzPassSharedLedger {
  id: string;
  ownerUserId: string;
  role: EzPassMemberRole;
  members: EzPassSharedMember[];
  transactions: EzPassSharedTransaction[];
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new EzPassCollaborationError('Shared E-ZPass access is not configured for this build.');
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new EzPassCollaborationError('Sign in to share an E-ZPass ledger.');
  }
  return { client, userId: data.session.user.id };
}

function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseActivity(value: unknown): FinanceTransactionActivity {
  return value === 'refund' || value === 'transfer' || value === 'adjustment'
    ? value
    : 'expense';
}

export function parseEzPassSharedLedgers(value: unknown): EzPassSharedLedger[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = objectValue(candidate);
    if (!row) return [];
    const id = textValue(row?.id);
    const ownerUserId = textValue(row?.ownerUserId);
    const role = row?.role === 'owner' || row?.role === 'cohost' || row?.role === 'member'
      ? row.role
      : undefined;
    if (!id || !ownerUserId || !role) return [];
    const members = Array.isArray(row.members)
      ? row.members.flatMap((memberValue) => {
          const member = objectValue(memberValue);
          const userId = textValue(member?.userId);
          const displayName = textValue(member?.displayName);
          const memberRole =
            member?.role === 'owner' ||
            member?.role === 'cohost' ||
            member?.role === 'member'
              ? member.role
              : undefined;
          return userId && displayName && memberRole
            ? [{ userId, displayName, role: memberRole } satisfies EzPassSharedMember]
            : [];
        })
      : [];
    const transactions = Array.isArray(row.transactions)
        ? row.transactions.flatMap((transactionValue) => {
          const transaction = objectValue(transactionValue);
          if (!transaction) return [];
          const transactionId = textValue(transaction?.id);
          const date = textValue(transaction?.date);
          const merchant = textValue(transaction?.merchant);
          const currency = textValue(transaction?.currency);
          const updatedAt = textValue(transaction?.updatedAt);
          const amount = typeof transaction?.amount === 'number'
            ? transaction.amount
            : Number(transaction?.amount);
          if (!transactionId || !date || !merchant || !currency || !updatedAt || !Number.isFinite(amount)) {
            return [];
          }
          return [{
            id: transactionId,
            date,
            activityTime: textValue(transaction.activityTime),
            merchant,
            amount,
            currency,
            activity: parseActivity(transaction.activity),
            assignedUserId: textValue(transaction.assignedUserId),
            assignedUserName: textValue(transaction.assignedUserName),
            updatedAt,
          } satisfies EzPassSharedTransaction];
        })
      : [];
    return [{ id, ownerUserId, role, members, transactions } satisfies EzPassSharedLedger];
  });
}

export async function loadEzPassSharedLedgers(): Promise<{
  userId: string;
  ledgers: EzPassSharedLedger[];
}> {
  const { client, userId } = await authenticatedClient();
  const { data, error } = await client.rpc('ezpass_ledger_snapshots');
  if (error) {
    throw new EzPassCollaborationError(messageFrom(error, 'Shared E-ZPass activity could not be loaded.'));
  }
  return { userId, ledgers: parseEzPassSharedLedgers(data) };
}

export async function syncOwnedEzPassTransactions(
  transactions: FinanceTransaction[],
): Promise<string> {
  const { client } = await authenticatedClient();
  const payload = deduplicateEzPassTransactions(transactions)
    .filter((transaction) => transaction.source === 'ezpass')
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      activityTime: transaction.activityTime ?? null,
      merchant: transaction.merchant,
      amount: transaction.amount,
      currency: transaction.currency,
      activity: transaction.activity ?? 'expense',
      assignedUserId: transaction.ezPassFriendId ?? null,
    }));
  const { data, error } = await client.rpc('sync_ezpass_transactions', {
    transactions_payload: payload,
  });
  if (error || typeof data !== 'string') {
    throw new EzPassCollaborationError(messageFrom(error, 'E-ZPass activity could not be shared.'));
  }
  return data;
}

export async function addEzPassFriendMembers(input: {
  ledgerId?: string;
  userIds: string[];
}): Promise<void> {
  const { client } = await authenticatedClient();
  const { error } = input.ledgerId
    ? await client.rpc('add_ezpass_ledger_members', {
        requested_ledger_id: input.ledgerId,
        requested_user_ids: input.userIds,
      })
    : await client.rpc('add_ezpass_friend_members', {
        requested_user_ids: input.userIds,
      });
  if (error) {
    throw new EzPassCollaborationError(messageFrom(error, 'Friends could not be added to E-ZPass.'));
  }
}

export async function setEzPassMemberRole(input: {
  ledgerId: string;
  userId: string;
  role: 'cohost' | 'member';
}): Promise<void> {
  const { client } = await authenticatedClient();
  const { error } = await client.rpc('set_ezpass_member_role', {
    requested_ledger_id: input.ledgerId,
    requested_user_id: input.userId,
    requested_role: input.role,
  });
  if (error) {
    throw new EzPassCollaborationError(messageFrom(error, 'That access level could not be changed.'));
  }
}

export async function removeEzPassMember(input: {
  ledgerId: string;
  userId: string;
}): Promise<void> {
  const { client } = await authenticatedClient();
  const { error } = await client.rpc('remove_ezpass_ledger_member', {
    requested_ledger_id: input.ledgerId,
    requested_user_id: input.userId,
  });
  if (error) {
    throw new EzPassCollaborationError(messageFrom(error, 'That member could not be removed.'));
  }
}

export async function tagEzPassSharedTransaction(input: {
  ledgerId: string;
  transactionId: string;
  userId?: string;
}): Promise<void> {
  const { client } = await authenticatedClient();
  const { error } = await client.rpc('tag_ezpass_transaction', {
    requested_ledger_id: input.ledgerId,
    requested_transaction_id: input.transactionId,
    requested_user_id: input.userId ?? null,
  });
  if (error) {
    throw new EzPassCollaborationError(messageFrom(error, 'That E-ZPass activity could not be tagged.'));
  }
}

export function subscribeToEzPassChanges(onChange: () => void): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  return client
    .channel('finance:ezpass')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ezpass_ledgers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ezpass_ledger_members' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ezpass_shared_transactions' }, onChange)
    .subscribe();
}
