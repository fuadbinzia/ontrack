import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { AppIconName } from '@/design-system';
import {
    isBiometricUnlockEnabledFor,
    setBiometricUnlockUserId,
} from '@/store/biometric-unlock';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic';
export type BiometricAuthResult = 'success' | 'cancel' | 'failure' | 'unavailable';

export type BiometricCapability = {
  hasHardware: boolean;
  enrolled: boolean;
  available: boolean;
  kind: BiometricKind;
  label: string;
  icon: Extract<AppIconName, 'faceid' | 'fingerprint'>;
};

export const UNAVAILABLE_BIOMETRIC_CAPABILITY: BiometricCapability = {
  hasHardware: false,
  enrolled: false,
  available: false,
  kind: 'generic',
  label: 'Unlock With Biometrics',
  icon: 'fingerprint',
};

const FACIAL_RECOGNITION = 2;
const FINGERPRINT = 1;
const IRIS = 3;

const CANCEL_ERRORS = new Set([
  'user_cancel',
  'system_cancel',
  'app_cancel',
  'user_fallback',
]);

export function biometricKindFromTypes(types: readonly number[]): BiometricKind {
  if (types.includes(FACIAL_RECOGNITION)) return 'face';
  if (types.includes(FINGERPRINT)) return 'fingerprint';
  if (types.includes(IRIS)) return 'iris';
  return 'generic';
}

export function biometricUnlockLabel(kind: BiometricKind): string {
  if (kind === 'face') return 'Unlock With Face ID';
  if (kind === 'fingerprint') {
    return Platform.OS === 'ios' ? 'Unlock With Touch ID' : 'Unlock With Fingerprint';
  }
  if (kind === 'iris') return 'Unlock With Iris';
  return 'Unlock With Biometrics';
}

export function biometricUnlockIcon(
  kind: BiometricKind,
): Extract<AppIconName, 'faceid' | 'fingerprint'> {
  return kind === 'face' ? 'faceid' : 'fingerprint';
}

export function capabilityFromHardware(input: {
  hasHardware: boolean;
  enrolled: boolean;
  types: readonly number[];
}): BiometricCapability {
  const kind = biometricKindFromTypes(input.types);
  return {
    hasHardware: input.hasHardware,
    enrolled: input.enrolled,
    available: input.hasHardware && input.enrolled,
    kind,
    label: biometricUnlockLabel(kind),
    icon: biometricUnlockIcon(kind),
  };
}

export function isBiometricCancelError(error: string | undefined): boolean {
  return Boolean(error && CANCEL_ERRORS.has(error));
}

export function resolveBiometricUnlockSession(input: {
  lockedUserId: string;
  diskUserId: string | undefined;
}): 'unlocked' | 'missing-session' | 'account-mismatch' {
  if (!input.diskUserId) return 'missing-session';
  if (input.diskUserId !== input.lockedUserId) return 'account-mismatch';
  return 'unlocked';
}

/** Face ID / fingerprint CTA on every AuthScreen once the device can do it. */
export function canOfferBiometricUnlock(available: boolean): boolean {
  return available;
}

/** Auto-prompt only after this account already opted in and a lock target exists. */
export function shouldAutoPromptBiometricUnlock(input: {
  available: boolean;
  enabledUserId: string | null | undefined;
  unlockUserId?: string;
}): boolean {
  return (
    input.available &&
    Boolean(input.unlockUserId) &&
    input.enabledUserId === input.unlockUserId
  );
}

export async function loadBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') return UNAVAILABLE_BIOMETRIC_CAPABILITY;
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return capabilityFromHardware({ hasHardware, enrolled, types });
  } catch {
    return UNAVAILABLE_BIOMETRIC_CAPABILITY;
  }
}

export async function authenticateBiometricUnlock(
  promptMessage: string,
): Promise<BiometricAuthResult> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    if (isBiometricCancelError(result.error)) return 'cancel';
    if (result.error === 'not_available' || result.error === 'not_enrolled') {
      return 'unavailable';
    }
    return 'failure';
  } catch {
    return 'unavailable';
  }
}

export async function enableBiometricUnlockForUser(
  userId: string,
  options?: {
    authenticate?: (promptMessage: string) => Promise<BiometricAuthResult>;
    capability?: Pick<BiometricCapability, 'available' | 'label'>;
  },
): Promise<'enabled' | BiometricAuthResult> {
  const capability = options?.capability ?? {
    available: true,
    label: 'Unlock With Biometrics',
  };
  if (!capability.available) return 'unavailable';
  const authenticate = options?.authenticate ?? authenticateBiometricUnlock;
  const result = await authenticate(capability.label);
  if (result !== 'success') return result;
  setBiometricUnlockUserId(userId);
  return 'enabled';
}

export function disableBiometricUnlock(): void {
  setBiometricUnlockUserId(null);
}

export { isBiometricUnlockEnabledFor };

function sameCapability(left: BiometricCapability, right: BiometricCapability): boolean {
  return (
    left.hasHardware === right.hasHardware &&
    left.enrolled === right.enrolled &&
    left.available === right.available &&
    left.kind === right.kind &&
    left.label === right.label &&
    left.icon === right.icon
  );
}

export function useBiometricCapability(): BiometricCapability {
  const [capability, setCapability] = useState(UNAVAILABLE_BIOMETRIC_CAPABILITY);
  useEffect(() => {
    let active = true;
    void loadBiometricCapability().then((next) => {
      if (!active) return;
      setCapability((current) => (sameCapability(current, next) ? current : next));
    });
    return () => {
      active = false;
    };
  }, []);
  return capability;
}
