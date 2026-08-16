import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canActivateSwipeBack,
  canActivateSwipeForward,
  focusedStackCanPop,
  isSwipeBackBlockedPath,
  navigationCanGoBack,
  readRootNavigationState,
  OVERVIEW_RETURN_DRAG_RATIO,
  OVERVIEW_RETURN_MAX_SHIFT,
  overviewReturnCommitMs,
  overviewReturnDragProgress,
  overviewReturnOpacity,
  overviewReturnShiftX,
  shouldCommitSwipeBack,
  shouldCommitSwipeForward,
  shouldWrapSwipeBackScene,
  swipeBackFollowsScene,
  SWIPE_BACK_DISTANCE_RATIO,
  SWIPE_BACK_VELOCITY_X,
} from '../swipe-back';

describe('isSwipeBackBlockedPath', () => {
  it('blocks the travel map and vision-board canvas editors', () => {
    expect(isSwipeBackBlockedPath('/travel-map')).toBe(true);
    expect(isSwipeBackBlockedPath('/travel-map/')).toBe(true);
    expect(isSwipeBackBlockedPath('/vision-board/item-editor')).toBe(true);
    expect(isSwipeBackBlockedPath('/vision-board/category-editor')).toBe(true);
    expect(isSwipeBackBlockedPath('/vision-board/abc-123')).toBe(true);
  });

  it('allows list and tab roots that are not canvas surfaces', () => {
    expect(isSwipeBackBlockedPath('/vision-board')).toBe(false);
    expect(isSwipeBackBlockedPath('/vision-board/all')).toBe(false);
    expect(isSwipeBackBlockedPath('/vision-board/categories')).toBe(false);
    expect(isSwipeBackBlockedPath('/to-do/list-1')).toBe(false);
    expect(isSwipeBackBlockedPath('/travel/plan-1')).toBe(false);
  });
});

describe('shouldWrapSwipeBackScene', () => {
  it('skips screens that disable the native gesture', () => {
    expect(shouldWrapSwipeBackScene({ gestureEnabled: false })).toBe(false);
  });

  it('skips modal presentations that own their own dismiss gesture', () => {
    expect(shouldWrapSwipeBackScene({ presentation: 'modal' })).toBe(false);
    expect(shouldWrapSwipeBackScene({ presentation: 'transparentModal' })).toBe(
      false,
    );
    expect(shouldWrapSwipeBackScene({ presentation: 'fullScreenModal' })).toBe(
      false,
    );
  });

  it('wraps ordinary pushed cards', () => {
    expect(shouldWrapSwipeBackScene({})).toBe(true);
    expect(shouldWrapSwipeBackScene({ gestureEnabled: true })).toBe(true);
  });
});

describe('canActivateSwipeBack', () => {
  const open = {
    pathname: '/to-do/list-1',
    canDismiss: false,
    canGoBack: true,
  };

  it('activates when this stack can pop', () => {
    expect(canActivateSwipeBack(open)).toBe(true);
  });

  it('activates when a sheet can dismiss', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/to-do/list-1',
        canDismiss: true,
        canGoBack: false,
      }),
    ).toBe(true);
  });

  it('stays idle on an empty stack', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/to-do',
        canDismiss: false,
        canGoBack: false,
      }),
    ).toBe(false);
  });

  it('stays idle when the screen disables gestures', () => {
    expect(canActivateSwipeBack({ ...open, gestureEnabled: false })).toBe(false);
  });

  it('stays idle on blocked canvas routes even when the stack can pop', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/travel-map',
        canDismiss: false,
        canGoBack: true,
      }),
    ).toBe(false);
  });

  it('returns to the previous tab from a tab root', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/',
        canDismiss: false,
        canGoBack: false,
        hasTabReturn: true,
        intent: 'overview-return',
      }),
    ).toBe(true);
  });

  it('does not steal a nested pop for the tab return gesture', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/to-do/list-1',
        canDismiss: false,
        canGoBack: true,
        hasTabReturn: true,
        intent: 'overview-return',
      }),
    ).toBe(false);
  });

  it('can swipe off Overview when a previous tab is waiting', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/overview',
        canDismiss: false,
        canGoBack: false,
        hasTabReturn: true,
        intent: 'overview-return',
      }),
    ).toBe(true);
  });

  it('goes forward from a tab root after a swipe-back', () => {
    expect(
      canActivateSwipeForward({
        pathname: '/overview',
        canDismiss: false,
        canGoBack: false,
        hasTabForward: true,
        intent: 'overview-return',
      }),
    ).toBe(true);
  });

  it('does not steal a nested pop for the tab forward gesture', () => {
    expect(
      canActivateSwipeForward({
        pathname: '/to-do/list-1',
        canDismiss: false,
        canGoBack: true,
        hasTabForward: true,
        intent: 'overview-return',
      }),
    ).toBe(false);
  });

  it('stays idle on a tab root with no previous page', () => {
    expect(
      canActivateSwipeBack({
        pathname: '/',
        canDismiss: false,
        canGoBack: false,
        hasTabReturn: false,
        intent: 'overview-return',
      }),
    ).toBe(false);
  });
});

describe('readRootNavigationState', () => {
  it('does not throw when the navigator has no getRootState', () => {
    expect(readRootNavigationState({})).toBeUndefined();
    expect(readRootNavigationState({ getRootState: undefined })).toBeUndefined();
  });

  it('reads the root state when the helper exists', () => {
    const state = { type: 'stack', index: 0, routes: [] };
    expect(readRootNavigationState({ getRootState: () => state })).toBe(state);
  });
});

describe('navigationCanGoBack', () => {
  it('stays false when canGoBack is missing', () => {
    expect(navigationCanGoBack({})).toBe(false);
  });
});

describe('focusedStackCanPop', () => {
  it('ignores tab switches that Expo Router still counts as canGoBack', () => {
    expect(
      focusedStackCanPop({
        type: 'stack',
        index: 0,
        routes: [
          {
            state: {
              type: 'tab',
              index: 1,
              routes: [
                { name: 'overview' },
                {
                  name: '(today)',
                  state: { type: 'stack', index: 0, routes: [{ name: 'index' }] },
                },
              ],
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it('detects a nested stack that can pop', () => {
    expect(
      focusedStackCanPop({
        type: 'tab',
        index: 0,
        routes: [
          {
            state: {
              type: 'stack',
              index: 1,
              routes: [{ name: 'index' }, { name: 'detail' }],
            },
          },
        ],
      }),
    ).toBe(true);
  });
});

describe('swipeBackFollowsScene', () => {
  it('does not slide a tab away from Overview over empty atmosphere', () => {
    expect(swipeBackFollowsScene('overview-return')).toBe(false);
    expect(swipeBackFollowsScene('stack')).toBe(true);
  });
});

describe('overviewReturnDragProgress', () => {
  const width = 400;
  const full = width * OVERVIEW_RETURN_DRAG_RATIO;

  it('maps a right-drag onto a 0–1 dissolve', () => {
    expect(overviewReturnDragProgress(0, width)).toBe(0);
    expect(overviewReturnDragProgress(full / 2, width)).toBeCloseTo(0.5);
    expect(overviewReturnDragProgress(full, width)).toBe(1);
    expect(overviewReturnDragProgress(full + 80, width)).toBe(1);
  });

  it('treats leftward travel as forward dissolve progress', () => {
    expect(overviewReturnDragProgress(-full / 2, width)).toBeCloseTo(0.5);
    expect(overviewReturnDragProgress(80, 0)).toBe(0);
  });
});

describe('overviewReturn scene', () => {
  it('eases opacity and a short shift instead of sliding off-screen', () => {
    expect(overviewReturnOpacity(0)).toBe(1);
    expect(overviewReturnOpacity(1)).toBe(0);
    expect(overviewReturnShiftX(0)).toBe(0);
    expect(overviewReturnShiftX(1)).toBe(OVERVIEW_RETURN_MAX_SHIFT);
  });

  it('finishes the dissolve before navigating back to Overview', () => {
    const source = readFileSync(join(__dirname, '../swipe-back-scene.tsx'), 'utf8');
    expect(source).toMatch(/easings\.standard/);
    expect(source).toMatch(/OVERVIEW_RETURN_DRAG_RATIO/);
    expect(source).not.toMatch(/consumeOpenedFromOverview/);
  });

  it('keeps the tab wrapper mounted so opening a route sheet does not remount Today', () => {
    const source = readFileSync(join(__dirname, '../swipe-back-scene.tsx'), 'utf8');
    expect(source).not.toMatch(
      /if \(intent === 'overview-return' && !enabled\)/,
    );
    expect(source).toContain('GestureDetector');
  });

  it('clears dissolve progress on focus so repeated swipes cannot leave a tab faded', () => {
    const source = readFileSync(join(__dirname, '../swipe-back-scene.tsx'), 'utf8');
    expect(source).toMatch(/useFocusEffect\([\s\S]*translateX\.value = 0/);
    expect(source).toMatch(/if \(!enabled\) translateX\.value = 0/);
    expect(source).not.toMatch(/return \(\) => \{\s*translateX\.value = 0/);
  });

  it('shortens the commit dissolve on a fast flick', () => {
    expect(overviewReturnCommitMs(0)).toBeGreaterThan(overviewReturnCommitMs(2000));
    expect(overviewReturnCommitMs(SWIPE_BACK_VELOCITY_X)).toBeLessThan(
      overviewReturnCommitMs(0),
    );
  });
});

describe('shouldCommitSwipeBack', () => {
  it('is a worklet so the UI-thread pan can call it', () => {
    const source = readFileSync(join(__dirname, '../swipe-back.ts'), 'utf8');
    expect(source).toMatch(/function shouldCommitSwipeBack[\s\S]*?'worklet';/);
  });

  const width = 400;
  const distance = width * SWIPE_BACK_DISTANCE_RATIO;

  it('cancels a short slow drag', () => {
    expect(
      shouldCommitSwipeBack({
        translationX: distance - 1,
        velocityX: SWIPE_BACK_VELOCITY_X - 1,
        width,
      }),
    ).toBe(false);
  });

  it('commits once the page has moved far enough', () => {
    expect(
      shouldCommitSwipeBack({
        translationX: distance,
        velocityX: 0,
        width,
      }),
    ).toBe(true);
  });

  it('commits a fast flick before the distance threshold', () => {
    expect(
      shouldCommitSwipeBack({
        translationX: 20,
        velocityX: SWIPE_BACK_VELOCITY_X,
        width,
      }),
    ).toBe(true);
  });

  it('commits a leftward flick as forward', () => {
    expect(
      shouldCommitSwipeForward({
        translationX: -distance,
        velocityX: 0,
        width,
      }),
    ).toBe(true);
    expect(
      shouldCommitSwipeForward({
        translationX: -20,
        velocityX: -SWIPE_BACK_VELOCITY_X,
        width,
      }),
    ).toBe(true);
    expect(
      shouldCommitSwipeForward({
        translationX: 40,
        velocityX: -1200,
        width,
      }),
    ).toBe(false);
  });

  it('ignores leftward or empty motion', () => {
    expect(
      shouldCommitSwipeBack({ translationX: -40, velocityX: 1200, width }),
    ).toBe(false);
    expect(
      shouldCommitSwipeBack({ translationX: 200, velocityX: 1200, width: 0 }),
    ).toBe(false);
  });
});
