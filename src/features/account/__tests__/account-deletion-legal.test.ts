import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    ONTRACK_SUPPORT_EMAIL,
    PRIVACY_POLICY_URL,
    TERMS_OF_USE_URL,
} from '@/constants/legal';

describe('account deletion and legal release gates', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/202608030001_delete_own_account.sql'),
    'utf8',
  );
  const account = readFileSync(join(process.cwd(), 'src/services/cloud/account.ts'), 'utf8');
  // Deletion lives in the colocated exit flows the provider delegates to.
  const provider = [
    readFileSync(join(process.cwd(), 'src/features/auth/auth-provider.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/features/auth/auth-account-exit.ts'), 'utf8'),
  ].join('\n');
  const card = readFileSync(
    join(process.cwd(), 'src/features/account/cloud-account-card.tsx'),
    'utf8',
  );
  const profile = readFileSync(join(process.cwd(), 'src/app/(tabs)/profile/index.tsx'), 'utf8');

  it('exposes a security-definer RPC that deletes storage and auth.users for the caller', () => {
    expect(migration).toContain('create or replace function public.delete_own_account()');
    expect(migration).toContain('security definer');
    expect(migration).toContain('delete from auth.users where id = uid');
    expect(migration).toContain('grant execute on function public.delete_own_account() to authenticated');
  });

  it('wires client deletion through auth session and profile UI', () => {
    expect(account).toContain("rpc('delete_own_account')");
    expect(account).toContain('signOutLocalSession');
    expect(provider).toContain('deleteOwnCloudAccount');
    expect(provider).toContain('deleteAccount');
    expect(profile).toContain('Delete Account');
    expect(profile).toContain('handleDeleteAccount');
    expect(profile).toContain('AgentUiIds.profile.deleteAccount');
    expect(card).not.toContain('AgentUiIds.profile.deleteAccount');
  });

  it('ships privacy and terms surfaces without tester or TestFlight copy', () => {
    expect(PRIVACY_POLICY_URL).toMatch(/\/privacy$/);
    expect(TERMS_OF_USE_URL).toMatch(/\/terms$/);
    expect(ONTRACK_SUPPORT_EMAIL).toContain('@');
    expect(profile).toContain("router.push('/privacy'");
    expect(profile).toContain("router.push('/terms'");
    expect(profile).not.toContain('Testers have access');
    expect(profile).not.toContain('release gates');
  });

  it('sends Privacy / Terms header back to Profile', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'src/app', '_layout.tsx'),
      'utf8',
    );
    expect(rootLayout).toContain('legalDocumentScreenOptions');
    expect(rootLayout).toContain('fallback="/(tabs)/profile"');
  });
});
