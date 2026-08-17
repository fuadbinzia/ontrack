import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatBackupTime } from '../backup-screen-panels';

const screen = readFileSync(
  join(process.cwd(), 'src/features/account/backup-screen.tsx'),
  'utf8',
);
const panels = readFileSync(
  join(process.cwd(), 'src/features/account/backup-screen-panels.tsx'),
  'utf8',
);
const profile = readFileSync(
  join(process.cwd(), 'src/app/(tabs)/profile/index.tsx'),
  'utf8',
);

describe('profile backup', () => {
  it('offers download and Google Drive from Profile', () => {
    expect(profile).toContain('AgentUiIds.profile.backup');
    expect(profile).toContain("label=\"Backup\"");
    expect(profile).toContain('/(tabs)/profile/backup');
    expect(panels).toContain('AgentUiIds.backup.download');
    expect(panels).toContain('AgentUiIds.backup.connectDrive');
    expect(screen).not.toContain('disabled={disabled || !statusLoaded}');
    expect(screen).toContain("appPrompt.alert('Google Drive', text)");
    expect(screen).toContain('caught.code === \'CANCELLED\'');
    expect(screen).toContain('googleDriveConnectErrorMessage(new Error(params.driveError))');
    expect(screen).toContain('googleDriveBackupErrorMessage');
    expect(panels).toContain('AgentUiIds.backup.saveDrive');
    expect(panels).toContain('AgentUiIds.backup.restoreFile');
    expect(panels).toContain('AgentUiIds.backup.restoreDrive');
    expect(screen).toContain('photos, videos, and your customizations');
    expect(screen).toContain('includeSensitiveLocal');
    expect(screen).toContain('AgentUiIds.backup.includeSensitive');
    expect(screen).not.toContain('stay as links to files already on this phone');
  });

  it('documents the Hosting deploy that makes Drive connect reachable', () => {
    const docs = readFileSync(join(process.cwd(), 'docs/google-drive-backup.md'), 'utf8');
    expect(docs).toContain('npx expo export -p web');
    expect(docs).toContain('deploy --prod --environment production');
    expect(docs).toContain('/api/backup/google/callback');
  });

  it('requires confirmation before replacing local data', () => {
    expect(screen).toContain('Restore This Backup?');
    expect(screen).toContain('AgentUiIds.backup.confirmRestore');
    expect(screen).toContain('restoreBackup(backup, { pushCloud: !isGuest })');
  });

  it('asks whether to overwrite the previous Drive backup or save a new copy', () => {
    expect(screen).toContain('listGoogleDriveBackups(session.accessToken, session.folderId)');
    expect(screen).toContain('isGoogleDriveAuthError');
    expect(screen).toContain('Save to Google Drive?');
    expect(screen).toContain('Overwrite Previous');
    expect(screen).toContain('Save as New');
    expect(screen).toContain('AgentUiIds.backup.saveOverwrite');
    expect(screen).toContain('AgentUiIds.backup.saveNew');
    expect(screen).toContain('saveBackupToDrive(session, previous.id)');
    expect(screen).toContain('fileId');
  });

  it('puts Drive status inside glass destinations instead of a floating Invalid Value line', () => {
    expect(panels).toContain('GlassIconWell');
    expect(panels).toContain('BackupStatusNotice');
    expect(panels).toContain("label={connected ? 'Connected' : 'Off'}");
    expect(panels).not.toContain("label={status.connected ? 'On' : 'Off'}");
    expect(screen).toContain('<BackupStatusNotice error={error} message={message} />');
  });
});

describe('backup time copy', () => {
  it('drops unreadable timestamps instead of showing Invalid Value', () => {
    expect(formatBackupTime(undefined)).toBeUndefined();
    expect(formatBackupTime('not-a-date')).toBeUndefined();
    const readable = formatBackupTime('2026-08-16T20:44:38.000Z');
    expect(readable).toBeTruthy();
    expect(readable).not.toMatch(/Invalid/i);
    expect(readable).not.toMatch(/:\d{2}:\d{2}/);
  });
});
