import { DEFAULT_NAV_PIN_ORDER } from '@/components/navigation/tab-pins';

import { useTabPins } from '../tab-pins';

describe('tab-pins store', () => {
  beforeEach(() => {
    useTabPins.setState({
      trackerOrder: [
        'profile',
        'calendar',
        '(today)',
        'to-do',
        'social',
        'travel',
      ],
      pinnedCount: 4,
    });
  });

  it('adds a tracker to nav when under the pin limit', () => {
    useTabPins.setState({
      trackerOrder: ['profile', 'calendar', 'social', 'travel'],
      pinnedCount: 2,
    });
    useTabPins.getState().addToNav('travel');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'profile',
      'calendar',
      'travel',
    ]);
  });

  it('removes from nav but keeps at least one pin', () => {
    useTabPins.getState().removeFromNav('profile');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'calendar',
      '(today)',
      'to-do',
    ]);
    useTabPins.setState({
      trackerOrder: ['calendar', 'social', 'travel'],
      pinnedCount: 1,
    });
    useTabPins.getState().removeFromNav('calendar');
    expect(useTabPins.getState().pinnedCount).toBe(1);
    expect(useTabPins.getState().trackerOrder[0]).toBe('calendar');
  });

  it('setInNavOrder writes the default pin set', () => {
    useTabPins.getState().setInNavOrder([...DEFAULT_NAV_PIN_ORDER], ['travel']);
    expect(useTabPins.getState().pinnedCount).toBe(4);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      ...DEFAULT_NAV_PIN_ORDER,
      'travel',
    ]);
  });
});
