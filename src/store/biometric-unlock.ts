import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

interface BiometricUnlockState {
  /** Signed-in user who enabled Face ID / fingerprint on this device. */
  enabledUserId: string | null;
  setEnabledUserId: (userId: string | null) => void;
}

export const useBiometricUnlock = create<BiometricUnlockState>()(
  persist(
    (set) => ({
      enabledUserId: null,
      setEnabledUserId: (enabledUserId) => set({ enabledUserId }),
    }),
    {
      name: STORAGE_KEYS.biometricUnlock,
      storage: createPersistStorage(),
      partialize: (state) => ({ enabledUserId: state.enabledUserId }),
    },
  ),
);

export function isBiometricUnlockEnabledFor(userId: string | undefined): boolean {
  return Boolean(userId) && useBiometricUnlock.getState().enabledUserId === userId;
}

export function setBiometricUnlockUserId(userId: string | null): void {
  useBiometricUnlock.getState().setEnabledUserId(userId);
}
