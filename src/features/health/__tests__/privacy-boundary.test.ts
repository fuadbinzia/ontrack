import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('health privacy boundary', () => {
  it('does not register health as a cloud-sync domain', () => {
    const domains = readFileSync(
      join(process.cwd(), 'src/services/cloud/sync-domains.ts'),
      'utf8',
    );
    expect(domains).not.toContain("name: 'health'");
    // Local wipe may reset Health on sign-out, but it must never be a sync domain.
    expect(domains).not.toContain('useHealth');
  });

  it('adds only the health entitlement, not a health app-state domain', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/202608040002_health_addon_entitlement.sql'), 'utf8');
    expect(migration).toContain("'health'");
    expect(migration).not.toContain('app_state_domain_check');
    expect(migration).not.toContain('create table');
  });
});
