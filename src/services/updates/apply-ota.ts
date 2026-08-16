/** Minimal surface so unit tests can drive apply without native expo-updates. */
export type OtaUpdatesClient = {
  isEnabled: boolean;
  /** Native/JS already downloaded an update that has not been loaded yet. */
  isUpdatePending?: () => boolean;
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
 * Android can reload in-session. iOS reloads once the app leaves the foreground
 * (`inactive` / `background`) so a switcher force-quit still applies.
 *
 * Native `expo-updates` also auto-downloads. Treat `isUpdatePending` as
 * already downloaded so a stale `isNew: false` fetch does not skip reload
 * and force extra cold starts. Launch wait (`fallbackToCacheTimeout` 8000)
 * is baked into the binary — current TestFlight/device builds still have 0
 * until the next native ship.
 */
export async function applyAvailableOtaUpdate(
  updates: OtaUpdatesClient,
): Promise<ApplyOtaResult> {
  if (!updates.isEnabled) return 'skipped';
  if (updates.isUpdatePending?.()) return 'downloaded';
  const check = await updates.checkForUpdateAsync();
  if (!check.isAvailable) {
    return updates.isUpdatePending?.() ? 'downloaded' : 'noop';
  }
  const fetched = await updates.fetchUpdateAsync();
  if (fetched.isNew || updates.isUpdatePending?.()) return 'downloaded';
  return 'noop';
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
  // App switcher / lock is `inactive`. Force-quit from the switcher often
  // never delivers `background`, so waiting only for background skipped apply.
  if (
    pendingBackgroundReload &&
    (state === 'inactive' || state === 'background')
  ) {
    return 'reload';
  }
  if (state === 'active' && !pendingBackgroundReload) return 'check';
  return 'none';
}
