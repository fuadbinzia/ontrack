import { Platform } from 'react-native';

import {
    authenticateBiometricUnlock,
    biometricKindFromTypes,
    biometricUnlockIcon,
    biometricUnlockLabel,
    canOfferBiometricUnlock,
    isAuthBiometricToggleOn,
    capabilityFromHardware,
    applyRememberMeForUser,
    AUTH_REMEMBER_ME_LABEL,
    enableBiometricUnlockForUser,
    isBiometricCancelError,
    resolveBiometricUnlockSession,
    shouldAutoPromptBiometricUnlock,
} from '@/features/auth/biometric-unlock';
import { isBiometricUnlockEnabledFor, useBiometricUnlock } from '@/store/biometric-unlock';

const LocalAuthentication = jest.requireMock('expo-local-authentication') as {
  authenticateAsync: jest.Mock;
};

describe('biometric unlock helpers', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    useBiometricUnlock.setState({ enabledUserId: null, rememberMe: false });
    LocalAuthentication.authenticateAsync.mockReset();
    Platform.OS = originalOs;
  });

  afterAll(() => {
    Platform.OS = originalOs;
  });

  it('prefers Face ID when facial recognition is available', () => {
    expect(biometricKindFromTypes([1, 2])).toBe('face');
    expect(biometricUnlockLabel('face')).toBe('Unlock With Face ID');
    expect(biometricUnlockIcon('face')).toBe('faceid');
  });

  it('labels fingerprint as Touch ID on iOS and Fingerprint on Android', () => {
    Platform.OS = 'ios';
    expect(biometricUnlockLabel('fingerprint')).toBe('Unlock With Touch ID');
    Platform.OS = 'android';
    expect(biometricUnlockLabel('fingerprint')).toBe('Unlock With Fingerprint');
    expect(biometricKindFromTypes([1])).toBe('fingerprint');
    expect(biometricUnlockIcon('fingerprint')).toBe('fingerprint');
  });

  it('is available only when hardware is present and enrolled', () => {
    expect(
      capabilityFromHardware({ hasHardware: true, enrolled: false, types: [2] }).available,
    ).toBe(false);
    expect(
      capabilityFromHardware({ hasHardware: false, enrolled: true, types: [2] }).available,
    ).toBe(false);
    expect(
      capabilityFromHardware({ hasHardware: true, enrolled: true, types: [2] }).available,
    ).toBe(true);
  });

  it('treats user and system dismissals as cancel', () => {
    expect(isBiometricCancelError('user_cancel')).toBe(true);
    expect(isBiometricCancelError('system_cancel')).toBe(true);
    expect(isBiometricCancelError('authentication_failed')).toBe(false);
  });

  it('offers Face ID on sign-in as soon as the device is enrolled', () => {
    expect(canOfferBiometricUnlock(true)).toBe(true);
    expect(canOfferBiometricUnlock(false)).toBe(false);
    expect(
      isAuthBiometricToggleOn({ enabledUserId: 'user-1', unlockUserId: 'user-1' }),
    ).toBe(true);
    expect(
      isAuthBiometricToggleOn({ enabledUserId: 'user-1', unlockUserId: 'user-2' }),
    ).toBe(false);
    expect(isAuthBiometricToggleOn({ enabledUserId: 'user-1' })).toBe(false);
    expect(
      isAuthBiometricToggleOn({
        enabledUserId: null,
        rememberMe: true,
      }),
    ).toBe(true);
    expect(AUTH_REMEMBER_ME_LABEL).toBe('Remember Me');
    expect(
      shouldAutoPromptBiometricUnlock({
        available: true,
        enabledUserId: null,
        unlockUserId: 'user-1',
      }),
    ).toBe(false);
    expect(
      shouldAutoPromptBiometricUnlock({
        available: true,
        enabledUserId: 'user-1',
        unlockUserId: 'user-1',
      }),
    ).toBe(true);
    expect(
      shouldAutoPromptBiometricUnlock({
        available: true,
        enabledUserId: 'user-1',
      }),
    ).toBe(false);
  });

  it('restores the disk session only for the locked account', () => {
    expect(
      resolveBiometricUnlockSession({ lockedUserId: 'user-1', diskUserId: 'user-1' }),
    ).toBe('unlocked');
    expect(
      resolveBiometricUnlockSession({ lockedUserId: 'user-1', diskUserId: undefined }),
    ).toBe('missing-session');
    expect(
      resolveBiometricUnlockSession({ lockedUserId: 'user-1', diskUserId: 'user-2' }),
    ).toBe('account-mismatch');
  });

  it('enables only after a successful prompt and binds the flag to that user', async () => {
    const authenticate = jest.fn(async () => 'cancel' as const);
    await expect(
      enableBiometricUnlockForUser('user-1', { authenticate }),
    ).resolves.toBe('cancel');
    expect(isBiometricUnlockEnabledFor('user-1')).toBe(false);

    authenticate.mockResolvedValueOnce('success');
    await expect(
      enableBiometricUnlockForUser('user-1', { authenticate }),
    ).resolves.toBe('enabled');
    expect(isBiometricUnlockEnabledFor('user-1')).toBe(true);
    expect(isBiometricUnlockEnabledFor('user-2')).toBe(false);
    expect(isBiometricUnlockEnabledFor(undefined)).toBe(false);
  });

  it('binds Remember Me to the signed-in user without a second prompt', () => {
    applyRememberMeForUser('user-1');
    expect(isBiometricUnlockEnabledFor('user-1')).toBe(false);

    useBiometricUnlock.setState({ rememberMe: true });
    applyRememberMeForUser('user-1');
    expect(isBiometricUnlockEnabledFor('user-1')).toBe(true);
  });

  it('does not enable when hardware is not available', async () => {
    const authenticate = jest.fn(async () => 'success' as const);
    await expect(
      enableBiometricUnlockForUser('user-1', {
        authenticate,
        capability: { available: false, label: 'Unlock With Face ID' },
      }),
    ).resolves.toBe('unavailable');
    expect(authenticate).not.toHaveBeenCalled();
    expect(isBiometricUnlockEnabledFor('user-1')).toBe(false);
  });

  it('maps a cancelled OS prompt to cancel without throwing', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    await expect(authenticateBiometricUnlock('Unlock onTrack')).resolves.toBe('cancel');
  });

  it('maps a failed OS prompt to failure', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: 'authentication_failed',
    });
    await expect(authenticateBiometricUnlock('Unlock onTrack')).resolves.toBe('failure');
  });
});
