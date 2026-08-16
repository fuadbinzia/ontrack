import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  peekBottomNavDock,
  publishBottomNavDock,
  resetBottomNavDockForTests,
  subscribeBottomNavDock,
} from '../bottom-nav-dock';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('tab dock stays visible after tab scenes paint', () => {
  beforeEach(() => {
    resetBottomNavDockForTests();
  });

  it('publishes navigator props to the sibling host', () => {
    const seen: unknown[] = [];
    const stop = subscribeBottomNavDock(() => {
      seen.push(peekBottomNavDock());
    });
    const props = { state: { index: 0, routes: [] } } as never;
    publishBottomNavDock(props);
    expect(seen).toEqual([props]);
    expect(peekBottomNavDock()).toBe(props);
    publishBottomNavDock(null);
    expect(seen).toEqual([props, null]);
    stop();
  });

  it('does not notify when the same props object is published again', () => {
    let ticks = 0;
    const stop = subscribeBottomNavDock(() => {
      ticks += 1;
    });
    const props = { state: { index: 1 } } as never;
    publishBottomNavDock(props);
    publishBottomNavDock(props);
    expect(ticks).toBe(1);
    stop();
  });

  it('hosts the bar as a sibling of Tabs, not inside BottomTabView', () => {
    const layout = read('src/app/(tabs)/_layout.tsx');
    const dock = read('src/components/navigation/bottom-nav-dock.tsx');

    expect(layout).toContain('tabBar={(props) => <BottomNavBarBridge {...props} />}');
    expect(layout).toContain('<BottomNavDockHost />');
    expect(layout).toMatch(/<\/Tabs>\s*<BottomNavDockHost \/>/);
    expect(layout).not.toMatch(/tabBar=\{\(props\) => <BottomNavBar[\s{]/);
    expect(dock).toContain('return null');
    expect(dock).toContain('StyleSheet.absoluteFill');
    expect(dock).toContain('BOTTOM_NAV_Z_INDEX');
  });
});
