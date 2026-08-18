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
      pinnedCount: 5,
    });
  });

  it('adds a tracker to nav and snaps from three pins to five', () => {
    useTabPins.setState({
      trackerOrder: ['overview', 'calendar', 'social', 'travel', 'profile'],
      pinnedCount: 3,
    });
    useTabPins.getState().addToNav('travel');
    expect(useTabPins.getState().pinnedCount).toBe(5);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      'overview',
      'calendar',
      'social',
      'travel',
      'profile',
    ]);
  });

  it('does not add past five pins', () => {
    const before = useTabPins.getState().trackerOrder.slice(0, 5);
    useTabPins.getState().addToNav('travel');
    expect(useTabPins.getState().pinnedCount).toBe(5);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual(before);
  });

  it('removes from nav and snaps from five pins to three', () => {
    useTabPins.getState().removeFromNav('(today)');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'overview',
      'calendar',
      'to-do',
    ]);
    expect(useTabPins.getState().trackerOrder.slice(3, 6)).toEqual([
      '(today)',
      'profile',
      'social',
    ]);
  });

  it('does not remove below three pins', () => {
    useTabPins.setState({
      trackerOrder: ['overview', 'social', 'travel', 'calendar', 'profile'],
      pinnedCount: 3,
    });
    useTabPins.getState().removeFromNav('overview');
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      'overview',
      'social',
      'travel',
    ]);
  });

  it('setInNavOrder of three names stays at three pins', () => {
    useTabPins.getState().setInNavOrder(
      [...DEFAULT_NAV_PIN_ORDER],
      ['travel', 'profile'],
    );
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 3)).toEqual([
      ...DEFAULT_NAV_PIN_ORDER,
    ]);
  });

  it('setInNavOrder of four names snaps to five pins', () => {
    useTabPins.getState().setInNavOrder(
      [...DEFAULT_NAV_PIN_ORDER, 'overview'],
      ['travel', 'profile'],
    );
    expect(useTabPins.getState().pinnedCount).toBe(5);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      ...DEFAULT_NAV_PIN_ORDER,
      'overview',
      'travel',
    ]);
  });

  it('setInNavOrder of two names snaps up to three pins', () => {
    useTabPins.getState().setInNavOrder(
      ['overview', '(today)'],
      ['calendar', 'travel', 'profile'],
    );
    expect(useTabPins.getState().pinnedCount).toBe(3);
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      'overview',
      '(today)',
      'calendar',
      'travel',
      'profile',
    ]);
  });

  it('persist merge snaps stored 4 to 5 and 2 to 3', () => {
    const order = [
      'overview',
      '(today)',
      'calendar',
      'to-do',
      'travel',
      'profile',
    ];
    useTabPins.getState().setTrackerOrder(order, 4);
    expect(useTabPins.getState().pinnedCount).toBe(5);
    useTabPins.getState().setTrackerOrder(order, 2);
    expect(useTabPins.getState().pinnedCount).toBe(3);
    useTabPins.getState().setTrackerOrder(order, 1);
    expect(useTabPins.getState().pinnedCount).toBe(3);
  });

  it('promoteInMore moves a More row to the top of More', () => {
    useTabPins.getState().promoteInMore('travel');
    expect(useTabPins.getState().pinnedCount).toBe(5);
    expect(useTabPins.getState().trackerOrder.slice(0, 6)).toEqual([
      'overview',
      '(today)',
      'calendar',
      'to-do',
      'profile',
      'travel',
    ]);
    useTabPins.getState().promoteInMore('social');
    expect(useTabPins.getState().trackerOrder.slice(0, 5)).toEqual([
      'overview',
      '(today)',
      'calendar',
      'to-do',
      'profile',
    ]);
  });
});
