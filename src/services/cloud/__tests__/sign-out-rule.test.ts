import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('current-device sign-out invariants', () => {
  // Sign-out/delete flows live in the colocated exit module; the provider keeps
  // the session listener that reacts to an unexpected SIGNED_OUT.
  const provider = [
    readFileSync(join(process.cwd(), 'src/features/auth/auth-provider.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/features/auth/auth-account-exit.ts'), 'utf8'),
  ].join('\n');
  const account = readFileSync(join(process.cwd(), 'src/services/cloud/account.ts'), 'utf8');
  const sync = readFileSync(join(process.cwd(), 'src/services/cloud/sync.ts'), 'utf8');

  it('flushes before local-scope sign-out and supports an explicit forced discard', () => {
    expect(provider).toContain('if (!force)');
    expect(provider).toContain('await flushCloudSync()');
    expect(provider).toContain("status: 'sync-failed'");
    expect(account).toContain("signOut({ scope: 'local' })");
  });

  it('clears account-owned local data when the session expires unexpectedly', () => {
    expect(provider).toContain("event === 'SIGNED_OUT' && !explicitSignOutRef.current");
    expect(provider).toContain('void clearLocalAccountData()');
    expect(provider).toContain('useAuthAccess.getState().resetAccess()');
  });

  it('cleans every synced domain, nutrition memory, health, notifications, and app-owned media', () => {
    for (const domain of ['addons', 'agents', 'preferences', 'schedule', 'plants', 'travel', 'todos']) {
      expect(sync).toContain(`name: '${domain}'`);
    }
    expect(sync).toContain('useNutrition.getState().reset()');
    expect(sync).toContain('useHealth.getState().reset()');
    expect(sync).toContain('deletePlant(plant.id)');
    expect(sync).toContain("'plants'");
    expect(sync).toContain("'meal-images'");
  });

  it('does not delete cloud rows or system photo-library originals during sign-out cleanup', () => {
    const cleanup = sync.slice(sync.indexOf('export async function clearLocalAccountData'));
    expect(cleanup).not.toContain(".from('app_state').delete()");
    expect(cleanup).not.toContain('MediaLibrary');
  });

  it('preserves device first-run completion across local account wipe', () => {
    const cleanup = sync.slice(sync.indexOf('export async function clearLocalAccountData'));
    expect(cleanup).toContain('hadOnboarded');
    expect(cleanup).toContain('hasOnboarded: true');
  });

  it('preserves device-only preference fields when applying remote account state', () => {
    expect(sync).toContain("domain.name !== 'preferences'");
    expect(sync).toContain('homeLocation / avatar');
  });
});
