import type { JsonObject as MergeJsonObject } from './account-data-merge';

export type SyncDomainName =
  | 'addons'
  | 'agents'
  | 'preferences'
  | 'schedule'
  | 'plants'
  | 'travel'
  | 'todos'
  | 'vision-board'
  | 'vehicles';
export type InitialSyncResult = 'ready' | 'conflict';
/** Choices on `/auth/data-choice` after a dirty guest upgrade (not cancel). */
export type AccountSyncResolution = 'merge' | 'discard-device' | 'keep-device' | 'start-fresh';
export type DataChoiceVariant = 'new-account' | 'existing-account';
export type JsonObject = MergeJsonObject;

export interface CloudSyncStatus {
  state: 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error';
  email?: string;
  lastSyncedAt?: string;
  message?: string;
}
