/**
 * Cloud sync public API. Implementation lives in colocated sync-* modules that
 * share one `syncRuntime` singleton (see sync-session.ts).
 */
export type {
  AccountSyncResolution,
  DataChoiceVariant,
  InitialSyncResult,
  SyncDomainName,
} from './sync-types';

export {
  cancelAccountSync,
  getPendingDataChoiceVariant,
  prepareAccountSync,
  resolveAccountSync,
} from './sync-account';

export { hasMeaningfulLocalData } from './sync-domains';

export { clearLocalAccountData } from './sync-local-reset';

export { REFRESH_APP_DATA_TIMEOUT_MS, refreshAppData } from './sync-refresh';

export {
  flushCloudDomain,
  flushCloudSync,
  flushCloudSyncPayloads,
  isCloudSyncPushPaused,
  restoreSyncedDomains,
  resumeCloudSyncAfterReset,
  setCloudSyncPushPaused,
  snapshotSyncedDomains,
  startCloudSync,
  stopCloudSync,
  useCloudSyncStatus,
} from './sync-session';
