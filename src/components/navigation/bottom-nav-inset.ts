import { Platform } from 'react-native';

import { layout, spacing } from '@/design-system';

/**
 * Above tab pager scenes. Those views always apply `translateX` (even at rest),
 * which creates a stacking context that paints over an un-zIndexed absolute dock.
 */
export const BOTTOM_NAV_Z_INDEX = 50;

/** True when a transformed pager scene would hide a dock with no stacking order. */
export function pagerSceneCoversDock(
  sceneHasTransform: boolean,
  dockZIndex: number,
): boolean {
  return sceneHasTransform && dockZIndex <= 0;
}

/**
 * Bottom padding for the app tab dock.
 *
 * - Android with a system/gesture nav inset: lift the dock above it.
 * - iOS home indicator: small pad only (bar already sits on the physical bottom).
 * - No bottom inset: compact spacing.
 */
export function bottomNavBottomPad(
  insetsBottom: number,
  spacingSm: number,
  platform: typeof Platform.OS = Platform.OS,
): number {
  if (platform === 'android' && insetsBottom > 0) {
    return insetsBottom;
  }
  return insetsBottom > 0 ? 6 : spacingSm;
}

/**
 * Scroll/content bottom inset so the last row clears the tab dock with air
 * above the glass bar (never flush against the nav).
 * Matches dock height: `bottomNavBarBaseHeight + bottomNavBottomPad + gap`.
 * (Do not use the legacy `layout.tabBarInset` 44 — it undershoots the 58pt bar
 * and lets glass dock frost reveal section titles like Profile "Features".)
 */
export function bottomNavContentInset(
  insetsBottom: number,
  spacingSm: number,
  platform: typeof Platform.OS = Platform.OS,
  barBaseHeight: number = layout.bottomNavBarBaseHeight,
  /** Breathing room between last content and the top of the tab dock. */
  contentGap: number = spacing.md,
): number {
  return (
    barBaseHeight +
    bottomNavBottomPad(insetsBottom, spacingSm, platform) +
    contentGap
  );
}
