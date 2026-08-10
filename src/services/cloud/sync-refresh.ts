import { loadAllSharedTodoLists } from '@/services/todos/collaboration';
import { pullAllTravelTripExpenses } from '@/services/travel/expense-collaboration';
import { pullAllTravelTripItineraries } from '@/services/travel/itinerary-collaboration';
import { loadAllSharedVehicles } from '@/services/vehicles/collaboration';
import { useFriends } from '@/store/friends';

import { loadEntitlements } from './entitlements';
import { getSupabaseClient } from './supabase';
import { applyRemote } from './sync-account';
import { domains, objectValue } from './sync-domains';
import {
  errorMessage,
  flushCloudSync,
  isCloudSyncPushPaused,
  pushDomains,
  startSubscriptions,
  syncRuntime,
  useCloudSyncStatus,
} from './sync-session';
import type { JsonObject, SyncDomainName } from './sync-types';

/** Cap pull-to-refresh cloud work so a stalled request cannot hang forever. */
export const REFRESH_APP_DATA_TIMEOUT_MS = 12_000;

function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Pull-to-refresh: flush local edits, pull cloud domains, reload shared
 * collaboration snapshots and the friends graph.
 */
export async function refreshAppData() {
  const client = getSupabaseClient();
  if (!client || !syncRuntime.activeUserId) {
    await withDeadline(
      useFriends.getState().refresh().catch(() => undefined),
      REFRESH_APP_DATA_TIMEOUT_MS,
      'Refresh timed out.',
    ).catch(() => undefined);
    return;
  }

  const userId = syncRuntime.activeUserId;
  const email = syncRuntime.activeEmail;
  const stillActive = () => syncRuntime.activeUserId === userId;
  useCloudSyncStatus.setState({ state: 'syncing', email, message: undefined });

  try {
    await withDeadline(
      (async () => {
        await flushCloudSync().catch(() => undefined);
        if (!stillActive()) return;

        const { data, error } = await client
          .from('app_state')
          .select('domain,payload')
          .eq('user_id', userId);
        if (error) throw error;
        if (!stillActive()) return;

        const remote = new Map<SyncDomainName, JsonObject>();
        for (const row of data ?? []) {
          const payload = objectValue(row.payload);
          if (payload && domains.some((domain) => domain.name === row.domain)) {
            remote.set(row.domain as SyncDomainName, payload);
          }
        }

        if (remote.size > 0 && !isCloudSyncPushPaused()) {
          const retained = await applyRemote(remote, stillActive);
          if (!stillActive()) return;
          if (retained.length > 0) {
            await pushDomains(userId, retained).catch(() => undefined);
          }
          if (stillActive()) {
            startSubscriptions(userId, email);
          }
        } else if (stillActive() && isCloudSyncPushPaused()) {
          // Sandbox: keep local fixtures; still refresh collaboration below.
          startSubscriptions(userId, email);
        }

        if (!stillActive()) return;

        await loadEntitlements(userId).catch(() => undefined);
        if (!stillActive()) return;

        await Promise.all([
          loadAllSharedTodoLists().catch(() => undefined),
          loadAllSharedVehicles().catch(() => undefined),
          pullAllTravelTripExpenses().catch(() => undefined),
          pullAllTravelTripItineraries().catch(() => undefined),
          useFriends.getState().refresh().catch(() => undefined),
        ]);

        if (stillActive()) {
          useCloudSyncStatus.setState({
            state: 'synced',
            email,
            lastSyncedAt: new Date().toISOString(),
            message: undefined,
          });
        }
      })(),
      REFRESH_APP_DATA_TIMEOUT_MS,
      'Refresh timed out.',
    );
  } catch (error) {
    // Sign-out mid-refresh invalidates stillActive — exit quietly.
    if (!stillActive()) return;
    useCloudSyncStatus.setState({
      state: 'error',
      email,
      message: errorMessage(error),
    });
    throw error;
  }
}
