import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

interface BiometricUnlockState {
  /** Signed-in user who enabled Face ID / fingerprint on this device. */
  enabledUserId: string | null;
  /** Opt-in from the sign-in Remember Me toggle, before an account is bound. */
  rememberMe: boolean;
  setEnabledUserId: (userId: string | null) => void;
  setRememberMe: (rememberMe: boolean) => void;
}

export const useBiometricUnlock = create<BiometricUnlockState>()(
  persist(
    (set) => ({
      enabledUserId: null,
      rememberMe: false,
      setEnabledUserId: (enabledUserId) => set({ enabledUserId }),
      setRememberMe: (rememberMe) => set({ rememberMe }),
    }),
    {
      name: STORAGE_KEYS.biometricUnlock,
      storage: createPersistStorage(),
      partialize: (state) => ({
        enabledUserId: state.enabledUserId,
        rememberMe: state.rememberMe,
      }),
    },
  ),
);

export function isBiometricUnlockEnabledFor(userId: string | undefined): boolean {
  return Boolean(userId) && useBiometricUnlock.getState().enabledUserId === userId;
}

export function setBiometricUnlockUserId(userId: string | null): void {
  useBiometricUnlock.getState().setEnabledUserId(userId);
}
