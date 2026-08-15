import { useAvatarCache } from '@/features/account/avatar-cache';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { asNonEmptyString, asString } from '@/utils/parse';

import { TravelInviteError } from './travel-invite-error';
import type { TravelPlan, TravelTripRosterPerson } from './types';

/** Canonical trip id for host-scoped RPCs (member copies use hostTripId). */
export function canonicalTravelTripId(
  plan: Pick<TravelPlan, 'id' | 'hostTripId'>,
): string {
  const hostTripId = plan.hostTripId?.trim();
  return hostTripId || plan.id;
}

/**
 * Member copy joined via invite / open-join (not the host’s canonical plan).
 * Host plans may store hostTripId equal to plan.id after expense sync — that
 * alone does not make them a member copy.
 *
 * A distinct `hostTripId` without `chatAccessCode` is only treated as a member
 * copy when `hostDisplayName` is still set (typical member snapshot). After a
 * host-transfer promotion we clear chat access + host display name while keeping
 * `hostTripId` as the server trip id for expense sync.
 */
export function isTravelMemberPlan(
  plan: Pick<
    TravelPlan,
    'id' | 'chatAccessCode' | 'hostTripId' | 'hostDisplayName'
  >,
): boolean {
  if (plan.chatAccessCode) return true;
  const hostTripId = plan.hostTripId?.trim();
  if (!hostTripId || hostTripId === plan.id) return false;
  return Boolean(plan.hostDisplayName?.trim());
}

/**
 * Only the sole host may permanently delete a trip. Joined copies belong to a
 * member or co-host and can be removed only through the explicit Leave Trip
 * flow, which preserves the shared trip for everyone else.
 */
export function canDeleteTravelPlan(
  plan: Pick<
    TravelPlan,
    'id' | 'chatAccessCode' | 'hostTripId' | 'hostDisplayName'
  >,
): boolean {
  return !isTravelMemberPlan(plan);
}

export type TravelTripRosterRole = 'host' | 'cohost' | 'member';

/**
 * Sole-host UI (transfer / rename-host / open-join). Never elevate a member
 * copy just because the roster hasn’t loaded yet — that briefly showed host
 * controls on friend devices and let rename corrupt hostDisplayName.
 */
export function resolveIsTravelSoleHost(input: {
  myRosterRole?: TravelTripRosterRole;
  memberPlan: boolean;
}): boolean {
  if (input.myRosterRole === 'host') return true;
  if (input.myRosterRole === 'member' || input.myRosterRole === 'cohost') {
    return false;
  }
  // Roster pending / unavailable: only local host plans may assume sole host.
  return !input.memberPlan;
}

async function requireAuthenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new TravelInviteError(
      'Short travel links are not configured for this build. Add the Supabase public URL and publishable key, then try again.',
    );
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new TravelInviteError(
      'Sign in to onTrack, then try again.',
    );
  }
  return client;
}

function parseRosterPerson(value: unknown): TravelTripRosterPerson | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const userId = asNonEmptyString(row.userId);
  const displayName = asNonEmptyString(row.displayName);
  const role = row.role === 'host' || row.role === 'cohost' || row.role === 'member' ? row.role : undefined;
  if (!userId || !displayName || !role) return undefined;
  const avatarKind =
    row.avatarKind === 'initials' || row.avatarKind === 'icon' || row.avatarKind === 'photo'
      ? row.avatarKind
      : undefined;
  return {
    userId,
    displayName,
    role,
    ...(asNonEmptyString(row.email) ? { email: asNonEmptyString(row.email) } : {}),
    ...(asNonEmptyString(row.inviteCode)
      ? { inviteCode: asNonEmptyString(row.inviteCode) }
      : {}),
    ...(asNonEmptyString(asString(row.acceptedAt))
      ? { acceptedAt: asNonEmptyString(asString(row.acceptedAt)) }
      : {}),
    ...(avatarKind ? { avatarKind } : {}),
    ...(asNonEmptyString(asString(row.avatarColor))
      ? { avatarColor: asNonEmptyString(asString(row.avatarColor)) }
      : {}),
    ...(asNonEmptyString(asString(row.avatarIconId))
      ? { avatarIconId: asNonEmptyString(asString(row.avatarIconId)) }
      : {}),
    ...(asNonEmptyString(asString(row.avatarPhotoPath))
      ? { avatarPhotoPath: asNonEmptyString(asString(row.avatarPhotoPath)) }
      : {}),
  };
}

export async function listTravelTripRoster(
  tripId: string,
): Promise<TravelTripRosterPerson[]> {
  const client = await requireAuthenticatedClient();
  const { data, error } = await client.rpc('list_travel_trip_roster', {
    requested_trip_id: tripId,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Trip friends could not be loaded.',
    );
  }
  if (!Array.isArray(data)) return [];
  const people = data
    .map(parseRosterPerson)
    .filter((person): person is TravelTripRosterPerson => Boolean(person));
  useAvatarCache.getState().upsertMany(
    people.map((person) => ({
      userId: person.userId,
      avatar: {
        kind: person.avatarKind ?? 'initials',
        color: person.avatarColor,
        iconId: person.avatarIconId,
        photoPath: person.avatarPhotoPath,
      },
    })),
  );
  return people;
}

export type TransferTravelTripHostResult = {
  formerHostInviteCode: string;
  newHostUserId: string;
  newHostDisplayName: string;
};

export async function transferTravelTripHost(
  tripId: string,
  newHostUserId: string,
): Promise<TransferTravelTripHostResult> {
  const client = await requireAuthenticatedClient();
  const { data, error } = await client.rpc('transfer_travel_trip_host', {
    requested_trip_id: tripId,
    new_host_user_id: newHostUserId,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Host status could not be transferred.',
    );
  }
  return parseTransferResult(data);
}

export async function transferTravelTripHostByInvite(
  tripId: string,
  inviteCode: string,
): Promise<TransferTravelTripHostResult> {
  const client = await requireAuthenticatedClient();
  const { data, error } = await client.rpc('transfer_travel_trip_host_by_invite', {
    requested_trip_id: tripId,
    invite_code: inviteCode,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Host status could not be transferred.',
    );
  }
  return parseTransferResult(data);
}

function parseTransferResult(data: unknown): TransferTravelTripHostResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TravelInviteError('Host status could not be transferred.');
  }
  const row = data as Record<string, unknown>;
  const formerHostInviteCode = asNonEmptyString(row.formerHostInviteCode);
  const resultUserId = asNonEmptyString(row.newHostUserId);
  const newHostDisplayName =
    asNonEmptyString(row.newHostDisplayName) || 'Host';
  if (!formerHostInviteCode || !resultUserId) {
    throw new TravelInviteError('Host status could not be transferred.');
  }
  return {
    formerHostInviteCode,
    newHostUserId: resultUserId,
    newHostDisplayName,
  };
}

export async function grantTravelTripCohost(
  tripId: string,
  cohostUserId: string,
): Promise<void> {
  const client = await requireAuthenticatedClient();
  const { error } = await client.rpc('grant_travel_trip_cohost', {
    requested_trip_id: tripId,
    cohost_user_id: cohostUserId,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Co-host status could not be granted.',
    );
  }
}

export async function revokeTravelTripCohost(
  tripId: string,
  cohostUserId: string,
): Promise<void> {
  const client = await requireAuthenticatedClient();
  const { error } = await client.rpc('revoke_travel_trip_cohost', {
    requested_trip_id: tripId,
    cohost_user_id: cohostUserId,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Co-host status could not be removed.',
    );
  }
}

export async function leaveTravelTrip(tripId: string): Promise<void> {
  const client = await requireAuthenticatedClient();
  const { error } = await client.rpc('leave_travel_trip', {
    requested_trip_id: tripId,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'You could not leave this trip.',
    );
  }
}
