/** Minimal surface so unit tests can drive apply without native expo-updates. */
export type OtaUpdatesClient = {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
};

export type ApplyOtaResult = 'skipped' | 'noop' | 'downloaded';

/**
 * Check → download only. Reload is scheduled by the caller via `otaReloadPlanForOs`.
 *
 * Immediate `reloadAsync` on iOS races Expo Fabric view creation (TestFlight):
 * `ExpoFabricView` fatals with "The app context has been lost", then
 * `expo-updates` ErrorRecovery re-raises on `errorRecoveryQueue` as SIGABRT.
 * Android can reload in-session. iOS reloads once the app is backgrounded.
 */
export async function applyAvailableOtaUpdate(
  updates: OtaUpdatesClient,
): Promise<ApplyOtaResult> {
  if (!updates.isEnabled) return 'skipped';
  const check = await updates.checkForUpdateAsync();
  if (!check.isAvailable) return 'noop';
  const fetched = await updates.fetchUpdateAsync();
  if (!fetched.isNew) return 'noop';
  return 'downloaded';
}

export type OtaReloadPlan = 'immediate' | 'on-background' | 'next-cold-start';

export function otaReloadPlanForOs(os: string): OtaReloadPlan {
  if (os === 'android') return 'immediate';
  if (os === 'ios') return 'on-background';
  return 'next-cold-start';
}

export type OtaAppStateAction = 'check' | 'reload' | 'none';

export function otaAppStateAction(
  state: string,
  pendingBackgroundReload: boolean,
): OtaAppStateAction {
  if (state === 'background' && pendingBackgroundReload) return 'reload';
  if (state === 'active' && !pendingBackgroundReload) return 'check';
  return 'none';
}
