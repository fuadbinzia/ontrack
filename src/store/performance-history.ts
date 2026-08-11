import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { mergeSamplesIntoRollups } from '@/features/performance/performance-metrics';
import type {
  PerformanceHourlyRollup,
  PerformanceSessionSummary,
  PerformanceSnapshot,
} from '@/features/performance/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

type PerformanceHistoryState = {
  rollups: Record<string, PerformanceHourlyRollup>;
  sessions: PerformanceSessionSummary[];
  appendSamples: (samples: readonly PerformanceSnapshot[], memoryWarnings?: number) => void;
  appendSession: (summary: PerformanceSessionSummary) => void;
  clear: () => void;
};

export const usePerformanceHistory = create<PerformanceHistoryState>()(
  persist(
    (set) => ({
      rollups: {},
      sessions: [],
      appendSamples: (samples, memoryWarnings = 0) => {
        if (samples.length === 0 && memoryWarnings === 0) return;
        set((state) => ({
          rollups: mergeSamplesIntoRollups(state.rollups, samples, memoryWarnings),
        }));
      },
      appendSession: (summary) => set((state) => ({
        sessions: [...state.sessions, summary]
          .filter((item) => item.endedAt >= Date.now() - 30 * 24 * 60 * 60_000)
          .slice(-120),
      })),
      clear: () => set({ rollups: {}, sessions: [] }),
    }),
    {
      name: STORAGE_KEYS.performanceHistory,
      storage: createPersistStorage(),
      partialize: (state) => ({
        rollups: state.rollups,
        sessions: state.sessions,
      }) as PerformanceHistoryState,
    },
  ),
);
