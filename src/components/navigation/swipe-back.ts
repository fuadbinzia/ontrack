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
}): boolean {
  if (!shouldWrapSwipeBackScene(input)) return false;
  if (!input.canDismiss && !input.canGoBack) return false;
  return !isSwipeBackBlockedPath(input.pathname);
}

export function shouldCommitSwipeBack(input: {
  translationX: number;
  velocityX: number;
  width: number;
}): boolean {
  if (input.translationX <= 0 || input.width <= 0) return false;
  return (
    input.translationX >= input.width * SWIPE_BACK_DISTANCE_RATIO ||
    input.velocityX >= SWIPE_BACK_VELOCITY_X
  );
}
