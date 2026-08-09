import { travelChatAccessCode } from '@/features/travel/chat';
import {
  compactSharedItineraryPayload,
  isItineraryItemOwnedBy,
  mergeOwnedItineraryItemWithRemote,
  normalizeTravelItemShareMode,
  pickNewerItineraryItem,
  preserveOwnedItinerarySecrets,
} from '@/features/travel/itinerary-visibility';
import { normalizeTravelItineraryItem } from '@/features/travel/normalize';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import {
  authenticatedTravelCollaborationClient,
  collaborationMessageFrom,
  fetchTravelTripRpc,
  sharedTravelTripId,
  shouldSyncTravelCollaboration,
} from '@/services/travel/travel-collaboration-shared';
import { useTravel } from '@/store/travel';
import { asNonEmptyString } from '@/utils/parse';

export class TravelItineraryCollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelItineraryCollaborationError';
  }
}

export type TravelItinerarySnapshot = {
  tripId: string;
  items: TravelItineraryItem[];
};

export {
  markInviteSnapshotItinerary,
  stampOwnedItineraryDefaults,
  touchItineraryItemShare,
} from '@/features/travel/itinerary-visibility';

export const shouldSyncTravelItinerary = shouldSyncTravelCollaboration;
export const sharedItineraryTripId = sharedTravelTripId;

async function authenticatedClient() {
  return authenticatedTravelCollaborationClient(
    TravelItineraryCollaborationError,
    {
      unconfigured: 'Shared trip itineraries are not configured for this build.',
      unsignedIn: 'Sign in to sync trip itineraries.',
    },
  );
}

export function parseRemoteItineraryItem(
  value: unknown,
): TravelItineraryItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const payload =
    row.payload && typeof row.payload === 'object' ? row.payload : row;
  const base = normalizeTravelItineraryItem(payload);
  if (!base) return undefined;

  const ownerUserId =
    asNonEmptyString(row.ownerUserId) ??
    asNonEmptyString(row.owner_user_id) ??
    asNonEmptyString((payload as TravelItineraryItem).ownerUserId);
  const shareMode = normalizeTravelItemShareMode(
    row.shareMode ??
      row.share_mode ??
      (payload as TravelItineraryItem).shareMode,
  );
  const sharedUpdatedAt =
    asNonEmptyString(row.updatedAt) ??
    asNonEmptyString(row.updated_at) ??
    asNonEmptyString((payload as TravelItineraryItem).sharedUpdatedAt);

  return {
    ...base,
    ...(ownerUserId ? { ownerUserId } : {}),
    shareMode,
    ...(sharedUpdatedAt ? { sharedUpdatedAt } : {}),
  };
}

export function parseItinerarySnapshot(
  value: unknown,
): TravelItinerarySnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const tripId = asNonEmptyString(row.tripId);
  if (!tripId) return undefined;
  const items = Array.isArray(row.items)
    ? row.items.flatMap((entry) => {
        const parsed = parseRemoteItineraryItem(entry);
        return parsed ? [parsed] : [];
      })
    : [];
  return { tripId, items };
}

export function itemsForPublish(
  plan: TravelPlan,
  localUserId: string,
): Array<{
  itemId: string;
  shareMode: string;
  sharedWithUserIds: string[];
  updatedAt: string;
  payload: TravelItineraryItem;
}> {
  const now = new Date().toISOString();
  return plan.itinerary
    .filter((item) => isItineraryItemOwnedBy(item, localUserId))
    .map((item) => {
      const owned: TravelItineraryItem = {
        ...item,
        ownerUserId: item.ownerUserId?.trim() || localUserId,
        shareMode: normalizeTravelItemShareMode(item.shareMode),
        sharedUpdatedAt: item.sharedUpdatedAt?.trim() || now,
      };
      const compact = compactSharedItineraryPayload(owned);
      return {
        itemId: owned.id,
        shareMode: normalizeTravelItemShareMode(owned.shareMode),
        // Column retained for older clients; per-person share mode is gone.
        sharedWithUserIds: [],
        updatedAt: owned.sharedUpdatedAt ?? now,
        payload: compact,
      };
    });
}

/**
 * Merge a remote visibility-filtered snapshot into the local plan.
 * - Owned items: keep local secrets; adopt newer share metadata via LWW.
 * - Peer items: keep only those still visible remotely (drop revoked shares).
 * - Bootstrap invite items without owner that conflict with remote peers are replaced.
 */
export function mergeItinerarySnapshot(
  plan: TravelPlan,
  snapshot: TravelItinerarySnapshot,
  localUserId: string,
): TravelPlan {
  const remoteById = new Map(
    snapshot.items.map((item) => [item.id, item] as const),
  );
  const localById = new Map(plan.itinerary.map((item) => [item.id, item]));
  const merged: TravelItineraryItem[] = [];
  const seen = new Set<string>();

  for (const local of plan.itinerary) {
    const remote = remoteById.get(local.id);
    if (isItineraryItemOwnedBy(local, localUserId)) {
      if (!remote) {
        merged.push({
          ...local,
          ownerUserId: local.ownerUserId?.trim() || localUserId,
        });
      } else {
        const newer = pickNewerItineraryItem(local, remote, true);
        merged.push(
          newer === local
            ? mergeOwnedItineraryItemWithRemote(local, remote)
            : preserveOwnedItinerarySecrets(local, remote),
        );
      }
      seen.add(local.id);
      continue;
    }

    // Peer / foreign-owned local cache: keep only if still in remote snapshot.
    if (remote) {
      merged.push(pickNewerItineraryItem(local, remote, false));
      seen.add(local.id);
    }
    // else drop — no longer shared with this viewer
  }

  for (const remote of snapshot.items) {
    if (seen.has(remote.id) || localById.has(remote.id)) continue;
    merged.push(remote);
  }

  return {
    ...plan,
    hostTripId: snapshot.tripId,
    itinerary: merged,
    updatedAt: new Date().toISOString(),
  };
}

export async function publishTravelTripItinerary(
  plan: TravelPlan,
): Promise<TravelItinerarySnapshot | undefined> {
  if (!shouldSyncTravelItinerary(plan)) return undefined;
  const { client, userId } = await authenticatedClient();
  let tripId = sharedItineraryTripId(plan);
  if (!tripId) {
    const access = travelChatAccessCode(plan);
    if (!access) return undefined;
    const { data: mapped } = await client.rpc('travel_trip_id_for_access', {
      access_code: access,
    });
    if (typeof mapped !== 'string' || !mapped.trim()) return undefined;
    tripId = mapped.trim();
  }

  const ownedLocalIds = new Set(
    plan.itinerary
      .filter((item) => isItineraryItemOwnedBy(item, userId))
      .map((item) => item.id),
  );

  // Ensure owned items have ownerUserId + timestamps before publish.
  const stampedPlan: TravelPlan = {
    ...plan,
    hostTripId: tripId,
    itinerary: plan.itinerary.map((item) => {
      if (!isItineraryItemOwnedBy(item, userId)) return item;
      return {
        ...item,
        ownerUserId: item.ownerUserId?.trim() || userId,
        shareMode: normalizeTravelItemShareMode(item.shareMode),
        sharedUpdatedAt: item.sharedUpdatedAt?.trim() || new Date().toISOString(),
      };
    }),
  };

  const publishItems = itemsForPublish(stampedPlan, userId);
  const { error: upsertError } = await client.rpc(
    'upsert_travel_trip_itinerary_items',
    {
      requested_trip_id: tripId,
      requested_items: publishItems,
    },
  );
  if (upsertError) {
    throw new TravelItineraryCollaborationError(
      collaborationMessageFrom(upsertError, 'Trip itinerary could not be shared.'),
    );
  }

  // Delete remote owned items that were removed locally.
  const { data: remoteData, error: fetchError } = await client.rpc(
    'fetch_travel_trip_itinerary',
    { requested_trip_id: tripId },
  );
  if (fetchError) {
    throw new TravelItineraryCollaborationError(
      collaborationMessageFrom(fetchError, 'Trip itinerary could not be refreshed.'),
    );
  }
  const remoteSnapshot = parseItinerarySnapshot(remoteData);
  if (remoteSnapshot) {
    const remoteOwnedIds = remoteSnapshot.items
      .filter((item) => item.ownerUserId === userId)
      .map((item) => item.id)
      .filter((id) => !ownedLocalIds.has(id));
    if (remoteOwnedIds.length) {
      const { error: deleteError } = await client.rpc(
        'delete_travel_trip_itinerary_items',
        {
          requested_trip_id: tripId,
          requested_item_ids: remoteOwnedIds,
        },
      );
      if (deleteError) {
        throw new TravelItineraryCollaborationError(
          collaborationMessageFrom(
            deleteError,
            'Removed itinerary stops could not sync.',
          ),
        );
      }
    }
  }

  const refreshed = await pullTravelTripItinerary({
    ...stampedPlan,
    hostTripId: tripId,
  });
  return refreshed
    ? { tripId, items: refreshed.itinerary }
    : { tripId, items: stampedPlan.itinerary };
}

export async function pullTravelTripItinerary(
  plan: TravelPlan,
): Promise<TravelPlan | undefined> {
  if (!shouldSyncTravelItinerary(plan)) return undefined;
  const { client, userId } = await authenticatedClient();
  const tripId = sharedItineraryTripId(plan);

  const rpc = await fetchTravelTripRpc({
    client,
    plan,
    tripId,
    byTrip: (id) =>
      client.rpc('fetch_travel_trip_itinerary', { requested_trip_id: id }),
    byAccess: (access) =>
      client.rpc('fetch_travel_trip_itinerary_by_access', {
        access_code: access,
      }),
  });
  if (!rpc) return undefined;

  if (rpc.error) {
    throw new TravelItineraryCollaborationError(
      collaborationMessageFrom(rpc.error, 'Trip itinerary could not be refreshed.'),
    );
  }
  if (rpc.data == null) return undefined;
  const snapshot = parseItinerarySnapshot(rpc.data);
  if (!snapshot) return undefined;

  const merged = mergeItinerarySnapshot(plan, snapshot, userId);
  useTravel.getState().savePlan(merged);
  return merged;
}

export async function pullAllTravelTripItineraries(): Promise<void> {
  const plans = useTravel.getState().plans.filter(shouldSyncTravelItinerary);
  await Promise.all(
    plans.map((plan) => pullTravelTripItinerary(plan).catch(() => undefined)),
  );
}
