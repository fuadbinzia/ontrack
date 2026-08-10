import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('bottom nav fixed slots', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/navigation/bottom-nav-bar.tsx'),
    'utf8',
  );

  it('renders pinned trackers plus More (no carousel remount path)', () => {
    expect(source).toContain('MORE_TAB_ROUTE');
    expect(source).toContain('splitTrackerOrder');
    expect(source).toContain("kind: 'more'");
    expect(source).not.toContain('orderRoutesByRecency');
    expect(source).not.toContain('recordTabFocus');
    expect(source).not.toContain('shortestTargetPosition');
    expect(source).not.toContain('withSpring');
  });

  it('selects More when the focused route is outside the bar pins', () => {
    expect(source).toContain('!focusedInBar');
    expect(source).toContain('TAB_META.trackers.href');
  });

  it('retapping More dismisses Trackers to the last pin', () => {
    expect(source).toContain('resolveMoreRetapTarget');
    expect(source).toContain('lastPinRouteRef');
  });

  it('preloads bar slots after settle and optimistically selects on tap', () => {
    expect(source).toContain('navigation.preload');
    expect(source).toContain('deferAfterPageLoad');
    expect(source).toContain('setPendingRouteName');
    expect(source).toContain('pendingRouteName');
  });
});
