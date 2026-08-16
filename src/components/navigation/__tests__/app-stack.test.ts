import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANDROID_SWIPE_BACK_ANIMATION,
  appStackScreenOptions,
  appStackSwipeAnimation,
  IOS_SWIPE_BACK_ANIMATION,
  isAppStackTabRoot,
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
    expect(appStackScreenOptions.scrollEdgeEffects).toEqual({
      top: 'hidden',
      bottom: 'hidden',
      left: 'hidden',
      right: 'hidden',
    });
  });

  it('lets a screen override animation without dropping the swipe flags', () => {
    const merged = mergeAppStackScreenOptions({ animation: 'fade' });
    expect(merged).toMatchObject({
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
      gestureEnabled: true,
      animation: 'fade',
      scrollEdgeEffects: {
        top: 'hidden',
        bottom: 'hidden',
        left: 'hidden',
        right: 'hidden',
      },
    });
  });

  it('keeps tab-root remounts from replaying simple_push', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/navigation/app-stack.tsx'),
      'utf8',
    );
    expect(source).toContain('isAppStackTabRoot');
    expect(source).toContain("animation: 'none'");
  });

  it('keeps the tab hub at rest and still animates pushed screens', () => {
    expect(isAppStackTabRoot('index')).toBe(true);
    expect(isAppStackTabRoot('appearance')).toBe(false);
    expect(isAppStackTabRoot('[id]')).toBe(false);
  });

  it('merges function screenOptions onto the shared defaults', () => {
    const merged = mergeAppStackScreenOptions(() => ({ headerShown: true }));
    expect(typeof merged).toBe('function');
    if (typeof merged !== 'function') return;
    expect(merged({} as never)).toMatchObject({
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
      headerShown: true,
      scrollEdgeEffects: {
        top: 'hidden',
        bottom: 'hidden',
        left: 'hidden',
        right: 'hidden',
      },
    });
  });
});
