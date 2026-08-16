import { parseBackup, type OnTrackBackup } from '@/features/account/backup-archive';

import type { GoogleDriveBackupFile } from './google-drive-client';
import { GOOGLE_DRIVE_BACKUP_PROPERTY } from './google-drive-oauth';

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';

async function driveFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(failure.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

export async function uploadBackupToGoogleDrive(input: {
  accessToken: string;
  folderId: string;
  name: string;
  json: string;
  /** When set, replace this existing app-created backup instead of creating another file. */
  fileId?: string;
}): Promise<{ id: string }> {
  const bytes = new TextEncoder().encode(input.json).length;
  const updating = Boolean(input.fileId);
  const startUrl = updating
    ? `${DRIVE_UPLOAD}/${encodeURIComponent(input.fileId!)}?uploadType=resumable`
    : `${DRIVE_UPLOAD}?uploadType=resumable`;
  const start = await driveFetch(startUrl, {
    method: updating ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(bytes),
    },
    body: JSON.stringify(
      updating
        ? { name: input.name, mimeType: 'application/json' }
        : {
            name: input.name,
            mimeType: 'application/json',
            parents: [input.folderId],
            appProperties: { [GOOGLE_DRIVE_BACKUP_PROPERTY]: 'v1' },
          },
    ),
  });
  const location = start.headers.get('Location');
  if (!location) throw new Error('Google Drive did not start the backup upload.');
  const uploaded = await driveFetch(location, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: input.json,
  });
  return uploaded.json() as Promise<{ id: string }>;
}

export async function listGoogleDriveBackups(
  accessToken: string,
  folderId: string,
): Promise<GoogleDriveBackupFile[]> {
  // drive.file rejects appProperties search and orderBy (`Invalid Value`). List the folder, sort here.
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await driveFetch(
    `${DRIVE_FILES}?q=${query}&fields=files(id,name,createdTime,appProperties)&pageSize=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json() as {
    files?: (GoogleDriveBackupFile & { appProperties?: Record<string, string> })[];
  };
  return (payload.files ?? []).filter((file) => {
    if (!file.id || !file.name) return false;
    return (
      file.appProperties?.[GOOGLE_DRIVE_BACKUP_PROPERTY] === 'v1'
      || file.name.startsWith('onTrack-backup')
    );
  }).sort((left, right) => {
    const leftTime = Date.parse(left.createdTime ?? '');
    const rightTime = Date.parse(right.createdTime ?? '');
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

export async function downloadGoogleDriveBackup(
  accessToken: string,
  fileId: string,
): Promise<OnTrackBackup> {
  const response = await driveFetch(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return parseBackup(await response.text());
}
