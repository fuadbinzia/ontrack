import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSyncSources() {
  const root = join(process.cwd(), 'src/services/cloud');
  return [
    'sync.ts',
    'sync-domains.ts',
    'sync-session.ts',
    'sync-account.ts',
    'sync-local-reset.ts',
    'sync-refresh.ts',
    'sync-types.ts',
  ]
    .map((name) => readFileSync(join(root, name), 'utf8'))
    .join('\n');
}

describe('current-device sign-out invariants', () => {
  // Sign-out/delete flows live in the colocated exit module; the provider keeps
  // the session listener that reacts to an unexpected SIGNED_OUT.
  const provider = [
    readFileSync(join(process.cwd(), 'src/features/auth/auth-provider.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/features/auth/auth-provider-effects.ts'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/features/auth/auth-account-exit.ts'), 'utf8'),
  ].join('\n');
  const account = readFileSync(join(process.cwd(), 'src/services/cloud/account.ts'), 'utf8');
  const sync = readSyncSources();

  it('flushes before local-scope sign-out and supports an explicit forced discard', () => {
    expect(provider).toContain('if (!force)');
    expect(provider).toContain('await flushCloudSync()');
    expect(provider).toContain("status: 'sync-failed'");
    expect(account).toContain("signOut({ scope: 'local' })");
  });

  it('clears account-owned local data when the session expires unexpectedly', () => {
    expect(provider).toContain("event === 'SIGNED_OUT' && !explicitSignOutRef.current");
    expect(provider).toContain('scheduleDropLocalAccountState({');
    expect(provider).toContain('useAuthAccess.getState().resetAccess()');
  });

  it('cleans every persisted user domain, sensitive memory, and app-owned media', () => {
    for (const domain of ['addons', 'agents', 'preferences', 'schedule', 'plants', 'travel', 'todos']) {
      expect(sync).toContain(`name: '${domain}'`);
    }
    expect(sync).toContain('useNutrition.getState().reset()');
    expect(sync).toContain('useHealth.getState().reset()');
    for (const store of [
      'useFoodProfile',
      'usePantry',
      'useRecipes',
      'useMealPlan',
      'useTravelMap',
      'useTravelPlanUi',
      'useThemeOverrides',
      'useUsageAnalytics',
    ]) {
      expect(sync).toContain(`${store}.getState()`);
    }
    expect(sync).toContain('clearFlightConfirmationAIMemory()');
    expect(sync).toContain('removePersistedStorageItems([');
    expect(sync).toContain('deletePlant(plant.id)');
    for (const directory of [
      'plants',
      'meal-images',
      'recipe-images',
      'profile-avatars',
      'travel-confirmations',
      'travel-moments',
      'finance-docs',
    ]) {
      expect(sync).toContain(`'${directory}'`);
    }
  });

  it('does not delete cloud rows or system photo-library originals during sign-out cleanup', () => {
    const cleanup = readFileSync(
      join(process.cwd(), 'src/services/cloud/sync-local-reset.ts'),
      'utf8',
    );
    const clearFn = cleanup.slice(cleanup.indexOf('export async function clearLocalAccountData'));
    expect(clearFn).not.toContain(".from('app_state').delete()");
    expect(clearFn).not.toContain('MediaLibrary');
  });

  it('preserves device first-run completion across local account wipe', () => {
    const cleanup = readFileSync(
      join(process.cwd(), 'src/services/cloud/sync-local-reset.ts'),
      'utf8',
    );
    const clearFn = cleanup.slice(cleanup.indexOf('export async function clearLocalAccountData'));
    expect(clearFn).toContain('hadOnboarded');
    expect(clearFn).toContain('hasOnboarded: true');
  });

  it('syncs home/current locations in preferences and keeps avatar device-only', () => {
    expect(sync).toContain("domain.name !== 'preferences'");
    expect(sync).toContain('homeLocation: state.homeLocation');
    expect(sync).toContain('currentLocation: state.currentLocation');
    expect(sync).toContain('avatar stays device-only');
  });
});
