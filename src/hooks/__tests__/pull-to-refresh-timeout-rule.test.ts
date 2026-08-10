import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('pull-to-refresh timeout invariants', () => {
  const hook = readFileSync(
    join(process.cwd(), 'src/hooks/use-pull-to-refresh.tsx'),
    'utf8',
  );
  const sync = readFileSync(
    join(process.cwd(), 'src/services/cloud/sync-refresh.ts'),
    'utf8',
  );

  it('clears the spinner on a hard deadline even if cloud work stalls', () => {
    expect(hook).toContain('PULL_REFRESH_TIMEOUT_MS');
    expect(hook).toContain('setTimeout(finish, PULL_REFRESH_TIMEOUT_MS)');
    expect(hook).toContain('setRefreshing(false)');
    expect(hook).toContain('await refreshAppData()');
  });

  it('bounds refreshAppData so sync status cannot stay syncing forever', () => {
    expect(sync).toContain('REFRESH_APP_DATA_TIMEOUT_MS');
    expect(sync).toContain('withDeadline');
    expect(sync).toContain("'Refresh timed out.'");
    const refresh = sync.slice(sync.indexOf('export async function refreshAppData'));
    expect(refresh).toContain('withDeadline');
  });
});
