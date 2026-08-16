import { makeMutable, runOnJS, runOnUI, withSpring } from 'react-native-reanimated';

import { springs } from '@/design-system';

/** Shared pager offset — Instagram slides both pages 1:1 on the UI thread. */
export const tabSwipeX = makeMutable(0);

export type TabSwipeLane = 'current' | 'back' | 'forward' | 'idle';
export type TabTapSide = 'left' | 'right';

export const PAGER_SPRING = {
  damping: springs.stiff.damping,
  stiffness: springs.stiff.stiffness,
  mass: springs.stiff.mass,
  overshootClamping: true,
} as const;

export type TabSwipeLanes = {
  current: string | null;
  back: string | null;
  forward: string | null;
  tapFrom: string | null;
  tapLane: TabSwipeLane | null;
};

/**
 * UI-thread lane snapshot. Scenes derive their lane from this shared value
 * inside the animated style so a lane flip and a `tabSwipeX` offset land in
 * the same frame batch. Deriving lanes from React render state let the
 * leaving page paint one frame at translateX = ±width — a blank flash on
 * every tab tap.
 */
export const tabSwipeLanes = makeMutable<TabSwipeLanes>({
  current: null,
  back: null,
  forward: null,
  tapFrom: null,
  tapLane: null,
});

export function syncTabSwipeLanes(lanes: TabSwipeLanes) {
  tabSwipeLanes.value = lanes;
}

export function tabSwipeLane(
  tabName: string | null,
  current: string | null,
  back: string | null,
  forward: string | null,
  tapFrom?: string | null,
  tapLane?: TabSwipeLane | null,
  swipeX = 0,
): TabSwipeLane {
  'worklet';
  if (!tabName) return 'idle';
  if (
    tapFrom &&
    tabName === tapFrom &&
    (tapLane === 'back' || tapLane === 'forward')
  ) {
    return tapLane;
  }
  if (!current || tabName === current) return 'current';
  const isBack = tabName === back;
  const isForward = tabName === forward;
  // A → B → back-swipe leaves A both behind (history) and ahead (forward
  // stack) of B. One scene cannot park on both edges, so the live drag
  // direction picks the side about to be revealed: dragging left
  // (swipeX < 0) reveals the forward page from the right. Parking it only
  // by history order left the right side empty — a blank forward swipe.
  if (isBack && isForward) return swipeX < 0 ? 'forward' : 'back';
  if (isBack) return 'back';
  if (isForward) return 'forward';
  return 'idle';
}

export function tabSwipeTranslateX(
  lane: TabSwipeLane,
  swipeX: number,
  width: number,
): number {
  'worklet';
  if (lane === 'back') return swipeX - width;
  if (lane === 'forward') return swipeX + width;
  if (lane === 'current') return swipeX;
  // Park unused tabs off-screen. Fading idle to 0 pops the page when it
  // becomes current — Instagram only translates fully painted pages.
  return width;
}

/** Dest to the right enters from the right; dest to the left enters from the left. */
export function tabTapSide(
  fromIndex: number,
  toIndex: number,
): TabTapSide | null {
  if (toIndex < 0 || fromIndex === toIndex) return null;
  if (fromIndex < 0) return 'left';
  return toIndex > fromIndex ? 'right' : 'left';
}

export function tabTapStartX(side: TabTapSide, width: number): number {
  if (width <= 0) return 0;
  return side === 'right' ? width : -width;
}

export function tabTapLane(side: TabTapSide): 'back' | 'forward' {
  return side === 'right' ? 'back' : 'forward';
}

export function settleTabSwipeX(
  to: number,
  reduceMotion: boolean,
  onRest?: () => void,
) {
  if (reduceMotion) {
    tabSwipeX.value = to;
    onRest?.();
    return;
  }
  const done = onRest;
  runOnUI(() => {
    'worklet';
    tabSwipeX.value = withSpring(
      to,
      {
        damping: PAGER_SPRING.damping,
        stiffness: PAGER_SPRING.stiffness,
        mass: PAGER_SPRING.mass,
        overshootClamping: true,
      },
      () => {
        // Cancelled springs must still clear tap state or dest stays off-screen.
        if (done) runOnJS(done)();
      },
    );
  })();
}

export function resetTabSwipeX() {
  tabSwipeX.value = 0;
}
