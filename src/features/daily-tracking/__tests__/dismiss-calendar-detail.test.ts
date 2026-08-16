import { dismissCalendarDetail } from '@/features/daily-tracking/dismiss-calendar-detail';

function navigationWith(index: number) {
  return {
    getState: jest.fn(() => ({ index, key: 'today-stack' })),
    dispatch: jest.fn(),
  };
}

describe('dismissCalendarDetail', () => {
  it('pops the Today stack when a detail sheet is stacked over the day', () => {
    const navigation = navigationWith(1);
    const router = { dismissTo: jest.fn() };

    dismissCalendarDetail(navigation, router);

    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'POP_TO_TOP',
      target: 'today-stack',
    });
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('returns a stale direct detail link to Today instead of leaving a not-found sheet', () => {
    const navigation = navigationWith(0);
    const router = { dismissTo: jest.fn() };

    dismissCalendarDetail(navigation, router);

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('returns to Today when the navigator has no stack state', () => {
    const navigation = {
      getState: jest.fn(() => undefined),
      dispatch: jest.fn(),
    };
    const router = { dismissTo: jest.fn() };

    dismissCalendarDetail(navigation, router);

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });
});
