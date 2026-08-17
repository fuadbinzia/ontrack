import { getSupabaseClient } from '@/services/cloud/supabase';

export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationError';
  }
}

export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or threats' },
  { key: 'hate', label: 'Hate or slurs' },
  { key: 'spam', label: 'Spam or scams' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'illegal', label: 'Illegal activity' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'private_info', label: 'Private information' },
  { key: 'unsafe', label: 'Unsafe advice' },
  { key: 'copyright', label: 'Copyright' },
  { key: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];
export type ReportContentKind =
  | 'travel_chat_message'
  | 'food_post'
  | 'user'
  | 'shared_list'
  | 'shared_trip';

export interface BlockedUser {
  userId: string;
  displayName: string;
  blockedAt: string;
}

function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new ModerationError('Safety tools are not configured for this build.');
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new ModerationError('Sign in to use safety tools.');
  }
  return client;
}

export async function blockUser(targetUserId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('block_user', {
    target_user_id: targetUserId,
  });
  if (error) {
    throw new ModerationError(messageFrom(error, 'That person could not be blocked.'));
  }
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('unblock_user', {
    target_user_id: targetUserId,
  });
  if (error) {
    throw new ModerationError(messageFrom(error, 'That person could not be unblocked.'));
  }
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_blocked_users');
  if (error) {
    throw new ModerationError(messageFrom(error, 'Blocked users could not be loaded.'));
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const userId = typeof record.user_id === 'string' ? record.user_id : '';
    const displayName =
      typeof record.display_name === 'string' && record.display_name.trim()
        ? record.display_name.trim()
        : 'Blocked User';
    const blockedAt =
      typeof record.blocked_at === 'string' ? record.blocked_at : '';
    return userId ? [{ userId, displayName, blockedAt }] : [];
  });
}

export async function reportContent(input: {
  kind: ReportContentKind;
  reason: ReportReason;
  targetUserId?: string | null;
  contentId?: string | null;
  note?: string | null;
}): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('report_content', {
    requested_kind: input.kind,
    requested_reason: input.reason,
    requested_target_user_id: input.targetUserId ?? null,
    requested_content_id: input.contentId ?? null,
    requested_note: input.note ?? null,
  });
  if (error || typeof data !== 'string') {
    throw new ModerationError(messageFrom(error, 'This report could not be sent.'));
  }
  return data;
}

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason.key === value);
}
