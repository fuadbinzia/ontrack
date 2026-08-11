import { create } from 'zustand';

import { derivePerformanceWarnings } from '@/features/performance/performance-metrics';
import type { PerformanceSnapshot, PerformanceWarning } from '@/features/performance/types';

const MAX_SESSION_SAMPLES = 3600;

type PerformanceRuntimeState = {
  supported: boolean;
  detailed: boolean;
  latest?: PerformanceSnapshot;
  samples: PerformanceSnapshot[];
  warnings: PerformanceWarning[];
  memoryWarnings: number;
  setSupported: (supported: boolean) => void;
  setDetailed: (detailed: boolean) => void;
  addSample: (sample: PerformanceSnapshot) => void;
  recordMemoryWarning: () => void;
  clearSession: () => void;
};

export const usePerformanceRuntime = create<PerformanceRuntimeState>((set) => ({
  supported: true,
  detailed: false,
  samples: [],
  warnings: [],
  memoryWarnings: 0,
  setSupported: (supported) => set({ supported }),
  setDetailed: (detailed) => set({ detailed }),
  addSample: (sample) => set((state) => {
    const samples = [...state.samples, sample].slice(-MAX_SESSION_SAMPLES);
    return { supported: true, latest: sample, samples, warnings: derivePerformanceWarnings(samples) };
  }),
  recordMemoryWarning: () => set((state) => ({ memoryWarnings: state.memoryWarnings + 1 })),
  clearSession: () => set({ latest: undefined, samples: [], warnings: [], memoryWarnings: 0 }),
}));
