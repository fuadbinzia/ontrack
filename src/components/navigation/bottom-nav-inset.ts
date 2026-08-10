import { Platform } from 'react-native';

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
