import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screen = readFileSync(
  join(process.cwd(), 'src/features/account/backup-screen.tsx'),
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
    expect(screen).toContain('AgentUiIds.backup.download');
    expect(screen).toContain('AgentUiIds.backup.connectDrive');
    expect(screen).toContain('AgentUiIds.backup.saveDrive');
    expect(screen).toContain('AgentUiIds.backup.restoreFile');
    expect(screen).toContain('AgentUiIds.backup.restoreDrive');
  });

  it('requires confirmation before replacing local data', () => {
    expect(screen).toContain('Restore This Backup?');
    expect(screen).toContain('AgentUiIds.backup.confirmRestore');
    expect(screen).toContain('restoreBackup(backup, { pushCloud: !isGuest })');
  });
});
