import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { ProfileAvatarMeta } from '@/features/account/profile-avatar-model';
import type { TravelPlan } from '@/features/travel/types';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { getNotificationsModule } from '@/services/notifications/runtime';
import { newUuid } from '@/utils/id';
import {
    addDays,
    formatDateLong,
    formatWeekday,
    fromDateKey,
    toDateKey,
} from '@/utils/date';

export const TRAVEL_CHAT_NOTIFICATION_CHANNEL = 'event-chat';
export const TRAVEL_CHAT_REACTION_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
] as const;
export type TravelChatReactionEmoji = (typeof TRAVEL_CHAT_REACTION_EMOJIS)[number];

const CHAT_DEVICE_ID_KEY = 'ontrack.travel-chat-device-id';
const CHAT_ALERTS_BANNER_DISMISSED_KEY =
  'ontrack.travel-chat-alerts-banner-dismissed';

export type TravelChatMessageKind = 'text' | 'voice';

export type TravelChatDeliveryStatus = 'pending' | 'sent' | 'read';

export interface TravelChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface TravelChatMessage {
  id: string;
  senderName: string;
  senderDeviceId: string;
  /** Signed-in account that sent the message; missing on older rows. */
  senderUserId?: string;
  body: string;
  createdAt: string;
  kind: TravelChatMessageKind;
  replyToId?: string;
  replyPreview?: string;
  replySenderName?: string;
  editedAt?: string;
  deletedAt?: string;
  mediaPath?: string;
  mediaDurationMs?: number;
  reactions: TravelChatReaction[];
  /** Max last_read_at among other trip members (same on every row from load). */
  peerLastReadAt?: string;
}

export type OptimisticTravelChatMessage = TravelChatMessage & { pending?: boolean };

export type TravelChatMember = {
  id: string;
  name: string;
  isSelf?: boolean;
  userId?: string;
  avatar?: ProfileAvatarMeta;
};

export function travelChatMessagePreview(
  message: Pick<TravelChatMessage, 'kind' | 'body'>,
  options?: { emptyFallback?: string; maxChars?: number },
): string {
  if (message.kind === 'voice') return 'Voice message';
  const body =
    (message.body ?? '').trim() || (options?.emptyFallback ?? 'Message');
  const max = options?.maxChars;
  return typeof max === 'number' ? body.slice(0, max) : body;
}

/** Prefer account identity so the same user looks like "me" across devices. */
export function isTravelChatMessageMine(
  message: Pick<TravelChatMessage, 'senderDeviceId' | 'senderUserId'>,
  identity: { userId?: string | null; deviceId?: string | null },
): boolean {
  const userId = identity.userId?.trim();
  if (userId && message.senderUserId) {
    return message.senderUserId === userId;
  }
  const deviceId = identity.deviceId?.trim();
  return Boolean(deviceId && message.senderDeviceId === deviceId);
}

export function travelChatDeliveryStatus(
  message: Pick<TravelChatMessage, 'createdAt' | 'peerLastReadAt'> & {
    pending?: boolean;
  },
): TravelChatDeliveryStatus {
  if (message.pending) return 'pending';
  const peer = message.peerLastReadAt
    ? Date.parse(message.peerLastReadAt)
    : NaN;
  const created = Date.parse(message.createdAt);
  if (Number.isFinite(peer) && Number.isFinite(created) && peer >= created) {
    return 'read';
  }
  return 'sent';
}

export type TravelChatListItem =
  | { type: 'date'; id: string; dateKey: string; label: string }
  | { type: 'message'; id: string; message: TravelChatMessage };

/** Day chrome for chat: Today / Yesterday / weekday + date (+ year when needed). */
export function travelChatDayLabel(dateKey: string, now = new Date()): string {
  const today = toDateKey(now);
  if (dateKey === today) return 'Today';
  if (dateKey === addDays(today, -1)) return 'Yesterday';
  const day = fromDateKey(dateKey);
  const base = `${formatWeekday(dateKey)}, ${formatDateLong(dateKey)}`;
  return day.getFullYear() === now.getFullYear()
    ? base
    : `${base}, ${day.getFullYear()}`;
}

/** Insert a date header before the first message of each local calendar day. */
export function buildTravelChatListItems(
  messages: TravelChatMessage[],
  now = new Date(),
): TravelChatListItem[] {
  const items: TravelChatListItem[] = [];
  let lastDateKey: string | undefined;
  for (const message of messages) {
    const dateKey = toDateKey(new Date(message.createdAt));
    if (dateKey !== lastDateKey) {
      items.push({
        type: 'date',
        id: `date-${dateKey}`,
        dateKey,
        label: travelChatDayLabel(dateKey, now),
      });
      lastDateKey = dateKey;
    }
    items.push({ type: 'message', id: message.id, message });
  }
  return items;
}

/** Merge remote snapshot with in-flight optimistic rows. */
export function mergeTravelChatMessages(
  remote: TravelChatMessage[],
  current: Array<TravelChatMessage & { pending?: boolean }>,
): Array<TravelChatMessage & { pending?: boolean }> {
  const remoteIds = new Set(remote.map((message) => message.id));
  const pending = current.filter(
    (message) => message.pending && !remoteIds.has(message.id),
  );
  return [...remote, ...pending];
}

/** Apply a peer read watermark onto every message. */
export function applyTravelChatPeerReadAt(
  messages: TravelChatMessage[],
  peerLastReadAt: string | undefined,
): TravelChatMessage[] {
  if (!peerLastReadAt) return messages;
  return messages.map((message) => ({ ...message, peerLastReadAt }));
}

export function toggleTravelChatReactionLocal(
  reactions: TravelChatReaction[],
  emoji: string,
): TravelChatReaction[] {
  const existing = reactions.find((item) => item.emoji === emoji);
  if (existing?.mine) {
    const nextCount = existing.count - 1;
    if (nextCount <= 0) {
      return reactions.filter((item) => item.emoji !== emoji);
    }
    return reactions.map((item) =>
      item.emoji === emoji ? { ...item, count: nextCount, mine: false } : item,
    );
  }
  const clearedMine = reactions
    .map((item) =>
      item.mine
        ? { ...item, count: item.count - 1, mine: false }
        : item,
    )
    .filter((item) => item.count > 0);
  const target = clearedMine.find((item) => item.emoji === emoji);
  if (target) {
    return clearedMine.map((item) =>
      item.emoji === emoji ? { ...item, count: item.count + 1, mine: true } : item,
    );
  }
  return [...clearedMine, { emoji, count: 1, mine: true }].sort((a, b) =>
    a.emoji.localeCompare(b.emoji),
  );
}

export class TravelChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelChatError';
  }
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new TravelChatError('Trip chat is not configured for this build.');
  }
  return client;
}

export function travelChatAccessCode(plan: TravelPlan): string | undefined {
  if (plan.chatAccessCode) return plan.chatAccessCode;
  // Prefer the most recently accepted invite. Older invitees may have left
  // (revoked server-side) while still lingering first in the local array.
  const accepted = plan.participants
    .filter((participant) => participant.acceptedAt && participant.inviteCode)
    .sort((a, b) => (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? ''));
  return accepted[0]?.inviteCode;
}

function randomDeviceId(): string {
  // Cryptographically random so the device id (also the chat rate-limit key)
  // cannot be predicted or ground down by an attacker.
  return newUuid();
}

async function readStoredChatDeviceId(): Promise<string | null> {
  if (process.env.EXPO_OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(CHAT_DEVICE_ID_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(CHAT_DEVICE_ID_KEY);
}

async function writeStoredChatDeviceId(value: string): Promise<void> {
  if (process.env.EXPO_OS === 'web') {
    try {
      globalThis.localStorage?.setItem(CHAT_DEVICE_ID_KEY, value);
    } catch {
      // Private mode / blocked storage — still return an in-memory id below.
    }
    return;
  }
  await SecureStore.setItemAsync(CHAT_DEVICE_ID_KEY, value);
}

export async function getTravelChatDeviceId(): Promise<string> {
  const existing = await readStoredChatDeviceId();
  if (existing) return existing;
  const created = randomDeviceId();
  await writeStoredChatDeviceId(created);
  return created;
}

function mapReactions(value: unknown): TravelChatReaction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.emoji !== 'string' || typeof row.count !== 'number') {
      return [];
    }
    return [
      {
        emoji: row.emoji,
        count: row.count,
        mine: row.mine === true,
      },
    ];
  });
}

function mapMessage(value: unknown): TravelChatMessage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.sender_name !== 'string' ||
    typeof row.sender_device_id !== 'string' ||
    typeof row.body !== 'string' ||
    typeof row.created_at !== 'string'
  ) {
    return undefined;
  }
  const senderUserId =
    typeof row.sender_user_id === 'string' && row.sender_user_id
      ? row.sender_user_id
      : undefined;
  const kind =
    row.kind === 'voice' || row.kind === 'text' ? row.kind : 'text';
  return {
    id: row.id,
    senderName: row.sender_name,
    senderDeviceId: row.sender_device_id,
    senderUserId,
    body: row.body,
    createdAt: row.created_at,
    kind,
    replyToId:
      typeof row.reply_to_id === 'string' && row.reply_to_id
        ? row.reply_to_id
        : undefined,
    replyPreview:
      typeof row.reply_preview === 'string' && row.reply_preview
        ? row.reply_preview
        : undefined,
    replySenderName:
      typeof row.reply_sender_name === 'string' && row.reply_sender_name
        ? row.reply_sender_name
        : undefined,
    editedAt:
      typeof row.edited_at === 'string' && row.edited_at
        ? row.edited_at
        : undefined,
    deletedAt:
      typeof row.deleted_at === 'string' && row.deleted_at
        ? row.deleted_at
        : undefined,
    mediaPath:
      typeof row.media_path === 'string' && row.media_path
        ? row.media_path
        : undefined,
    mediaDurationMs:
      typeof row.media_duration_ms === 'number'
        ? row.media_duration_ms
        : undefined,
    reactions: mapReactions(row.reactions),
    peerLastReadAt:
      typeof row.peer_last_read_at === 'string' && row.peer_last_read_at
        ? row.peer_last_read_at
        : undefined,
  };
}

export async function loadTravelChatMessages(
  accessCode: string,
): Promise<TravelChatMessage[]> {
  const { data, error } = await requireClient().rpc('travel_chat_messages', {
    chat_access_code: accessCode,
  });
  if (error) throw new TravelChatError('Messages could not be loaded.');
  return Array.isArray(data)
    ? data.flatMap((value) => {
        const message = mapMessage(value);
        return message ? [message] : [];
      })
    : [];
}

export async function sendTravelChatMessage(input: {
  accessCode: string;
  senderName: string;
  senderDeviceId: string;
  body?: string;
  replyToId?: string;
  kind?: TravelChatMessageKind;
  mediaPath?: string;
  mediaDurationMs?: number;
}): Promise<TravelChatMessage> {
  const kind = input.kind ?? 'text';
  const body = (input.body ?? '').trim();
  if (kind === 'text') {
    if (!body) throw new TravelChatError('Write a message first.');
    if (body.length > 2000) {
      throw new TravelChatError('Messages can be up to 2,000 characters.');
    }
  } else {
    if (!input.mediaPath || !input.mediaDurationMs) {
      throw new TravelChatError('Voice message could not be sent.');
    }
  }
  const { data, error } = await requireClient().rpc('send_travel_chat_message', {
    chat_access_code: input.accessCode,
    chat_sender_device_id: input.senderDeviceId,
    chat_sender_name: input.senderName.trim() || 'Trip member',
    chat_body: body,
    chat_reply_to_id: input.replyToId ?? null,
    chat_kind: kind,
    chat_media_path: input.mediaPath ?? null,
    chat_media_duration_ms: input.mediaDurationMs ?? null,
  });
  const message = mapMessage(data);
  if (error || !message) {
    throw new TravelChatError(error?.message ?? 'Your message could not be sent.');
  }
  return message;
}

export async function editTravelChatMessage(input: {
  accessCode: string;
  messageId: string;
  body: string;
}): Promise<TravelChatMessage> {
  const body = input.body.trim();
  if (!body) throw new TravelChatError('Write a message first.');
  const { data, error } = await requireClient().rpc('edit_travel_chat_message', {
    chat_access_code: input.accessCode,
    chat_message_id: input.messageId,
    chat_body: body,
  });
  const message = mapMessage(data);
  if (error || !message) {
    throw new TravelChatError(error?.message ?? 'This message could not be edited.');
  }
  return message;
}

export async function deleteTravelChatMessage(input: {
  accessCode: string;
  messageId: string;
}): Promise<TravelChatMessage> {
  const { data, error } = await requireClient().rpc('delete_travel_chat_message', {
    chat_access_code: input.accessCode,
    chat_message_id: input.messageId,
  });
  const message = mapMessage(data);
  if (error || !message) {
    throw new TravelChatError(
      error?.message ?? 'This message could not be deleted.',
    );
  }
  return message;
}

export async function setTravelChatReaction(input: {
  accessCode: string;
  messageId: string;
  emoji: TravelChatReactionEmoji | string;
}): Promise<void> {
  const { error } = await requireClient().rpc('set_travel_chat_reaction', {
    chat_access_code: input.accessCode,
    chat_message_id: input.messageId,
    chat_emoji: input.emoji,
  });
  if (error) {
    throw new TravelChatError(error.message ?? 'This reaction could not be saved.');
  }
}

export async function markTravelChatRead(
  accessCode: string,
  readAt?: string,
): Promise<void> {
  const { error } = await requireClient().rpc('mark_travel_chat_read', {
    chat_access_code: accessCode,
    chat_read_at: readAt ?? new Date().toISOString(),
  });
  if (error) {
    throw new TravelChatError(error.message ?? 'Read state could not be updated.');
  }
}

export type TravelChatRealtimePayload = {
  type?: string;
  op?: string;
  id?: string;
  message_id?: string;
  trip_id?: string;
  user_id?: string;
  last_read_at?: string;
};

/** Private Realtime topic for a trip chat. */
export function subscribeToTravelChat(
  tripId: string,
  handlers: {
    onChanged: (payload: TravelChatRealtimePayload) => void;
    onTyping?: (payload: { userId?: string; name?: string }) => void;
  },
): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client || !tripId) return undefined;
  return client
    .channel(`travel-chat:trip:${tripId}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, ({ payload }) => {
      handlers.onChanged((payload ?? {}) as TravelChatRealtimePayload);
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      const row = (payload ?? {}) as { userId?: string; name?: string };
      handlers.onTyping?.(row);
    })
    .subscribe();
}

/** Broadcast typing on an already-subscribed trip chat channel. */
export function sendTravelChatTyping(
  channel: RealtimeChannel | undefined,
  input: { userId: string; name: string },
): void {
  if (!channel || !input.userId) return;
  void channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: input.userId, name: input.name },
  });
}

export async function chatNotificationsAreEnabled(): Promise<boolean> {
  const notifications = await getNotificationsModule();
  if (!notifications) return false;
  return (await notifications.getPermissionsAsync()).granted;
}

/** Device-local: hide the “Get New-Message Alerts” banner after dismiss. */
export async function isTravelChatAlertsBannerDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAT_ALERTS_BANNER_DISMISSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissTravelChatAlertsBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_ALERTS_BANNER_DISMISSED_KEY, '1');
  } catch {
    // Best-effort — UI still hides for this session.
  }
}

export async function enableTravelChatNotifications(
  accessCode: string,
  deviceId: string,
): Promise<void> {
  if (process.env.EXPO_OS === 'web') {
    throw new TravelChatError('Push notifications are available in the mobile app.');
  }
  const notifications = await getNotificationsModule();
  if (!notifications) {
    throw new TravelChatError(
      'Push alerts require a development or production app build. Chat messages still work normally.',
    );
  }
  if (process.env.EXPO_OS === 'android') {
    await notifications.setNotificationChannelAsync(TRAVEL_CHAT_NOTIFICATION_CHANNEL, {
      name: 'Trip Chat',
      description: 'New messages from members of your trips',
      importance: notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
    });
  }
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    throw new TravelChatError('Notifications are off. Enable them in system settings to continue.');
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string') {
    throw new TravelChatError('The Expo project ID is missing from this build.');
  }
  let token: string;
  try {
    token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    throw new TravelChatError(
      'Push alerts are unavailable in this app build. Chat messages still work normally.',
    );
  }
  const { error } = await requireClient().rpc('register_travel_chat_device', {
    chat_access_code: accessCode,
    chat_device_id: deviceId,
    chat_expo_push_token: token,
  });
  if (error) throw new TravelChatError('This device could not be registered for chat alerts.');
}
