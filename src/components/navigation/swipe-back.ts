import { durations } from '@/design-system';

export const SWIPE_BACK_DISTANCE_RATIO = 0.28;
export const SWIPE_BACK_VELOCITY_X = 800;

const VISION_BOARD_LIST_SLUGS = new Set(['all', 'categories']);

export function isSwipeBackBlockedPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
  if (path === '/travel-map' || path.startsWith('/travel-map/')) return true;
  if (path === '/vision-board/item-editor' || path.startsWith('/vision-board/item-editor/')) {
    return true;
  }
  if (
    path === '/vision-board/category-editor' ||
    path.startsWith('/vision-board/category-editor/')
  ) {
    return true;
  }
  if (path.startsWith('/vision-board/')) {
    const slug = path.slice('/vision-board/'.length).split('/')[0];
    return Boolean(slug && !VISION_BOARD_LIST_SLUGS.has(slug));
  }
  return false;
}

export function shouldWrapSwipeBackScene(options: {
  gestureEnabled?: boolean;
  presentation?: string;
}): boolean {
  if (options.gestureEnabled === false) return false;
  const presentation = options.presentation;
  return (
    presentation !== 'modal' &&
    presentation !== 'transparentModal' &&
    presentation !== 'fullScreenModal' &&
    presentation !== 'formSheet' &&
    presentation !== 'containedModal'
  );
}

export function canActivateSwipeBack(input: {
  gestureEnabled?: boolean;
  presentation?: string;
  pathname: string;
  canDismiss: boolean;
  canGoBack: boolean;
  hasTabReturn?: boolean;
  intent?: 'stack' | 'overview-return';
}): boolean {
  if (!shouldWrapSwipeBackScene(input)) return false;
  if (isSwipeBackBlockedPath(input.pathname)) return false;
  if (input.intent === 'overview-return') {
    return Boolean(input.hasTabReturn && !input.canDismiss && !input.canGoBack);
  }
  return input.canDismiss || input.canGoBack;
}

export function canActivateSwipeForward(input: {
  gestureEnabled?: boolean;
  presentation?: string;
  pathname: string;
  canDismiss: boolean;
  canGoBack: boolean;
  hasTabForward?: boolean;
  intent?: 'stack' | 'overview-return';
}): boolean {
  if (!shouldWrapSwipeBackScene(input)) return false;
  if (isSwipeBackBlockedPath(input.pathname)) return false;
  if (input.intent !== 'overview-return') return false;
  return Boolean(input.hasTabForward && !input.canDismiss && !input.canGoBack);
}

export function readRootNavigationState(navigation: {
  getRootState?: () => unknown;
}): unknown {
  return typeof navigation.getRootState === 'function'
    ? navigation.getRootState()
    : undefined;
}

export function navigationCanGoBack(navigation: {
  canGoBack?: () => boolean;
}): boolean {
  return typeof navigation.canGoBack === 'function' ? navigation.canGoBack() : false;
}

let latestFocusedStackCanPop = false;

export function rememberFocusedStackCanPop(value: boolean) {
  latestFocusedStackCanPop = value;
}

export function getFocusedStackCanPop() {
  return latestFocusedStackCanPop;
}

/** True when the focused leaf lives on a stack that can pop (not tab history). */
export function focusedStackCanPop(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  const nav = state as {
    type?: string;
    index?: number;
    routes?: Array<{ state?: unknown }>;
  };
  const route = nav.routes?.[nav.index ?? 0];
  if (route?.state) return focusedStackCanPop(route.state);
  return nav.type === 'stack' && (nav.index ?? 0) > 0;
}

/** Tab-to-Overview dissolves in place — do not slide the scene off-screen. */
export function swipeBackFollowsScene(
  intent?: 'stack' | 'overview-return',
): boolean {
  'worklet';
  return intent !== 'overview-return';
}

/** Finger travel that maps to a full tab-return dissolve. */
export const OVERVIEW_RETURN_DRAG_RATIO = 0.5;
export const OVERVIEW_RETURN_MAX_SHIFT = 72;

export function overviewReturnDragProgress(
  translationX: number,
  width: number,
): number {
  'worklet';
  if (width <= 0) return 0;
  const progress = Math.abs(translationX) / (width * OVERVIEW_RETURN_DRAG_RATIO);
  return Math.min(1, Math.max(0, progress));
}

export function overviewReturnShiftX(progress: number): number {
  'worklet';
  return progress * OVERVIEW_RETURN_MAX_SHIFT;
}

export function overviewReturnOpacity(progress: number): number {
  'worklet';
  return 1 - progress;
}

export function overviewReturnCommitMs(velocityX: number): number {
  'worklet';
  const speed = Math.abs(velocityX);
  if (speed >= 1600) return durations.fast;
  if (speed >= SWIPE_BACK_VELOCITY_X) return 200;
  return durations.base;
}

export function shouldCommitSwipeBack(input: {
  translationX: number;
  velocityX: number;
  width: number;
}): boolean {
  'worklet';
  if (input.translationX <= 0 || input.width <= 0) return false;
  return (
    input.translationX >= input.width * SWIPE_BACK_DISTANCE_RATIO ||
    input.velocityX >= SWIPE_BACK_VELOCITY_X
  );
}

export function shouldCommitSwipeForward(input: {
  translationX: number;
  velocityX: number;
  width: number;
}): boolean {
  'worklet';
  if (input.translationX >= 0 || input.width <= 0) return false;
  return (
    -input.translationX >= input.width * SWIPE_BACK_DISTANCE_RATIO ||
    -input.velocityX >= SWIPE_BACK_VELOCITY_X
  );
}
