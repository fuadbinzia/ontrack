import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  preloadTabLanes,
  resetTabLanePreloadForTests,
  schedulePreloadTabLanes,
  tabLanePreloadNames,
} from '../tab-lane-preload';
import {
  beginTabReturn,
  clearTabReturn,
  rememberFocusedTab,
  TAB_RETURN_SETTLE_MS,
} from '../overview-return';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

type DispatchedAction = { type: 'PRELOAD'; payload: { name: string } };

function makeNavigation(
  routes: Array<{ key: string; name: string }>,
  preloadedRouteKeys: string[] = [],
) {
  const dispatched: DispatchedAction[] = [];
  return {
    dispatched,
    dispatch: (action: DispatchedAction) => {
      dispatched.push(action);
    },
    getState: () => ({ routes, preloadedRouteKeys }),
  };
}

describe('right-to-left swipe reveals a mounted forward lane, not a blank page', () => {
  beforeEach(() => {
    clearTabReturn();
    resetTabLanePreloadForTests();
  });

  it('preloads the forward lane left behind by a back swipe', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    rememberFocusedTab('plants', '/(tabs)/plants');
    beginTabReturn();
    rememberFocusedTab('overview', '/(tabs)/overview');

    const navigation = makeNavigation([
      { key: 'overview-1', name: 'overview' },
      { key: 'plants-1', name: 'plants' },
    ]);
    preloadTabLanes(navigation);

    expect(navigation.dispatched).toEqual([
      { type: 'PRELOAD', payload: { name: 'plants' } },
    ]);
  });

  it('preloads both lanes and never the current tab', () => {
    expect(tabLanePreloadNames('to-do', 'overview', 'plants')).toEqual([
      'overview',
      'plants',
    ]);
    expect(tabLanePreloadNames('to-do', 'to-do', 'plants')).toEqual(['plants']);
    expect(tabLanePreloadNames('to-do', 'plants', 'plants')).toEqual(['plants']);
    expect(tabLanePreloadNames('to-do', null, null)).toEqual([]);
  });

  it('re-preloads a lane whose preloaded key was consumed by focus', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    rememberFocusedTab('plants', '/(tabs)/plants');

    const alreadyPreloaded = makeNavigation(
      [
        { key: 'overview-1', name: 'overview' },
        { key: 'plants-1', name: 'plants' },
      ],
      ['overview-1'],
    );
    preloadTabLanes(alreadyPreloaded);
    expect(alreadyPreloaded.dispatched).toEqual([]);

    const consumed = makeNavigation([
      { key: 'overview-1', name: 'overview' },
      { key: 'plants-1', name: 'plants' },
    ]);
    preloadTabLanes(consumed);
    expect(consumed.dispatched).toEqual([
      { type: 'PRELOAD', payload: { name: 'overview' } },
    ]);
  });

  it('skips lanes the navigator does not know', () => {
    rememberFocusedTab('overview', '/(tabs)/overview');
    rememberFocusedTab('plants', '/(tabs)/plants');

    const navigation = makeNavigation([{ key: 'plants-1', name: 'plants' }]);
    preloadTabLanes(navigation);
    expect(navigation.dispatched).toEqual([]);
  });

  it('defers past the pager settle and coalesces bursts', () => {
    jest.useFakeTimers();
    try {
      rememberFocusedTab('overview', '/(tabs)/overview');
      rememberFocusedTab('plants', '/(tabs)/plants');

      const navigation = makeNavigation([
        { key: 'overview-1', name: 'overview' },
        { key: 'plants-1', name: 'plants' },
      ]);
      schedulePreloadTabLanes(navigation);
      schedulePreloadTabLanes(navigation);
      expect(navigation.dispatched).toEqual([]);

      jest.advanceTimersByTime(TAB_RETURN_SETTLE_MS);
      expect(navigation.dispatched).toEqual([
        { type: 'PRELOAD', payload: { name: 'overview' } },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('wires lane preload into the tabs layout', () => {
    const tabs = read('src/app/(tabs)/_layout.tsx');
    expect(tabs).toContain('schedulePreloadTabLanes(navigation)');
    expect(tabs).toMatch(/screenListeners=\{\(\{ navigation \}\) => \(\{\s*state:/);
    // Bounded warmth only — never eager-preload the whole dock.
    expect(tabs).not.toContain('navigation.preload(');
  });
});

describe('vendor contract lane preload depends on', () => {
  it('bottom-tabs mounts preloaded lazy routes', () => {
    const view = read(
      'node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabView.js',
    );
    expect(view).toContain('!isPreloaded');
    expect(view).toContain('state.preloadedRouteKeys.includes(route.key)');
  });

  it('the tab router still handles PRELOAD actions', () => {
    const router = read(
      'node_modules/expo-router/build/react-navigation/routers/TabRouter.js',
    );
    expect(router).toContain("case 'PRELOAD':");
  });
});
