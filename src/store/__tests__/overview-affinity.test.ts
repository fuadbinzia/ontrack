import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useOverviewAffinity } from '../overview-affinity';
import { useUsageAnalytics } from '../usage-analytics';

describe('overview affinity store', () => {
  beforeEach(() => {
    useOverviewAffinity.getState().reset();
    useUsageAnalytics.getState().resetLocal();
  });

  it('counts each open of a known module and ignores Overview', () => {
    const store = useOverviewAffinity.getState();
    store.recordVisit('travel', 1_000);
    store.recordVisit('travel', 2_000);
    store.recordVisit('overview', 3_000);
    store.recordVisit('not-a-tab', 4_000);

    expect(useOverviewAffinity.getState().byRoute).toEqual({
      travel: { visitCount: 2, lastVisitedAt: 2_000 },
    });
  });

  it('does not double-count a remount of the same module', () => {
    const store = useOverviewAffinity.getState();
    store.recordVisit('plants', 5_000);
    store.recordVisit('plants', 5_400);
    expect(useOverviewAffinity.getState().byRoute.plants).toEqual({
      visitCount: 1,
      lastVisitedAt: 5_000,
    });
  });

  it('seeds from local dwell only when the user has no opens yet', () => {
    const at = Date.now();
    useUsageAnalytics.getState().recordActiveMs('travel', 120_000, at);
    useUsageAnalytics.getState().recordActiveMs('today', 60_000, at);

    useOverviewAffinity.getState().seedFromUsageIfEmpty(at);
    expect(useOverviewAffinity.getState().byRoute.travel?.visitCount).toBe(2);
    expect(useOverviewAffinity.getState().byRoute['(today)']?.visitCount).toBe(1);

    useOverviewAffinity.getState().recordVisit('finance', at);
    useOverviewAffinity.getState().seedFromUsageIfEmpty(at + 1);
    expect(useOverviewAffinity.getState().byRoute.finance?.visitCount).toBe(1);
    expect(useOverviewAffinity.getState().byRoute.travel?.visitCount).toBe(2);
  });

  it('seeds before Overview paints so the row stack does not shuffle on open', () => {
    const store = readFileSync(
      join(process.cwd(), 'src/store/overview-affinity.ts'),
      'utf8',
    );
    const screen = readFileSync(
      join(process.cwd(), 'src/features/overview/overview-screen.tsx'),
      'utf8',
    );
    expect(store).toContain(
      'useOverviewAffinity.getState().seedFromUsageIfEmpty()',
    );
    expect(screen).not.toContain('seedFromUsageIfEmpty');
  });
});
