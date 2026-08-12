import { Platform } from 'react-native';

import { layout, spacing } from '@/design-system';

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
