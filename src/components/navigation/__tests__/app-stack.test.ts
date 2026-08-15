import {
  ANDROID_SWIPE_BACK_ANIMATION,
  appStackScreenOptions,
  appStackSwipeAnimation,
  IOS_SWIPE_BACK_ANIMATION,
  mergeAppStackScreenOptions,
} from '../app-stack';

describe('mergeAppStackScreenOptions', () => {
  it('uses a custom swipe animation so iOS 26 does not fall back to Apple content-pop', () => {
    expect(appStackScreenOptions.fullScreenGestureEnabled).toBe(true);
    expect(appStackScreenOptions.animationMatchesGesture).toBe(true);
    expect(appStackScreenOptions.gestureEnabled).toBe(true);
    expect(IOS_SWIPE_BACK_ANIMATION).toBe('simple_push');
    expect(IOS_SWIPE_BACK_ANIMATION).not.toBe('default');
    expect(IOS_SWIPE_BACK_ANIMATION).not.toBe('ios_from_right');
    expect(ANDROID_SWIPE_BACK_ANIMATION).toBe('ios_from_right');
    expect(appStackSwipeAnimation).not.toBe('default');
    expect([IOS_SWIPE_BACK_ANIMATION, ANDROID_SWIPE_BACK_ANIMATION]).toContain(
      appStackScreenOptions.animation,
    );
    expect(appStackScreenOptions.animationDuration).toBeGreaterThan(0);
  });

  it('lets a screen override animation without dropping the swipe flags', () => {
    const merged = mergeAppStackScreenOptions({ animation: 'fade' });
    expect(merged).toMatchObject({
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
      gestureEnabled: true,
      animation: 'fade',
    });
  });

  it('merges function screenOptions onto the shared defaults', () => {
    const merged = mergeAppStackScreenOptions(() => ({ headerShown: true }));
    expect(typeof merged).toBe('function');
    if (typeof merged !== 'function') return;
    expect(merged({} as never)).toMatchObject({
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
      headerShown: true,
    });
  });
});
