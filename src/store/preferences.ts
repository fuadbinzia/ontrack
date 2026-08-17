import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
    createLegalConsentRecord,
    isLegalConsentRecord,
    type LegalConsentRecord,
} from '@/features/account/legal-consent';
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
  /** Accepted privacy/terms version stamp. Recorded at first-run and sign-in. */
  legalConsent: LegalConsentRecord | null;
  /** Public holidays on Calendar and Today (static all-day rail, not timeline). */
  showHolidays: boolean;
  dateLocale: string;
  dateDisplayFormat: DateDisplayFormat;
  completeOnboarding: (input: { name: string; goal: string }) => void;
  setHomeLocation: (location: string) => void;
  setCurrentLocation: (location: string) => void;
  setName: (name: string) => void;
  setGoal: (goal: string) => void;
  setAvatar: (avatar: ProfileAvatarMeta) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setAiEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setUsageAnalyticsEnabled: (enabled: boolean) => void;
  recordLegalConsent: (now?: Date) => void;
  setShowHolidays: (enabled: boolean) => void;
  refreshDateLocale: () => void;
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
      usageAnalyticsEnabled: false,
      legalConsent: null,
      showHolidays: true,
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
          legalConsent: createLegalConsentRecord(),
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
      setGoal: (goal) => {
        useAuthAccess.getState().markGuestDataDirty();
        set({ goal: goal.trim() });
      },
      setAvatar: (avatar) => {
        useAuthAccess.getState().markGuestDataDirty();
        set({ avatar: normalizeAvatarMeta(avatar) });
      },
      setThemePreference: (themePreference) => set({ themePreference }),
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setUsageAnalyticsEnabled: (usageAnalyticsEnabled) => set({ usageAnalyticsEnabled }),
      recordLegalConsent: (now) => set({ legalConsent: createLegalConsentRecord(now) }),
      setShowHolidays: (showHolidays) => set({ showHolidays }),
      refreshDateLocale: () => {
        const dateLocale = deviceLocale();
        set({
          dateLocale,
          dateDisplayFormat: dateDisplayFormatForLocale(dateLocale),
        });
      },
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
          usageAnalyticsEnabled: false,
          legalConsent: null,
          showHolidays: true,
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
        const dateLocale = deviceLocale();
        return {
          ...currentState,
          ...persisted,
          name:
            typeof persisted.name === 'string' && !/^you$/i.test(persisted.name.trim())
              ? persisted.name.trim()
              : currentState.name,
          avatar: normalizeAvatarMeta(persisted.avatar ?? currentState.avatar),
          dateLocale,
          dateDisplayFormat: dateDisplayFormatForLocale(dateLocale),
          showHolidays:
            typeof persisted.showHolidays === 'boolean'
              ? persisted.showHolidays
              : true,
          legalConsent: isLegalConsentRecord(persisted.legalConsent)
            ? persisted.legalConsent
            : currentState.legalConsent,
        };
      },
    },
  ),
);
