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

  it('lists newest app-created backups first', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'new', name: 'onTrack-backup-new.json', createdTime: '2026-08-16T12:00:00.000Z' },
          { id: 'old', name: 'onTrack-backup-old.json', createdTime: '2026-08-01T12:00:00.000Z' },
        ],
      }),
    } as Response);

    await expect(listGoogleDriveBackups('token')).resolves.toEqual([
      { id: 'new', name: 'onTrack-backup-new.json', createdTime: '2026-08-16T12:00:00.000Z' },
      { id: 'old', name: 'onTrack-backup-old.json', createdTime: '2026-08-01T12:00:00.000Z' },
    ]);
  });
});
