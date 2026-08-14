import { Share } from 'react-native';

import {
  createTravelInviteUrl,
  decodeTravelInvite,
  encodeTravelInvite,
  isShortTravelInvite,
} from '@/features/travel/travel-invite-codec';
import { TravelInviteError } from '@/features/travel/travel-invite-error';
import type { TravelPlan } from '@/features/travel/types';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { markInviteSnapshotItinerary } from '@/features/travel/itinerary-visibility';
import { publishTravelTripItinerary } from '@/services/travel/itinerary-collaboration';
import { formatDateLong } from '@/utils/date';

export { TravelInviteError };

const SHORT_INVITE_PREFIX = 's.';

export async function requireAuthenticatedInviteClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new TravelInviteError(
      'Short travel links are not configured for this build. Add the Supabase public URL and publishable key, then try again.',
    );
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new TravelInviteError(
      'Sign in to onTrack with the email address that was invited, then try again.',
    );
  }
  return client;
}

export interface TravelInvitee {
  name: string;
  email: string;
}

export interface TravelFriendInvitee {
  userId: string;
  name: string;
}

export async function publishTravelInvite(
  plan: TravelPlan,
  invitee: TravelInvitee,
): Promise<string> {
  const client = await requireAuthenticatedInviteClient();
  // Create the invite first so `is_travel_trip_host` is true, then push live
  // itinerary rows (invite payload stays a trip-shared bootstrap only).
  const { data, error } = await client.rpc('create_travel_invite', {
    invite_payload: { invite: encodeTravelInvite(plan) },
    invite_trip_id: plan.id,
    invitee_name: invitee.name.trim(),
    invitee_email: invitee.email.trim().toLowerCase(),
  });
  if (error || typeof data !== 'string' || !/^[a-f0-9]{20}$/.test(data)) {
    throw new TravelInviteError(
      error?.message ?? 'The invitation could not be created. Please try again.',
    );
  }
  await publishTravelTripItinerary(plan).catch(() => undefined);
  return data;
}

/** Creates an email-scoped invite without returning the friend's email to the client. */
export async function publishTravelFriendInvite(
  plan: TravelPlan,
  invitee: TravelFriendInvitee,
): Promise<string> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('create_travel_friend_invite', {
    invite_payload: { invite: encodeTravelInvite(plan) },
    invite_trip_id: plan.id,
    invitee_user_id: invitee.userId,
  });
  if (error || typeof data !== 'string' || !/^[a-f0-9]{20}$/.test(data)) {
    throw new TravelInviteError(
      error?.message ?? 'The invitation could not be created. Please try again.',
    );
  }
  await publishTravelTripItinerary(plan).catch(() => undefined);
  return data;
}

export async function resolveTravelInvite(
  value: string,
): Promise<Omit<TravelPlan, 'id' | 'createdAt' | 'updatedAt'> | undefined> {
  if (!isShortTravelInvite(value)) return undefined;

  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('resolve_travel_invite', {
    invite_code: value.slice(SHORT_INVITE_PREFIX.length),
  });
  if (error) throw new TravelInviteError('This invitation could not be opened.');

  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const row = data as { invite?: unknown; tripId?: unknown };
  const payload = typeof row.invite === 'string' ? row.invite : undefined;
  if (!payload) return undefined;
  const plan = decodeTravelInvite(payload);
  if (!plan) return undefined;
  const tripId = typeof row.tripId === 'string' ? row.tripId.trim() : '';
  const stamped = {
    ...plan,
    itinerary: markInviteSnapshotItinerary(plan.itinerary, 'host'),
  };
  return tripId ? { ...stamped, hostTripId: tripId } : stamped;
}

export async function acceptTravelInvite(value: string): Promise<boolean> {
  if (!isShortTravelInvite(value)) return false;
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('accept_travel_invite', {
    invite_code: value.slice(SHORT_INVITE_PREFIX.length),
  });
  if (error) throw new TravelInviteError('The invitation could not be accepted.');
  if (typeof data !== 'boolean') {
    throw new TravelInviteError('The invitation could not be accepted.');
  }
  return data;
}

export async function loadTravelInviteStatuses(
  codes: string[],
): Promise<Record<string, string>> {
  if (codes.length === 0 || !getSupabaseClient()) return {};
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('travel_invite_statuses', {
    invite_codes: codes,
  });
  if (error) throw new TravelInviteError('Invite statuses could not be refreshed.');
  const statuses: Record<string, string> = {};
  if (!Array.isArray(data)) return statuses;
  for (const row of data) {
    if (
      row &&
      typeof row === 'object' &&
      typeof row.code === 'string' &&
      typeof row.accepted_at === 'string'
    ) {
      statuses[row.code] = row.accepted_at;
    }
  }
  return statuses;
}

function travelInviteShareContent(
  plan: TravelPlan,
  code: string,
  invitee: Pick<TravelInvitee, 'name'>,
) {
  const inviteUrl = createTravelInviteUrl(
    code,
    process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
  );
  const message = [
    `${invitee.name}, you’re invited to “${plan.title}” ✈️`,
    `${plan.destination} · ${formatDateLong(plan.startDate)} – ${formatDateLong(plan.endDate)}`,
    'Open the trip in onTrack',
  ].join('\n');
  return {
    inviteUrl,
    message:
      process.env.EXPO_OS === 'ios'
        ? message
        : [message, inviteUrl].join('\n\n'),
  };
}

async function openTravelInviteShareSheet(
  plan: TravelPlan,
  code: string,
  invitee: Pick<TravelInvitee, 'name'>,
): Promise<boolean> {
  const { inviteUrl, message } = travelInviteShareContent(plan, code, invitee);
  const result = await Share.share(
    {
      title: `${plan.title} · onTrack`,
      message,
      ...(process.env.EXPO_OS === 'ios' ? { url: inviteUrl } : {}),
    },
    { subject: `You’re invited to ${plan.title}` },
  );
  return result.action !== Share.dismissedAction;
}

export async function shareTravelPlan(
  plan: TravelPlan,
  invitee: TravelInvitee,
): Promise<string | undefined> {
  const code = await publishTravelInvite(plan, invitee);
  const shared = await openTravelInviteShareSheet(plan, code, invitee);
  if (shared) return code;

  // The invite was already published before the native sheet opened. Revoke it
  // when the sheet is dismissed so the host never has an untracked live invite.
  await revokeTravelInvite(code);
  return undefined;
}

export async function shareTravelPlanWithFriend(
  plan: TravelPlan,
  invitee: TravelFriendInvitee,
): Promise<string | undefined> {
  const code = await publishTravelFriendInvite(plan, invitee);
  const shared = await openTravelInviteShareSheet(plan, code, invitee);
  if (shared) return code;
  await revokeTravelInvite(code);
  return undefined;
}

export async function resendTravelInvite(
  plan: TravelPlan,
  invitee: TravelInvitee,
  code: string,
): Promise<boolean> {
  return openTravelInviteShareSheet(plan, code, invitee);
}

export async function revokeTravelInvite(code: string): Promise<void> {
  const client = await requireAuthenticatedInviteClient();
  const { error } = await client.rpc('revoke_travel_invite', {
    invite_code: code,
  });
  if (error) throw new TravelInviteError('The invitation could not be removed.');
}
