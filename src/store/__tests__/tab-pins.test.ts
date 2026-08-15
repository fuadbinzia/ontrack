import { DEFAULT_NAV_PIN_ORDER } from '@/components/navigation/tab-pins';

import { useTabPins } from '../tab-pins';

describe('tab-pins store', () => {
  beforeEach(() => {
    useTabPins.setState({
      trackerOrder: [
        'overview',
        '(today)',
        'calendar',
        'to-do',
        'profile',
        'social',
        'travel',
      ],
      pinnedCount: 4,
    });
  });

  it('adds a tracker to nav when under the pin limit', () => {
    useTabPins.setState({
      trackerOrder: ['overview', 'calendar', 'social', 'travel'],
      pinnedCount: 2,
    });
    useTabPins.getState().addToNav('travel');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'overview',
      'calendar',
      'travel',
    ]);
  });

  it('removes from nav but keeps at least one pin', () => {
    useTabPins.getState().removeFromNav('(today)');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'overview',
      'calendar',
      'to-do',
    ]);
    useTabPins.setState({
      trackerOrder: ['overview', 'social', 'travel'],
      pinnedCount: 1,
    });
    useTabPins.getState().removeFromNav('overview');
    expect(useTabPins.getState().pinnedCount).toBe(1);
    expect(useTabPins.getState().trackerOrder[0]).toBe('overview');
  });

  it('setInNavOrder writes the default pin set', () => {
    useTabPins.getState().setInNavOrder([...DEFAULT_NAV_PIN_ORDER], ['travel']);
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 4)).toEqual([
      ...DEFAULT_NAV_PIN_ORDER,
      'travel',
    ]);
  });

  it('promoteInMore moves a More row to the top of More', () => {
    useTabPins.getState().promoteInMore('travel');
    expect(useTabPins.getState().pinnedCount).toBe(4);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      'overview',
      '(today)',
      'calendar',
      'to-do',
      'travel',
    ]);
    useTabPins.getState().promoteInMore('profile');
    expect(useTabPins.getState().trackerOrder.slice(0, 4)).toEqual([
      'overview',
      '(today)',
      'calendar',
      'to-do',
    ]);
  });
});
