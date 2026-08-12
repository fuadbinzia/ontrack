import { create } from 'zustand';

import {
  beginRuntimeOperation,
  removeRuntimeActivity,
  setRuntimeActivity,
} from '@/features/performance/runtime-activity';
import { isDevModeEnabled } from '@/store/dev-mode';
import { useUI } from '@/store/ui';

import { prepareCloudMedia } from './media';
import { getSupabaseClient } from './supabase';
import { domains, type SyncDomain } from './sync-domains';
import type { CloudSyncStatus, JsonObject, SyncDomainName } from './sync-types';

/** Single shared sync runtime — all cloud sync modules mutate this object. */
export const syncRuntime = {
  stopSubscriptions: undefined as (() => void) | undefined,
  activeUserId: undefined as string | undefined,
  activeEmail: undefined as string | undefined,
  pendingRemote: undefined as Map<SyncDomainName, JsonObject> | undefined,
  /** Set while `pendingRemote` is held — drives new vs existing account chooser copy. */
  pendingCloudEmpty: false,
  /** When true, domain change subscriptions do not push (Dev Mode sandbox). */
  cloudSyncPushPaused: false,
};

export const useCloudSyncStatus = create<CloudSyncStatus>(() => ({
  state: getSupabaseClient() ? 'signed-out' : 'disabled',
}));

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Sync failed.';
}

/**
 * Sandbox gate for cloud sync. Honors the in-memory flag and the persisted
 * Dev Mode store so Fast Refresh cannot resume pull/push while the toggle
 * still shows On (module vars reset; Zustand often survives).
 */
export function isCloudSyncPushPaused() {
  return syncRuntime.cloudSyncPushPaused || isDevModeEnabled();
}

/** Pause/resume automatic cloud pushes without tearing down the session. */
export function setCloudSyncPushPaused(paused: boolean) {
  syncRuntime.cloudSyncPushPaused = paused;
}

/** Capture synced domain payloads for Dev Mode restore. */
export function snapshotSyncedDomains(): Record<SyncDomainName, JsonObject> {
  const out = {} as Record<SyncDomainName, JsonObject>;
  for (const domain of domains) {
    out[domain.name] = domain.read();
  }
  return out;
}

/** Restore synced domain payloads after leaving Dev Mode. */
export function restoreSyncedDomains(snapshot: Partial<Record<SyncDomainName, JsonObject>>) {
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;
  for (const domain of domains) {
    const payload = snapshot[domain.name];
    if (payload) domain.write(payload);
  }
  if (syncRuntime.activeUserId) {
    startSubscriptions(syncRuntime.activeUserId, syncRuntime.activeEmail);
  }
}

export const CLOUD_WRITE_BATCH_SIZE = 100;

export async function pushDomains(
  userId: string,
  selectedDomains: SyncDomain[],
) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud sync is not configured for this build.');
  const rows = await Promise.all(
    selectedDomains.map(async (domain) => ({
      user_id: userId,
      domain: domain.name,
      payload: await prepareCloudMedia(userId, domain.name, domain.read()),
    })),
  );
  for (let start = 0; start < rows.length; start += CLOUD_WRITE_BATCH_SIZE) {
    const { error } = await client.from('app_state').upsert(
      rows.slice(start, start + CLOUD_WRITE_BATCH_SIZE),
      { onConflict: 'user_id,domain' },
    );
    if (error) throw error;
  }
}

async function pushDomain(userId: string, domain: SyncDomain) {
  await pushDomains(userId, [domain]);
}

/** Serialize per-domain uploads so a slower older snapshot cannot overwrite a newer one. */
const domainPushChains = new Map<SyncDomainName, Promise<void>>();

function enqueueDomainPush(userId: string, domain: SyncDomain) {
  const previous = domainPushChains.get(domain.name) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => {
      if (syncRuntime.activeUserId !== userId) return;
      return pushDomain(userId, domain);
    });
  domainPushChains.set(domain.name, next);
  const cleanup = () => {
    if (domainPushChains.get(domain.name) === next) {
      domainPushChains.delete(domain.name);
    }
  };
  void next.then(cleanup, cleanup);
  return next;
}

/**
 * Push one domain immediately (skips the interaction debounce).
 * Use after destructive local edits so a reload cannot restore stale cloud rows.
 */
export function flushCloudDomain(domainName: SyncDomainName): Promise<void> {
  if (!syncRuntime.activeUserId || isCloudSyncPushPaused()) return Promise.resolve();
  const domain = domains.find((item) => item.name === domainName);
  if (!domain) return Promise.resolve();
  return enqueueDomainPush(syncRuntime.activeUserId, domain);
}

const SYNC_DEBOUNCE_MS = 1200;
/** Hold pushes while the user is mid-interaction so sync JS doesn't fight gestures. */
const SYNC_INTERACTION_COOLDOWN_MS = 1800;

export function startSubscriptions(userId: string, email?: string) {
  syncRuntime.stopSubscriptions?.();
  const timers = new Map<SyncDomainName, ReturnType<typeof setTimeout>>();
  setRuntimeActivity(
    { id: 'sync.cloud', label: 'Cloud state sync', category: 'sync' },
    {
      status: isCloudSyncPushPaused() ? 'paused' : 'running',
      detail: `${domains.length} domain watchers`,
    },
  );

  const armPush = (domain: SyncDomain) => {
    if (isCloudSyncPushPaused()) return;
    const current = timers.get(domain.name);
    if (current) clearTimeout(current);
    timers.set(
      domain.name,
      setTimeout(() => {
        timers.delete(domain.name);
        if (isCloudSyncPushPaused()) return;
        const lastInteraction = useUI.getState().lastPageInteractionAt;
        if (
          lastInteraction > 0 &&
          Date.now() - lastInteraction < SYNC_INTERACTION_COOLDOWN_MS
        ) {
          armPush(domain);
          return;
        }
        const finishActivity = beginRuntimeOperation(
          { id: 'sync.cloud', label: 'Cloud state sync', category: 'sync' },
          { detail: `Uploading ${domain.name}` },
        );
        void enqueueDomainPush(userId, domain)
          .then(() => {
            finishActivity();
            if (syncRuntime.activeUserId !== userId) return;
            useCloudSyncStatus.setState({
              state: 'synced',
              email,
              lastSyncedAt: new Date().toISOString(),
              message: undefined,
            });
          })
          .catch((error: unknown) => {
            finishActivity({ error: true });
            if (syncRuntime.activeUserId !== userId) return;
            useCloudSyncStatus.setState({
              state: 'error',
              email,
              message: errorMessage(error),
            });
          });
      }, SYNC_DEBOUNCE_MS),
    );
  };

  const unsubscribers = domains.map((domain) =>
    domain.subscribe(() => armPush(domain)),
  );
  syncRuntime.stopSubscriptions = () => {
    timers.forEach(clearTimeout);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    removeRuntimeActivity('sync.cloud');
  };
}

export async function flushCloudSync() {
  if (!syncRuntime.activeUserId) return;
  if (isCloudSyncPushPaused()) return;
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;
  useCloudSyncStatus.setState({
    state: 'syncing',
    email: syncRuntime.activeEmail,
    message: undefined,
  });
  try {
    await pushDomains(syncRuntime.activeUserId, domains);
    useCloudSyncStatus.setState({
      state: 'synced',
      email: syncRuntime.activeEmail,
      lastSyncedAt: new Date().toISOString(),
      message: undefined,
    });
  } catch (error) {
    useCloudSyncStatus.setState({
      state: 'error',
      email: syncRuntime.activeEmail,
      message: errorMessage(error),
    });
    throw error;
  } finally {
    if (syncRuntime.activeUserId) {
      startSubscriptions(syncRuntime.activeUserId, syncRuntime.activeEmail);
    }
  }
}

/**
 * Push fixed domain payloads (e.g. a Dev Mode live snapshot) even while
 * automatic push is paused — so sandbox entry can flip the UI immediately
 * without racing demo seeds into a live-state flush.
 */
export async function flushCloudSyncPayloads(
  payloads: Partial<Record<SyncDomainName, JsonObject>>,
): Promise<void> {
  if (!syncRuntime.activeUserId) return;
  const client = getSupabaseClient();
  if (!client) return;
  const userId = syncRuntime.activeUserId;
  const selected = domains.filter((domain) => payloads[domain.name] != null);
  if (selected.length === 0) return;

  useCloudSyncStatus.setState({
    state: 'syncing',
    email: syncRuntime.activeEmail,
    message: undefined,
  });
  try {
    const rows = await Promise.all(
      selected.map(async (domain) => ({
        user_id: userId,
        domain: domain.name,
        payload: await prepareCloudMedia(userId, domain.name, payloads[domain.name]!),
      })),
    );
    for (let start = 0; start < rows.length; start += CLOUD_WRITE_BATCH_SIZE) {
      const { error } = await client.from('app_state').upsert(
        rows.slice(start, start + CLOUD_WRITE_BATCH_SIZE),
        { onConflict: 'user_id,domain' },
      );
      if (error) throw error;
    }
    if (syncRuntime.activeUserId !== userId) return;
    useCloudSyncStatus.setState({
      state: 'synced',
      email: syncRuntime.activeEmail,
      lastSyncedAt: new Date().toISOString(),
      message: undefined,
    });
  } catch (error) {
    if (syncRuntime.activeUserId !== userId) return;
    useCloudSyncStatus.setState({
      state: 'error',
      email: syncRuntime.activeEmail,
      message: errorMessage(error),
    });
  }
}

export function stopCloudSync() {
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;
  syncRuntime.activeUserId = undefined;
  syncRuntime.activeEmail = undefined;
}

/** Resume watching empty domains after an in-session destructive reset. */
export function resumeCloudSyncAfterReset(userId: string, email?: string) {
  syncRuntime.activeUserId = userId;
  syncRuntime.activeEmail = email;
  startSubscriptions(userId, email);
  useCloudSyncStatus.setState({
    state: 'synced',
    email,
    lastSyncedAt: new Date().toISOString(),
    message: undefined,
  });
}

/** Backward-compatible cleanup for callers mounted by older navigation shells. */
export function startCloudSync(): () => void {
  return () => stopCloudSync();
}
