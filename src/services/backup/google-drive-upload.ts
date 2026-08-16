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
}): Promise<{ id: string }> {
  const start = await driveFetch(`${DRIVE_UPLOAD}?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(new TextEncoder().encode(input.json).length),
    },
    body: JSON.stringify({
      name: input.name,
      mimeType: 'application/json',
      parents: [input.folderId],
      appProperties: { [GOOGLE_DRIVE_BACKUP_PROPERTY]: 'v1' },
    }),
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

export async function listGoogleDriveBackups(accessToken: string): Promise<GoogleDriveBackupFile[]> {
  const query = encodeURIComponent(
    `appProperties has { key='${GOOGLE_DRIVE_BACKUP_PROPERTY}' and value='v1' } and trashed=false`,
  );
  const response = await driveFetch(
    `${DRIVE_FILES}?q=${query}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json() as { files?: GoogleDriveBackupFile[] };
  return (payload.files ?? []).filter((file) => file.id && file.name);
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
