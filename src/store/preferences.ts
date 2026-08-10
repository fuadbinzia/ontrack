import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
    emptyAvatarMeta,
    normalizeAvatarMeta,
    type ProfileAvatarMeta,
} from '@/features/account/profile-avatar-model';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { useAuthAccess } from '@/store/auth-access';
import {
    dateDisplayFormatForLocale,
    deviceLocale,
    type DateDisplayFormat,
} from '@/utils/date';

export type ThemePreference = 'system' | 'light' | 'dark';

interface PreferencesState {
  hasOnboarded: boolean;
  name: string;
  goal: string;
  /**
   * User-authored home city/place for Today weather.
   * Never auto-filled from GPS — only set via Profile → Preferences.
   */
  homeLocation: string;
  /**
   * Optional override for the Today “Current” weather place.
   * Empty → live device geolocation. Never writes `homeLocation`.
   */
  currentLocation: string;
  /** Self avatar — local-first; synced to cloud when signed in. */
  avatar: ProfileAvatarMeta;
  themePreference: ThemePreference;
  aiEnabled: boolean;
  hapticsEnabled: boolean;
  /**
   * First-party product usage (time on surfaces). Local always when on;
   * cloud rollups only when signed in. Never includes Health note text.
   */
  usageAnalyticsEnabled: boolean;
  dateLocale: string;
  dateDisplayFormat: DateDisplayFormat;
  completeOnboarding: (input: { name: string; goal: string }) => void;
  setHomeLocation: (location: string) => void;
  setCurrentLocation: (location: string) => void;
  setName: (name: string) => void;
  setAvatar: (avatar: ProfileAvatarMeta) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setAiEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setUsageAnalyticsEnabled: (enabled: boolean) => void;
  resetAll: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => {
      const initialLocale = deviceLocale();
      return {
      hasOnboarded: false,
      name: '',
      goal: '',
      homeLocation: '',
      currentLocation: '',
      avatar: emptyAvatarMeta(),
      themePreference: 'system',
      aiEnabled: true,
      hapticsEnabled: true,
      usageAnalyticsEnabled: true,
      dateLocale: initialLocale,
      dateDisplayFormat: dateDisplayFormatForLocale(initialLocale),
      completeOnboarding: ({ name, goal }) => {
        const dateLocale = deviceLocale();
        useAuthAccess.getState().markGuestDataDirty();
        const trimmed = name.trim();
        // Welcome empty/skip → Guest. Drop legacy "You" placeholder.
        const nextName =
          !trimmed || /^you$/i.test(trimmed) ? 'Guest' : trimmed;
        set({
          hasOnboarded: true,
          name: nextName,
          goal,
          dateLocale,
          dateDisplayFormat: dateDisplayFormatForLocale(dateLocale),
        });
      },
      setHomeLocation: (homeLocation) => {
        useAuthAccess.getState().markGuestDataDirty();
        set({ homeLocation: homeLocation.trim() });
      },
      setCurrentLocation: (currentLocation) => {
        useAuthAccess.getState().markGuestDataDirty();
        set({ currentLocation: currentLocation.trim() });
      },
      setName: (name) => {
        useAuthAccess.getState().markGuestDataDirty();
        const trimmed = name.trim();
        // Legacy "You" placeholder → empty so resolveSelfDisplayName falls back to Guest.
        set({ name: /^you$/i.test(trimmed) ? '' : trimmed });
      },
      setAvatar: (avatar) => {
        useAuthAccess.getState().markGuestDataDirty();
        set({ avatar: normalizeAvatarMeta(avatar) });
      },
      setThemePreference: (themePreference) => set({ themePreference }),
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setUsageAnalyticsEnabled: (usageAnalyticsEnabled) => set({ usageAnalyticsEnabled }),
      resetAll: () =>
        set({
          hasOnboarded: false,
          name: '',
          goal: '',
          homeLocation: '',
          currentLocation: '',
          avatar: emptyAvatarMeta(),
          themePreference: 'system',
          aiEnabled: true,
          hapticsEnabled: true,
          usageAnalyticsEnabled: true,
          dateLocale: initialLocale,
          dateDisplayFormat: dateDisplayFormatForLocale(initialLocale),
        }),
      };
    },
    {
      name: STORAGE_KEYS.preferences,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PreferencesState>;
        const dateLocale =
          typeof persisted.dateLocale === 'string'
            ? persisted.dateLocale
            : currentState.dateLocale;
        return {
          ...currentState,
          ...persisted,
          name:
            typeof persisted.name === 'string' && !/^you$/i.test(persisted.name.trim())
              ? persisted.name.trim()
              : currentState.name,
          avatar: normalizeAvatarMeta(persisted.avatar ?? currentState.avatar),
          dateLocale,
          dateDisplayFormat:
            persisted.dateDisplayFormat === 'mdy' ||
            persisted.dateDisplayFormat === 'iso'
              ? persisted.dateDisplayFormat
              : dateDisplayFormatForLocale(dateLocale),
        };
      },
    },
  ),
);
