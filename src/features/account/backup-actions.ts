import { applyBackup, type OnTrackBackup } from '@/features/account/backup-archive';
import { downloadBackup, pickBackupFile, writeBackupFile } from '@/features/account/backup-share';
import { flushCloudSync } from '@/services/cloud/sync';
import { startSubscriptions, syncRuntime } from '@/services/cloud/sync-session';

export async function restoreBackup(backup: OnTrackBackup, options?: { pushCloud?: boolean }) {
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;
  applyBackup(backup);
  if (options?.pushCloud) {
    await flushCloudSync();
    return;
  }
  if (syncRuntime.activeUserId) {
    startSubscriptions(syncRuntime.activeUserId, syncRuntime.activeEmail);
  }
}

export { downloadBackup, pickBackupFile, writeBackupFile };
