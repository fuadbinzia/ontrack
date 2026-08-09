import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { isSafeAuthReturnTo } from '@/utils/auth-return-to';

export type ActiveSignInProvider = 'apple' | 'google';

interface AuthAccessState {
  guestEnabled: boolean;
  guestDataDirty: boolean;
  authUpgradePending: boolean;
  pendingAuthReturnTo?: string;
  /** SSO button used for the live session (Profile account card). */
  activeSignInProvider?: ActiveSignInProvider;
  enterGuest: (dirty?: boolean) => void;
  markGuestDataDirty: () => void;
  startAuthUpgrade: () => void;
  setAuthReturnTo: (path?: string) => void;
  takeAuthReturnTo: () => string | undefined;
  setActiveSignInProvider: (provider?: ActiveSignInProvider) => void;
  finishAuthentication: () => void;
  cancelAuthUpgrade: () => void;
  resetAccess: () => void;
}

export const useAuthAccess = create<AuthAccessState>()(
  persist(
    (set, get) => ({
      guestEnabled: false,
      guestDataDirty: false,
      authUpgradePending: false,
      enterGuest: (dirty = false) =>
        set({
          guestEnabled: true,
          guestDataDirty: dirty,
          authUpgradePending: false,
          pendingAuthReturnTo: undefined,
          activeSignInProvider: undefined,
        }),
      markGuestDataDirty: () =>
        set((state) => (state.guestEnabled ? { guestDataDirty: true } : state)),
      startAuthUpgrade: () => set({ authUpgradePending: true }),
      setAuthReturnTo: (path) =>
        set({
          pendingAuthReturnTo: isSafeAuthReturnTo(path) ? path : undefined,
        }),
      takeAuthReturnTo: () => {
        const path = get().pendingAuthReturnTo;
        set({ pendingAuthReturnTo: undefined });
        return path;
      },
      setActiveSignInProvider: (provider) => set({ activeSignInProvider: provider }),
      finishAuthentication: () =>
        set({
          guestEnabled: false,
          guestDataDirty: false,
          authUpgradePending: false,
        }),
      cancelAuthUpgrade: () =>
        set({ authUpgradePending: false, pendingAuthReturnTo: undefined }),
      resetAccess: () =>
        set({
          guestEnabled: false,
          guestDataDirty: false,
          authUpgradePending: false,
          pendingAuthReturnTo: undefined,
          activeSignInProvider: undefined,
        }),
    }),
    {
      name: STORAGE_KEYS.authAccess,
      storage: createPersistStorage(),
      partialize: ({
        guestEnabled,
        guestDataDirty,
        authUpgradePending,
        pendingAuthReturnTo,
        activeSignInProvider,
      }) =>
        ({
          guestEnabled,
          guestDataDirty,
          authUpgradePending,
          pendingAuthReturnTo,
          activeSignInProvider,
        }) as AuthAccessState,
    },
  ),
);
