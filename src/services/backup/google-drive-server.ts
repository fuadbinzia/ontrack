import { fetchGoogleApi } from '@/services/calendar/google-fetch';
import { googleCalendarAdmin } from '@/services/calendar/google-oauth';

import {
  GOOGLE_DRIVE_FOLDER_NAME,
  GOOGLE_DRIVE_FOLDER_PROPERTY,
  googleDriveAccessToken,
  revokeGoogleDriveToken,
} from './google-drive-oauth';

type DriveConnectionRow = {
  user_id: string;
  google_email: string | null;
  refresh_token_ciphertext: string;
  folder_id: string | null;
  connected_at: string;
  last_backup_at: string | null;
};

async function connection(userId: string) {
  const { data, error } = await googleCalendarAdmin()
    .from('google_drive_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as DriveConnectionRow | null;
}

async function driveJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetchGoogleApi(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(failure.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

async function ensureBackupFolder(token: string, folderId: string | null) {
  if (folderId) {
    try {
      const existing = await driveJson<{ id?: string; trashed?: boolean }>(
        token,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`,
      );
      if (existing.id && !existing.trashed) return existing.id;
    } catch {
      // Folder was removed or is inaccessible; create a fresh one.
    }
  }
  const query = encodeURIComponent(
    `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listed = await driveJson<{ files?: { id?: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`,
  );
  const existingId = listed.files?.find((file) => file.id)?.id;
  if (existingId) return existingId;
  const created = await driveJson<{ id: string }>(token, 'https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { [GOOGLE_DRIVE_FOLDER_PROPERTY]: 'v1' },
    }),
  });
  return created.id;
}

export async function googleDriveStatus(userId: string) {
  const row = await connection(userId);
  return {
    connected: Boolean(row),
    email: row?.google_email ?? undefined,
    lastBackupAt: row?.last_backup_at ?? undefined,
  };
}

export async function googleDriveUploadSession(userId: string) {
  const row = await connection(userId);
  if (!row) throw new Error('Connect Google Drive before saving a backup.');
  const accessToken = await googleDriveAccessToken(row.refresh_token_ciphertext);
  const folderId = await ensureBackupFolder(accessToken, row.folder_id);
  if (folderId !== row.folder_id) {
    const { error } = await googleCalendarAdmin()
      .from('google_drive_connections')
      .update({ folder_id: folderId })
      .eq('user_id', userId);
    if (error) throw error;
  }
  return {
    accessToken,
    folderId,
    email: row.google_email ?? undefined,
  };
}

export async function markGoogleDriveBackupComplete(userId: string) {
  const { data, error } = await googleCalendarAdmin()
    .from('google_drive_connections')
    .update({ last_backup_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('last_backup_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Connect Google Drive before saving a backup.');
  return { lastBackupAt: data.last_backup_at as string };
}

export async function disconnectGoogleDriveServer(userId: string) {
  const row = await connection(userId);
  if (row) await revokeGoogleDriveToken(row.refresh_token_ciphertext);
  const { error } = await googleCalendarAdmin()
    .from('google_drive_connections')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
  return { disconnected: true };
}
