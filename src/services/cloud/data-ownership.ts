export type AccountDataDecision = 'upload-device' | 'restore-cloud' | 'resolve-conflict';

/**
 * First-sync ownership after sign-in.
 *
 * Dirty guest upgrades always pause for a chooser (`resolve-conflict`), whether
 * the cloud account is empty (keep vs start fresh) or already has rows (merge
 * vs discard device). Cloud is never silently overwritten by guest data.
 */
export function decideAccountData(
  remoteDomainCount: number,
  localCanConflict: boolean,
  hasMeaningfulDeviceData: boolean,
): AccountDataDecision {
  if (localCanConflict && hasMeaningfulDeviceData) return 'resolve-conflict';
  if (remoteDomainCount === 0) return 'upload-device';
  return 'restore-cloud';
}
