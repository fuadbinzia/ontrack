import {
  AUTH_COPY_TOP,
  AUTH_ORBIT_NODES,
  authCopyMaxHeightFrac,
  authLowSweepMinY,
} from '@/features/auth/auth-constellation-layout';

describe('auth constellation layout clearance', () => {
  it('keeps the low sweep below the copy clear-line', () => {
    const wellFrac = 0.115;
    const copyBottom = AUTH_COPY_TOP + authCopyMaxHeightFrac(wellFrac);
    const gamesTop = authLowSweepMinY() - wellFrac / 2;

    expect(copyBottom).toBeLessThan(gamesTop);
  });

  it('places Games on the low sweep (highest of that arc)', () => {
    const games = AUTH_ORBIT_NODES.find((node) => node.tab === 'games');
    expect(games?.y).toBe(authLowSweepMinY());
    expect(games?.y).toBeGreaterThanOrEqual(0.85);
  });
});
