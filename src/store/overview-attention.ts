import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

const MAX_ACKNOWLEDGEMENTS = 256;

interface OverviewAttentionState {
  acknowledgedKeys: string[];
  acknowledge: (key: string) => void;
  reset: () => void;
}

export const useOverviewAttention = create<OverviewAttentionState>()(
  persist(
    (set) => ({
      acknowledgedKeys: [],
      acknowledge: (key) =>
        set((state) => ({
          acknowledgedKeys: state.acknowledgedKeys.includes(key)
            ? state.acknowledgedKeys
            : [...state.acknowledgedKeys, key].slice(-MAX_ACKNOWLEDGEMENTS),
        })),
      reset: () => set({ acknowledgedKeys: [] }),
    }),
    {
      name: STORAGE_KEYS.overviewAttention,
      storage: createPersistStorage(),
      partialize: (state) => ({
        acknowledgedKeys: state.acknowledgedKeys,
      }) as OverviewAttentionState,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<OverviewAttentionState>;
        return {
          ...currentState,
          acknowledgedKeys: Array.isArray(persisted.acknowledgedKeys)
            ? persisted.acknowledgedKeys
                .filter((key): key is string => typeof key === 'string')
                .slice(-MAX_ACKNOWLEDGEMENTS)
            : [],
        };
      },
    },
  ),
);
