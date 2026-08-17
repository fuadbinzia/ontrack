import { loadAllSharedChecklists } from '@/services/todos/collaboration';
import { useNutrition } from '@/store/nutrition';

import { mergeDomainPayload } from './account-data-merge';
import { decideAccountData } from './data-ownership';
import { loadEntitlements } from './entitlements';
import { resolveCloudMedia } from './media';
import { getSupabaseClient } from './supabase';
import {
  domains,
  hasMeaningfulLocalData,
  objectValue,
  snapshotLocalDomains,
} from './sync-domains';
import { deleteAppOwnedMedia } from './sync-local-reset';
import {
  isCloudSyncPushPaused,
  pushDomains,
  startSubscriptions,
  stopCloudSync,
  syncRuntime,
  useCloudSyncStatus,
} from './sync-session';
import type {
  AccountSyncResolution,
  DataChoiceVariant,
  InitialSyncResult,
  JsonObject,
  SyncDomainName,
} from './sync-types';

export function getPendingDataChoiceVariant(): DataChoiceVariant | null {
  if (syncRuntime.pendingRemote === undefined) return null;
  return syncRuntime.pendingCloudEmpty ? 'new-account' : 'existing-account';
}

function clearPendingDataChoice() {
  syncRuntime.pendingRemote = undefined;
  syncRuntime.pendingCloudEmpty = false;
}

async function finishAccountSyncReady(isCurrent: () => boolean) {
  if (!isCurrent() || !syncRuntime.activeUserId) {
    cancelAccountSync();
    throw new Error('Sign-in was cancelled.');
  }
  clearPendingDataChoice();
  await loadEntitlements(syncRuntime.activeUserId);
  await Promise.race([
    loadAllSharedChecklists().catch(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 8_000);
    }),
  ]);
  startSubscriptions(syncRuntime.activeUserId, syncRuntime.activeEmail);
  useCloudSyncStatus.setState({
    state: 'synced',
    email: syncRuntime.activeEmail,
    lastSyncedAt: new Date().toISOString(),
    message: undefined,
  });
}

export async function applyRemote(
  remote: Map<SyncDomainName, JsonObject>,
  isCurrent: () => boolean = () => true,
) {
  const resolved = new Map<SyncDomainName, JsonObject>();
  await Promise.all(
    [...remote.entries()].map(async ([name, payload]) => {
      resolved.set(name, await resolveCloudMedia(payload));
    }),
  );
  if (!isCurrent()) {
    throw new Error('Sign-in was cancelled.');
  }
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;

  // Only replace domains the account already stores. Newly added domains
  // (or domains that failed to upload) keep local device data and are returned
  // so the caller can upload them before subscriptions start.
  const replacing = domains.filter((domain) => resolved.has(domain.name));
  const retained = domains.filter((domain) => !resolved.has(domain.name));
  const replacingPlants = replacing.some((domain) => domain.name === 'plants');
  const replacingSchedule = replacing.some((domain) => domain.name === 'schedule');
  await deleteAppOwnedMedia({
    plants: replacingPlants,
    visionBoard: replacing.some((domain) => domain.name === 'vision-board'),
    mealImages: replacingPlants || replacingSchedule,
  });
  if (!isCurrent()) {
    throw new Error('Sign-in was cancelled.');
  }
  for (const domain of replacing) {
    // Preferences write merges cloud scalars only (keeps device-only avatar).
    // A full resetAll before write would wipe avatar and any fields missing
    // from older cloud payloads.
    if (domain.name !== 'preferences') {
      domain.reset();
    }
    domain.write(resolved.get(domain.name)!);
  }
  // Refresh any signed URLs still living in retained local domains (e.g. an
  // older vision-board row that never made it to this account).
  for (const domain of retained) {
    domain.write(await resolveCloudMedia(domain.read()));
  }
  if (replacingSchedule) {
    useNutrition.getState().reset();
  }
  return retained;
}

export async function prepareAccountSync(
  userId: string,
  email: string | undefined,
  localCanConflict: boolean,
  isCurrent: () => boolean = () => true,
): Promise<InitialSyncResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud sync is not configured for this build.');
  stopCloudSync();
  syncRuntime.activeUserId = userId;
  syncRuntime.activeEmail = email;
  useCloudSyncStatus.setState({ state: 'syncing', email, message: undefined });

  // Dev Mode / agent sandbox: keep local fixtures. Live account was snapshotted
  // (and backed up) on enter — never pull cloud over the sandbox or upload it.
  if (isCloudSyncPushPaused()) {
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    // Heal toggle-on vs empty fixtures after Fast Refresh / a prior wipe.
    // Lazy require avoids a sync↔controller cycle at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reaffirmUserDevModeSandbox } =
      require('@/features/account/dev-mode-controller') as typeof import('@/features/account/dev-mode-controller');
    reaffirmUserDevModeSandbox();
    await loadEntitlements(userId);
    startSubscriptions(userId, email);
    useCloudSyncStatus.setState({
      state: 'synced',
      email,
      lastSyncedAt: new Date().toISOString(),
      message: undefined,
    });
    return 'ready';
  }

  const { data, error } = await client
    .from('app_state')
    .select('domain,payload')
    .eq('user_id', userId);
  if (error) throw error;
  if (!isCurrent()) {
    cancelAccountSync();
    throw new Error('Sign-in was cancelled.');
  }

  const remote = new Map<SyncDomainName, JsonObject>();
  for (const row of data ?? []) {
    const payload = objectValue(row.payload);
    if (payload && domains.some((domain) => domain.name === row.domain)) {
      remote.set(row.domain as SyncDomainName, payload);
    }
  }

  const decision = decideAccountData(
    remote.size,
    localCanConflict,
    hasMeaningfulLocalData(),
  );
  if (decision === 'upload-device') {
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    try {
      await pushDomains(userId, domains);
    } catch (uploadError) {
      // The account had no rows before this first upload. Remove any partial
      // rows so retrying cannot turn a failed promotion into a false conflict.
      await client.from('app_state').delete().eq('user_id', userId);
      throw uploadError;
    }
  } else if (decision === 'resolve-conflict') {
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    syncRuntime.pendingRemote = remote;
    syncRuntime.pendingCloudEmpty = remote.size === 0;
    return 'conflict';
  } else {
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    try {
      const retained = await applyRemote(remote, isCurrent);
      if (!isCurrent()) {
        cancelAccountSync();
        throw new Error('Sign-in was cancelled.');
      }
      if (retained.length > 0) {
        await pushDomains(userId, retained);
      }
    } catch (applyError) {
      if (!isCurrent()) {
        cancelAccountSync();
      }
      throw applyError;
    }
  }

  await finishAccountSyncReady(isCurrent);
  return 'ready';
}

export async function resolveAccountSync(
  choice: AccountSyncResolution,
  isCurrent: () => boolean = () => true,
) {
  if (!syncRuntime.activeUserId || syncRuntime.pendingRemote === undefined) {
    throw new Error('There is no data choice to resolve.');
  }
  useCloudSyncStatus.setState({
    state: 'syncing',
    email: syncRuntime.activeEmail,
    message: undefined,
  });
  if (!isCurrent()) {
    cancelAccountSync();
    throw new Error('Sign-in was cancelled.');
  }

  if (choice === 'keep-device') {
    await pushDomains(syncRuntime.activeUserId, domains);
  } else if (choice === 'start-fresh') {
    // Drop guest-synced domains; leave the new cloud account empty.
    for (const domain of domains) {
      domain.reset();
    }
    useNutrition.getState().reset();
  } else if (choice === 'discard-device') {
    const retained = await applyRemote(syncRuntime.pendingRemote, isCurrent);
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    if (retained.length > 0) {
      await pushDomains(syncRuntime.activeUserId, retained);
    }
  } else if (choice === 'merge') {
    if (syncRuntime.pendingRemote.size === 0) {
      throw new Error('Merge requires an existing cloud account.');
    }
    const deviceSnapshot = snapshotLocalDomains();
    await applyRemote(syncRuntime.pendingRemote, isCurrent);
    if (!isCurrent()) {
      cancelAccountSync();
      throw new Error('Sign-in was cancelled.');
    }
    for (const domain of domains) {
      if (domain.name === 'preferences' || domain.name === 'addons') continue;
      const device = deviceSnapshot.get(domain.name);
      if (!device) continue;
      const merged = mergeDomainPayload(domain.name, domain.read(), device);
      domain.write(merged);
    }
    await pushDomains(syncRuntime.activeUserId, domains);
  } else {
    throw new Error('Unknown data choice.');
  }

  await finishAccountSyncReady(isCurrent);
}

export function cancelAccountSync() {
  clearPendingDataChoice();
  stopCloudSync();
  useCloudSyncStatus.setState({
    state: getSupabaseClient() ? 'signed-out' : 'disabled',
    email: undefined,
    message: undefined,
  });
}
