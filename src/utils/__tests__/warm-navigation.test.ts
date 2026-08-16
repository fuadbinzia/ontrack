import { router } from 'expo-router';

import { motion } from '@/design-system';
import {
  resetWarmNavigationForTests,
  WARM_HUB_HREF_CAP,
  warmHref,
  warmHrefsAfterTransition,
} from '@/utils/warm-navigation';

jest.mock('expo-router', () => ({
  router: {
    prefetch: jest.fn(),
  },
}));

describe('warm-navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetWarmNavigationForTests();
    jest.mocked(router.prefetch).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('caps hub warm-up so landing does not prefetch the whole app', () => {
    expect(WARM_HUB_HREF_CAP).toBe(6);
  });

  it('prefers each href only once per session', () => {
    expect(warmHref('/travel/trip-a' as never)).toBe(true);
    expect(warmHref('/travel/trip-a' as never)).toBe(false);
    expect(router.prefetch).toHaveBeenCalledTimes(1);
  });

  it('staggers prefetches after the page transition settle', () => {
    const cancel = warmHrefsAfterTransition(
      [
        { pathname: '/travel/[id]', params: { id: 'a' } },
        { pathname: '/travel/[id]', params: { id: 'b' } },
      ] as never,
      50,
    );

    expect(router.prefetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(motion.page);
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(50);
    expect(router.prefetch).toHaveBeenCalledTimes(2);
    cancel();
  });

  it('cancels pending staggered prefetches', () => {
    const cancel = warmHrefsAfterTransition(
      [
        { pathname: '/travel/[id]', params: { id: 'a' } },
        { pathname: '/travel/[id]', params: { id: 'b' } },
      ] as never,
      50,
    );
    cancel();
    jest.advanceTimersByTime(motion.page + 200);
    expect(router.prefetch).not.toHaveBeenCalled();
  });
});
