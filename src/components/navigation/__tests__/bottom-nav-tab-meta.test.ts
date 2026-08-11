import { isTrackerRouteEnabled } from '../bottom-nav-tab-meta';

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
});
