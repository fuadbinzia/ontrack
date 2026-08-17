import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import {
    buildBackup,
    type OnTrackBackup,
} from '@/features/account/backup-archive';

export const ONTRACK_DATA_EXPORT_KIND = 'ontrack.data-export';

export function dataExportFileName(createdAt = new Date()): string {
  return `onTrack-data-export-${createdAt.toISOString().slice(0, 10)}.json`;
}

/** Structured per-domain copy of device data, including local Health and Journal. */
export function buildDataExport(createdAt?: string): OnTrackBackup {
  return buildBackup(createdAt, { includeSensitiveLocal: true });
}

export function serializeDataExport(backup: OnTrackBackup = buildDataExport()): string {
  return `${JSON.stringify(
    {
      kind: ONTRACK_DATA_EXPORT_KIND,
      exportedAt: backup.createdAt,
      appVersion: backup.appVersion,
      domains: backup.domains,
      local: backup.local,
    },
    null,
    2,
  )}\n`;
}

export async function shareDataExport(): Promise<{ name: string }> {
  const backup = buildDataExport();
  const json = serializeDataExport(backup);
  const name = dataExportFileName(new Date(backup.createdAt));
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true, intermediates: true });
  file.write(json);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save onTrack Data Export',
      UTI: 'public.json',
    });
    return { name };
  }
  await Share.share({
    message: json,
    title: name,
  });
  return { name };
}
