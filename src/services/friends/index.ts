import { Share } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  avatarMetaFromProfileRow,
  normalizeAvatarMeta,
  type ProfileAvatarMeta,
} from '@/features/account/profile-avatar-model';
import { getSupabaseClient } from '@/services/cloud/supabase';

export class FriendsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendsError';
  }
}

export interface FriendProfile {
  userId: string;
  displayName: string;
  friendsSince?: string;
  avatar: ProfileAvatarMeta;
}

export interface FriendRequestItem {
  id: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  createdAt: string;
  otherUserId?: string;
  otherDisplayName: string;
}

export interface FriendInvitePreview {
  code: string;
  fromUserId: string;
  displayName: string;
  slug?: string;
  sharePath?: string;
}

export interface MyFriendInvite {
  code: string;
  slug?: string;
  sharePath: string;
  displayName: string;
}

export const ONTRACK_FRIEND_SHARE_URL =
  process.env.EXPO_PUBLIC_FRIEND_SHARE_BASE_URL ??
  process.env.EXPO_PUBLIC_TODO_SHARE_BASE_URL ??
  'https://ontrack--links.expo.app';

function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new FriendsError('Friends are not configured for this build.');
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new FriendsError('Sign in to manage friends.');
  }
  return client;
}

function asFriend(row: Record<string, unknown>): FriendProfile | undefined {
  const userId = typeof row.user_id === 'string' ? row.user_id : undefined;
  const displayName =
    typeof row.display_name === 'string' ? row.display_name.trim() : '';
  if (!userId || !displayName) return undefined;
  return {
    userId,
    displayName,
    friendsSince:
      typeof row.friends_since === 'string' ? row.friends_since : undefined,
    avatar: avatarMetaFromProfileRow(row),
  };
}

function asRequest(row: Record<string, unknown>): FriendRequestItem | undefined {
  const id = typeof row.id === 'string' ? row.id : undefined;
  const direction = row.direction === 'incoming' || row.direction === 'outgoing'
    ? row.direction
    : undefined;
  const otherDisplayName =
    typeof row.other_display_name === 'string'
      ? row.other_display_name.trim()
      : 'Friend';
  if (!id || !direction) return undefined;
  return {
    id,
    direction,
    status: typeof row.status === 'string' ? row.status : 'pending',
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    otherUserId: typeof row.other_user_id === 'string' ? row.other_user_id : undefined,
    otherDisplayName: otherDisplayName || 'Friend',
  };
}

export async function ensureFriendProfile(input?: {
  displayName?: string;
  email?: string;
}): Promise<FriendProfile> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('ensure_profile', {
    requested_display_name: input?.displayName ?? null,
    requested_email: input?.email ?? null,
  });
  if (error || !data || typeof data !== 'object') {
    throw new FriendsError(messageFrom(error, 'Your profile could not be saved.'));
  }
  const row = data as Record<string, unknown>;
  const profile = asFriend({
    user_id: row.user_id,
    display_name: row.display_name,
    avatar_kind: row.avatar_kind,
    avatar_color: row.avatar_color,
    avatar_icon_id: row.avatar_icon_id,
    avatar_photo_path: row.avatar_photo_path,
  });
  if (!profile) {
    throw new FriendsError('Your profile could not be saved.');
  }
  return profile;
}

export async function setProfileAvatar(
  avatar: ProfileAvatarMeta,
): Promise<ProfileAvatarMeta> {
  const client = await authenticatedClient();
  const normalized = normalizeAvatarMeta(avatar);
  const { data, error } = await client.rpc('set_profile_avatar', {
    requested_kind: normalized.kind,
    requested_color: normalized.color ?? null,
    requested_icon_id: normalized.kind === 'icon' ? normalized.iconId ?? null : null,
    requested_photo_path:
      normalized.kind === 'photo' ? normalized.photoPath ?? null : null,
  });
  if (error || !data || typeof data !== 'object') {
    throw new FriendsError(messageFrom(error, 'Your avatar could not be saved.'));
  }
  return avatarMetaFromProfileRow(data as Record<string, unknown>);
}

export async function listFriends(): Promise<FriendProfile[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_friends');
  if (error) {
    throw new FriendsError(messageFrom(error, 'Friends could not be loaded.'));
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      row && typeof row === 'object'
        ? asFriend(row as Record<string, unknown>)
        : undefined,
    )
    .filter((item): item is FriendProfile => Boolean(item));
}

export async function listFriendRequests(): Promise<FriendRequestItem[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_friend_requests');
  if (error) {
    throw new FriendsError(messageFrom(error, 'Friend requests could not be loaded.'));
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      row && typeof row === 'object'
        ? asRequest(row as Record<string, unknown>)
        : undefined,
    )
    .filter((item): item is FriendRequestItem => Boolean(item));
}

export async function sendFriendRequest(email: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('send_friend_request', {
    requested_email: email.trim().toLowerCase(),
  });
  if (error || typeof data !== 'string') {
    throw new FriendsError(messageFrom(error, 'The friend request could not be sent.'));
  }
  return data;
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('respond_friend_request', {
    request_id: requestId,
    accept,
  });
  if (error) {
    throw new FriendsError(
      messageFrom(error, 'The friend request could not be updated.'),
    );
  }
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('cancel_friend_request', {
    request_id: requestId,
  });
  if (error) {
    throw new FriendsError(
      messageFrom(error, 'The friend request could not be cancelled.'),
    );
  }
}

export async function removeFriend(friendUserId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('remove_friend', {
    friend_user_id: friendUserId,
  });
  if (error) {
    throw new FriendsError(messageFrom(error, 'The friend could not be removed.'));
  }
}

/** Subscribes to private cache-invalidation events for one user's friend list. */
export function subscribeToFriendChanges(
  userId: string,
  onChange: () => void,
): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client || !userId) return undefined;
  return client
    .channel(`friend:user:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, onChange)
    .subscribe();
}

export function createFriendInviteUrl(pathToken: string, configuredBase?: string): string {
  const path = `/f/${encodeURIComponent(pathToken)}`;
  const normalizedBase = (configuredBase || ONTRACK_FRIEND_SHARE_URL).replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

export function createInstalledFriendInviteUrl(pathToken: string): string {
  return `ontrack:///f/${encodeURIComponent(pathToken)}`;
}

export function isFriendInviteCode(value: string): boolean {
  return /^[a-f0-9]{20}$/.test(value);
}

export function isFriendInviteSlug(value: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$/.test(value) &&
    value.length >= 3 &&
    value.length <= 32 &&
    !isFriendInviteCode(value)
  );
}

export function isFriendInviteToken(value: string): boolean {
  return isFriendInviteCode(value) || isFriendInviteSlug(value);
}

export function normalizeFriendInviteSlug(value: string): string {
  return value.trim().toLowerCase();
}

export async function createFriendInviteLink(): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_friend_invite_link');
  if (error || typeof data !== 'string' || !isFriendInviteCode(data)) {
    throw new FriendsError(
      messageFrom(error, 'The friend invite link could not be created.'),
    );
  }
  return data;
}

export async function getMyFriendInvite(): Promise<MyFriendInvite> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('get_my_friend_invite');
  if (error || !data || typeof data !== 'object') {
    throw new FriendsError(
      messageFrom(error, 'Your invite link could not be loaded.'),
    );
  }
  const row = data as Record<string, unknown>;
  const code = typeof row.code === 'string' ? row.code : '';
  const slug =
    typeof row.slug === 'string' && row.slug.trim()
      ? row.slug.trim().toLowerCase()
      : undefined;
  const sharePath =
    typeof row.sharePath === 'string' && row.sharePath.trim()
      ? row.sharePath.trim().toLowerCase()
      : slug || code;
  if (!code || !sharePath) {
    throw new FriendsError('Your invite link could not be loaded.');
  }
  return {
    code,
    slug,
    sharePath,
    displayName:
      typeof row.displayName === 'string' ? row.displayName.trim() : 'onTrack member',
  };
}

export async function setFriendInviteSlug(slug: string | null): Promise<string | null> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('set_friend_invite_slug', {
    requested_slug: slug?.trim() ? normalizeFriendInviteSlug(slug) : null,
  });
  if (error) {
    throw new FriendsError(
      messageFrom(error, 'Your custom invite link could not be saved.'),
    );
  }
  if (data == null) return null;
  if (typeof data !== 'string') {
    throw new FriendsError('Your custom invite link could not be saved.');
  }
  return data;
}

export async function resolveFriendInviteLink(
  code: string,
): Promise<FriendInvitePreview> {
  const client = await authenticatedClient();
  const token = code.trim().toLowerCase();
  if (!isFriendInviteToken(token)) {
    throw new FriendsError('This friend invite is unavailable.');
  }
  const { data, error } = await client.rpc('resolve_friend_invite_link', {
    invite_code: token,
  });
  if (error || !data || typeof data !== 'object') {
    throw new FriendsError(messageFrom(error, 'This friend invite is unavailable.'));
  }
  const row = data as Record<string, unknown>;
  const inviteCode = typeof row.code === 'string' ? row.code : token;
  const fromUserId = typeof row.fromUserId === 'string' ? row.fromUserId : '';
  const displayName =
    typeof row.displayName === 'string' ? row.displayName.trim() : 'onTrack member';
  const slug =
    typeof row.slug === 'string' && row.slug.trim()
      ? row.slug.trim().toLowerCase()
      : undefined;
  const sharePath =
    typeof row.sharePath === 'string' && row.sharePath.trim()
      ? row.sharePath.trim().toLowerCase()
      : slug || inviteCode;
  if (!fromUserId) {
    throw new FriendsError('This friend invite is unavailable.');
  }
  return {
    code: inviteCode,
    fromUserId,
    displayName,
    slug,
    sharePath,
  };
}

export async function acceptFriendInviteLink(code: string): Promise<string> {
  const client = await authenticatedClient();
  const token = code.trim().toLowerCase();
  if (!isFriendInviteToken(token)) {
    throw new FriendsError('This friend invite could not be accepted.');
  }
  const { data, error } = await client.rpc('accept_friend_invite_link', {
    invite_code: token,
  });
  if (error || typeof data !== 'string') {
    throw new FriendsError(
      messageFrom(error, 'This friend invite could not be accepted.'),
    );
  }
  return data;
}

export async function shareFriendInvite(pathToken: string): Promise<void> {
  const url = createFriendInviteUrl(
    pathToken,
    process.env.EXPO_PUBLIC_FRIEND_SHARE_BASE_URL ??
      process.env.EXPO_PUBLIC_TODO_SHARE_BASE_URL,
  );
  await Share.share({
    message: `Add me on onTrack\n${url}`,
    url,
  });
}
