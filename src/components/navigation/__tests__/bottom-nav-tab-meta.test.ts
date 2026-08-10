import {
  eagerBottomNavRouteNames,
  isTrackerRouteEnabled,
} from '../bottom-nav-tab-meta';
import {
  DEFAULT_TRACKER_ORDER,
  MORE_TAB_ROUTE,
  NAV_PIN_LIMIT,
} from '../tab-pins';

describe('bottom-nav-tab-meta eager routes', () => {
  const addonsOff = {
    fitness: false,
    plants: false,
    travel: false,
    'vision-board': false,
    games: false,
    vehicles: false,
    food: false,
    health: false,
  };

  it('treats core catalog routes as enabled without addons', () => {
    expect(isTrackerRouteEnabled('profile', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('calendar', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('(today)', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('to-do', addonsOff)).toBe(true);
    expect(isTrackerRouteEnabled('travel', addonsOff)).toBe(false);
  });

  it('eager-mounts current bar pins plus More only', () => {
    const eager = eagerBottomNavRouteNames(
      DEFAULT_TRACKER_ORDER,
      NAV_PIN_LIMIT,
      addonsOff,
    );
    expect([...eager].sort()).toEqual(
      ['(today)', 'calendar', 'profile', 'to-do', MORE_TAB_ROUTE].sort(),
    );
    expect(eager.has('travel')).toBe(false);
    expect(eager.has('social')).toBe(false);
  });
});
