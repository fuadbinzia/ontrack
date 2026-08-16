import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GOOGLE_DRIVE_BACKUP_PROPERTY } from '../google-drive-oauth';
import { listGoogleDriveBackups, uploadBackupToGoogleDrive } from '../google-drive-upload';

describe('Google Drive backup upload', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads JSON with the app-owned backup property into the folder', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: (name: string) => (name === 'Location' ? 'https://upload.googleapis.test/resume' : null) },
      json: async () => ({}),
    } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'file-1' }),
    } as Response);

    await expect(uploadBackupToGoogleDrive({
      accessToken: 'token',
      folderId: 'folder-1',
      name: 'onTrack-backup-test.json',
      json: '{"kind":"ontrack.backup"}',
    })).resolves.toEqual({ id: 'file-1' });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(expect.objectContaining({
      name: 'onTrack-backup-test.json',
      parents: ['folder-1'],
      appProperties: { [GOOGLE_DRIVE_BACKUP_PROPERTY]: 'v1' },
    }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://upload.googleapis.test/resume');
  });

  it('overwrites an existing backup with PATCH and no new parents folder', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: (name: string) => (name === 'Location' ? 'https://upload.googleapis.test/resume' : null) },
      json: async () => ({}),
    } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'file-existing' }),
    } as Response);

    await expect(uploadBackupToGoogleDrive({
      accessToken: 'token',
      folderId: 'folder-1',
      fileId: 'file-existing',
      name: 'onTrack-backup-replaced.json',
      json: '{"kind":"ontrack.backup"}',
    })).resolves.toEqual({ id: 'file-existing' });

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/files/file-existing?uploadType=resumable');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'onTrack-backup-replaced.json',
      mimeType: 'application/json',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('parents');
  });

  it('lists newest backups in the app folder without querying appProperties', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'old', name: 'onTrack-backup-old.json', createdTime: '2026-08-01T12:00:00.000Z' },
          { id: 'other', name: 'notes.txt', createdTime: '2026-08-16T13:00:00.000Z' },
          { id: 'new', name: 'onTrack-backup-new.json', createdTime: '2026-08-16T12:00:00.000Z' },
          {
            id: 'tagged',
            name: 'custom.json',
            createdTime: '2026-08-16T11:00:00.000Z',
            appProperties: { [GOOGLE_DRIVE_BACKUP_PROPERTY]: 'v1' },
          },
        ],
      }),
    } as Response);

    await expect(listGoogleDriveBackups('token', 'folder-1')).resolves.toEqual([
      { id: 'new', name: 'onTrack-backup-new.json', createdTime: '2026-08-16T12:00:00.000Z' },
      {
        id: 'tagged',
        name: 'custom.json',
        createdTime: '2026-08-16T11:00:00.000Z',
        appProperties: { [GOOGLE_DRIVE_BACKUP_PROPERTY]: 'v1' },
      },
      { id: 'old', name: 'onTrack-backup-old.json', createdTime: '2026-08-01T12:00:00.000Z' },
    ]);

    const listedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(decodeURIComponent(listedUrl)).toContain("'folder-1' in parents and trashed=false");
    expect(decodeURIComponent(listedUrl)).not.toContain('appProperties has');
    expect(listedUrl).not.toContain('orderBy');
  });

  it('surfaces Drive list failures instead of leaving an empty backup list', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid Value' } }),
    } as Response);

    await expect(listGoogleDriveBackups('token', 'folder-1')).rejects.toThrow('Invalid Value');
  });

  it('does not search Drive with appProperties queries that drive.file rejects', () => {
    const server = readFileSync(join(process.cwd(), 'src/services/backup/google-drive-server.ts'), 'utf8');
    const upload = readFileSync(join(process.cwd(), 'src/services/backup/google-drive-upload.ts'), 'utf8');
    expect(server).not.toContain('appProperties has');
    expect(upload).not.toContain('appProperties has');
    expect(server).toContain("name='${GOOGLE_DRIVE_FOLDER_NAME}'");
    expect(upload).toContain('in parents and trashed=false');
  });
});
