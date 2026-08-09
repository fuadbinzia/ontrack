import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SyncDomainName } from '@/services/cloud/sync';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

type JsonObject = Record<string, unknown>;

/** Who activated the sandbox — agent sessions must not stick across cold start. */
export type DevModeSource = 'user' | 'agent';

export type DevModeLiveSnapshot = {
  capturedAt: string;
  domains: Partial<Record<SyncDomainName, JsonObject>>;
  health?: JsonObject;
};

interface DevModeState {
  /** Sandbox active — live account data is snapshotted; cloud push paused. */
  enabled: boolean;
  /** `agent` = seed/verify sandbox; `user` = Developer Hub toggle. Both exit on cold start. */
  source: DevModeSource | null;
  liveSnapshot: DevModeLiveSnapshot | null;
  /**
   * Opt this device out of the cold-start sign-in gate. Unlike `enabled`, it
   * deliberately survives relaunch — that is the behaviour it controls.
   */
  staySignedIn: boolean;
  setEnabledFlag: (enabled: boolean) => void;
  setLiveSnapshot: (snapshot: DevModeLiveSnapshot | null) => void;
  setStaySignedIn: (staySignedIn: boolean) => void;
}

export const useDevMode = create<DevModeState>()(
  persist(
    (set) => ({
      enabled: false,
      source: null,
      liveSnapshot: null,
      staySignedIn: false,
      setEnabledFlag: (enabled) => set({ enabled }),
      setLiveSnapshot: (liveSnapshot) => set({ liveSnapshot }),
      setStaySignedIn: (staySignedIn) => set({ staySignedIn }),
    }),
    {
      name: STORAGE_KEYS.devMode,
      storage: createPersistStorage(),
      partialize: (state) => ({
        enabled: state.enabled,
        source: state.source,
        liveSnapshot: state.liveSnapshot,
        staySignedIn: state.staySignedIn,
      }),
    },
  ),
);

export function isDevModeEnabled() {
  return useDevMode.getState().enabled;
}
