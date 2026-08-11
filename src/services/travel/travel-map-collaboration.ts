import { avatarMetaFromProfileRow } from '@/features/account/profile-avatar-model';
import { normalizeTravelMapVisits } from '@/features/travel/map/normalize';
import type {
  TravelMapFriendLayer,
  TravelMapFriendProfile,
} from '@/features/travel/map/types';
import { travelMapPersonColorForId } from '@/features/travel/map/model';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { useTravelMap, type TravelMapMutation } from '@/store/travel-map';

export class TravelMapCollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelMapCollaborationError';
  }
}

function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new TravelMapCollaborationError('Friend maps are not configured for this build.');
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new TravelMapCollaborationError('Sign in to share or view friend maps.');
  }
  return client;
}

export async function setTravelMapVisibility(enabled: boolean): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('set_travel_map_visibility', {
    requested_enabled: enabled,
  });
  if (error) {
    throw new TravelMapCollaborationError(
      messageFrom(error, 'Map visibility could not be updated.'),
    );
  }
  useTravelMap.getState().setShareWithFriends(enabled);
}

export async function flushTravelMapMutations(): Promise<void> {
  const state = useTravelMap.getState();
  const batch = state.pendingMutations.slice(0, 100);
  if (batch.length === 0) return;
  const client = await authenticatedClient();
  const { error } = await client.rpc('apply_travel_map_mutations', {
    requested_mutations: batch.map((entry: TravelMapMutation) =>
      entry.type === 'upsert'
        ? { mutationId: entry.id, type: 'upsert', visit: entry.visit }
        : {
            mutationId: entry.id,
            type: 'delete',
            visitId: entry.visitId,
            updatedAt: entry.createdAt,
          },
    ),
  });
  if (error) {
    throw new TravelMapCollaborationError(
      messageFrom(error, 'Travel map changes could not be synced.'),
    );
  }
  state.clearPendingMutations(batch.map((entry) => entry.id));
}

export async function pullMyTravelMap(): Promise<void> {
  const client = await authenticatedClient();
  await flushTravelMapMutations();
  const { data, error } = await client.rpc('list_my_travel_map');
  if (error) {
    throw new TravelMapCollaborationError(
      messageFrom(error, 'Your travel map could not be refreshed.'),
    );
  }
  if (!data || typeof data !== 'object') return;
  const payload = data as { shareWithFriends?: unknown; visits?: unknown };
  useTravelMap.getState().replaceVisits(normalizeTravelMapVisits(payload.visits));
  useTravelMap.getState().setShareWithFriends(payload.shareWithFriends === true);
}

export async function listVisibleFriendMapProfiles(): Promise<TravelMapFriendProfile[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_visible_friend_map_profiles');
  if (error) {
    throw new TravelMapCollaborationError(
      messageFrom(error, 'Friend maps could not be loaded.'),
    );
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const userId = typeof row.userId === 'string' ? row.userId : undefined;
    const displayName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
    if (!userId || !displayName) return [];
    return [{ userId, displayName, avatar: avatarMetaFromProfileRow(row) }];
  });
}

export async function loadFriendTravelMaps(
  friendIds: string[],
): Promise<TravelMapFriendLayer[]> {
  if (friendIds.length === 0) return [];
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_friend_travel_maps', {
    requested_friend_ids: friendIds,
  });
  if (error) {
    throw new TravelMapCollaborationError(
      messageFrom(error, 'Selected friend maps could not be loaded.'),
    );
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const userId = typeof row.userId === 'string' ? row.userId : undefined;
    const displayName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
    if (!userId || !displayName) return [];
    return [
      {
        person: {
          userId,
          displayName,
          avatar: avatarMetaFromProfileRow(row),
          color: travelMapPersonColorForId(userId),
        },
        visits: normalizeTravelMapVisits(row.visits),
      },
    ];
  });
}
