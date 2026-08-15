import {
  canActivateSwipeBack,
  isSwipeBackBlockedPath,
  shouldCommitSwipeBack,
  shouldWrapSwipeBackScene,
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
});

describe('shouldCommitSwipeBack', () => {
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

  it('ignores leftward or empty motion', () => {
    expect(
      shouldCommitSwipeBack({ translationX: -40, velocityX: 1200, width }),
    ).toBe(false);
    expect(
      shouldCommitSwipeBack({ translationX: 200, velocityX: 1200, width: 0 }),
    ).toBe(false);
  });
});
