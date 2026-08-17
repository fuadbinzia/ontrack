import { Share } from 'react-native';

import {
  decodeTravelInvite,
  encodeTravelInvite,
  ONTRACK_TRAVEL_SHARE_URL,
} from '@/features/travel/travel-invite-codec';
import { TravelInviteError } from '@/features/travel/travel-invite-error';
import { requireAuthenticatedInviteClient } from '@/features/travel/travel-invite-api';
import type {
  TravelOpenJoinPreview,
  TravelOpenJoinRequest,
  TravelOpenJoinStatus,
  TravelPlan,
} from '@/features/travel/types';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { publishTravelTripItinerary } from '@/services/travel/itinerary-collaboration';
import { formatDateLong } from '@/utils/date';

export function isOpenTravelJoinCode(value: string): boolean {
  return /^[a-f0-9]{20}$/.test(value);
}

export function createTravelOpenJoinUrl(code: string, configuredBase?: string): string {
  const path = `/j/${code}`;
  const normalizedBase = (configuredBase || ONTRACK_TRAVEL_SHARE_URL).replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

export function createInstalledTravelOpenJoinUrl(code: string): string {
  return `ontrack:///j/${code}`;
}

function asOpenJoinStatus(value: unknown): TravelOpenJoinStatus | undefined {
  return value === 'none' ||
    value === 'pending' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'host'
    ? value
    : undefined;
}

function parseOpenJoinStatusPayload(data: unknown): {
  status: TravelOpenJoinStatus;
  requestId?: string;
  tripId?: string;
  grantedInviteCode?: string;
} {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TravelInviteError('Join status could not be loaded.');
  }
  const row = data as Record<string, unknown>;
  const status = asOpenJoinStatus(row.status);
  if (!status) throw new TravelInviteError('Join status could not be loaded.');
  return {
    status,
    requestId: typeof row.requestId === 'string' ? row.requestId : undefined,
    tripId: typeof row.tripId === 'string' ? row.tripId : undefined,
    grantedInviteCode:
      typeof row.grantedInviteCode === 'string' &&
      /^[a-f0-9]{20}$/.test(row.grantedInviteCode)
        ? row.grantedInviteCode
        : undefined,
  };
}

export async function ensureTravelOpenJoinLink(plan: TravelPlan): Promise<string> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('create_travel_open_join_link', {
    invite_trip_id: plan.id,
    invite_title: plan.title,
    invite_destination: plan.destination,
    invite_start_date: plan.startDate,
    invite_end_date: plan.endDate,
    invite_payload: { invite: encodeTravelInvite(plan) },
  });
  if (error || typeof data !== 'string' || !isOpenTravelJoinCode(data)) {
    throw new TravelInviteError(
      error?.message ?? 'The open join link could not be created. Please try again.',
    );
  }
  // Link creation establishes host membership for itinerary RPCs.
  await publishTravelTripItinerary(plan).catch(() => undefined);
  return data;
}

export async function previewTravelOpenJoin(
  code: string,
): Promise<TravelOpenJoinPreview | undefined> {
  if (!isOpenTravelJoinCode(code)) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.rpc('preview_travel_open_join', {
    link_code: code,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const row = data as Record<string, unknown>;
  if (
    typeof row.title !== 'string' ||
    typeof row.destination !== 'string' ||
    typeof row.startDate !== 'string' ||
    typeof row.endDate !== 'string' ||
    typeof row.tripId !== 'string'
  ) {
    return undefined;
  }
  return {
    title: row.title,
    destination: row.destination,
    startDate: row.startDate,
    endDate: row.endDate,
    tripId: row.tripId,
  };
}

export async function requestTravelOpenJoin(code: string): Promise<{
  status: TravelOpenJoinStatus;
  requestId?: string;
  tripId?: string;
  grantedInviteCode?: string;
}> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('request_travel_open_join', {
    link_code: code,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'Your join request could not be sent. Please try again.',
    );
  }
  return parseOpenJoinStatusPayload(data);
}

export async function loadTravelOpenJoinStatus(code: string): Promise<{
  status: TravelOpenJoinStatus;
  requestId?: string;
  tripId?: string;
  grantedInviteCode?: string;
} | undefined> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('travel_open_join_status', {
    link_code: code,
  });
  if (error) {
    throw new TravelInviteError('Join status could not be refreshed.');
  }
  if (data == null) return undefined;
  return parseOpenJoinStatusPayload(data);
}

export async function listTravelOpenJoinRequests(
  tripId: string,
): Promise<TravelOpenJoinRequest[]> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('list_travel_open_join_requests', {
    invite_trip_id: tripId,
  });
  if (error) {
    throw new TravelInviteError('Join requests could not be loaded.');
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      typeof item.requester_user_id !== 'string' ||
      typeof item.requester_name !== 'string' ||
      typeof item.status !== 'string' ||
      typeof item.created_at !== 'string'
    ) {
      return [];
    }
    if (
      item.status !== 'pending' &&
      item.status !== 'approved' &&
      item.status !== 'rejected'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        requesterUserId: item.requester_user_id,
        requesterName: item.requester_name,
        status: item.status,
        createdAt: item.created_at,
        grantedInviteCode:
          typeof item.granted_invite_code === 'string' &&
          /^[a-f0-9]{20}$/.test(item.granted_invite_code)
            ? item.granted_invite_code
            : undefined,
      },
    ];
  });
}

export async function decideTravelOpenJoin(
  requestId: string,
  approve: boolean,
): Promise<{
  status: TravelOpenJoinStatus;
  requestId: string;
  grantedInviteCode?: string;
  requesterName?: string;
  requesterUserId?: string;
}> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('decide_travel_open_join', {
    request_id: requestId,
    approve,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TravelInviteError(
      error?.message ?? 'The join request could not be updated.',
    );
  }
  const row = data as Record<string, unknown>;
  const status = asOpenJoinStatus(row.status);
  if (!status || typeof row.requestId !== 'string') {
    throw new TravelInviteError('The join request could not be updated.');
  }
  return {
    status,
    requestId: row.requestId,
    grantedInviteCode:
      typeof row.grantedInviteCode === 'string' &&
      /^[a-f0-9]{20}$/.test(row.grantedInviteCode)
        ? row.grantedInviteCode
        : undefined,
    requesterName:
      typeof row.requesterName === 'string' ? row.requesterName : undefined,
    requesterUserId:
      typeof row.requesterUserId === 'string' ? row.requesterUserId : undefined,
  };
}

export async function resolveTravelOpenJoin(code: string): Promise<{
  plan: Omit<TravelPlan, 'id' | 'createdAt' | 'updatedAt'>;
  tripId: string;
  grantedInviteCode?: string;
  status: TravelOpenJoinStatus;
}> {
  const client = await requireAuthenticatedInviteClient();
  const { data, error } = await client.rpc('resolve_travel_open_join', {
    link_code: code,
  });
  if (error) {
    throw new TravelInviteError(
      error.message || 'This trip could not be opened yet.',
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TravelInviteError('This join link expired. Ask the host for a fresh one.');
  }
  const row = data as Record<string, unknown>;
  const invite =
    typeof row.invite === 'string' ? decodeTravelInvite(row.invite) : undefined;
  const tripId = typeof row.tripId === 'string' ? row.tripId : undefined;
  const status = asOpenJoinStatus(row.status);
  if (!invite || !tripId || !status) {
    throw new TravelInviteError('This join link expired. Ask the host for a fresh one.');
  }
  return {
    plan: invite,
    tripId,
    status,
    grantedInviteCode:
      typeof row.grantedInviteCode === 'string' &&
      /^[a-f0-9]{20}$/.test(row.grantedInviteCode)
        ? row.grantedInviteCode
        : undefined,
  };
}

export async function shareTravelOpenJoinLink(
  plan: TravelPlan,
  code: string,
): Promise<boolean> {
  const inviteUrl = createTravelOpenJoinUrl(
    code,
    process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
  );
  const message = [
    `Join “${plan.title}” on onTrack ✈️`,
    `${plan.destination} · ${formatDateLong(plan.startDate)} – ${formatDateLong(plan.endDate)}`,
    'Open the link to request to join. The trip host will approve new friends.',
  ].join('\n');
  const result = await Share.share(
    {
      title: `${plan.title} · Join onTrack`,
      message:
        process.env.EXPO_OS === 'ios'
          ? message
          : [message, inviteUrl].join('\n\n'),
      ...(process.env.EXPO_OS === 'ios' ? { url: inviteUrl } : {}),
    },
    { subject: `Join ${plan.title} on onTrack` },
  );
  return result.action !== Share.dismissedAction;
}
