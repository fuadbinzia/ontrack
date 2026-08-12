import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type { AnalyticsSurface } from '@/services/analytics/surfaces';
import { toDateKey } from '@/utils/date';

export type UsageDayRollup = {
  day: string;
  sessionCount: number;
  activeMs: number;
  surfaces: Partial<Record<AnalyticsSurface, number>>;
  /** Milliseconds already uploaded for this day (additive cloud merge). */
  uploadedActiveMs: number;
  uploadedSessionCount: number;
  uploadedSurfaces: Partial<Record<AnalyticsSurface, number>>;
};

type UsageAnalyticsState = {
  /** Anonymous install id for local-only correlation (not sent as PII). */
  installId: string;
  days: Record<string, UsageDayRollup>;
  lastSyncedAt?: string;
  ensureInstallId: () => string;
  recordSessionStart: (at?: number) => void;
  recordActiveMs: (surface: AnalyticsSurface, ms: number, at?: number) => void;
  markUploaded: (day: string, delta: UsageDayRollup) => void;
  resetLocal: () => void;
};

function emptyDay(day: string): UsageDayRollup {
  return {
    day,
    sessionCount: 0,
    activeMs: 0,
    surfaces: {},
    uploadedActiveMs: 0,
    uploadedSessionCount: 0,
    uploadedSurfaces: {},
  };
}

function newInstallId(): string {
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function dayFor(at: number): string {
  return toDateKey(new Date(at));
}

export function pendingUploadDelta(day: UsageDayRollup): UsageDayRollup | undefined {
  const sessionCount = Math.max(0, day.sessionCount - day.uploadedSessionCount);
  const activeMs = Math.max(0, day.activeMs - day.uploadedActiveMs);
  const surfaces: Partial<Record<AnalyticsSurface, number>> = {};
  for (const [key, value] of Object.entries(day.surfaces) as [AnalyticsSurface, number][]) {
    const uploaded = day.uploadedSurfaces[key] ?? 0;
    const delta = Math.max(0, (value ?? 0) - uploaded);
    if (delta > 0) surfaces[key] = delta;
  }
  if (sessionCount === 0 && activeMs === 0 && Object.keys(surfaces).length === 0) {
    return undefined;
  }
  return {
    day: day.day,
    sessionCount,
    activeMs,
    surfaces,
    uploadedActiveMs: 0,
    uploadedSessionCount: 0,
    uploadedSurfaces: {},
  };
}

export const useUsageAnalytics = create<UsageAnalyticsState>()(
  persist(
    (set, get) => ({
      installId: '',
      days: {},
      ensureInstallId: () => {
        const existing = get().installId;
        if (existing) return existing;
        const installId = newInstallId();
        set({ installId });
        return installId;
      },
      recordSessionStart: (at = Date.now()) => {
        const day = dayFor(at);
        set((state) => {
          const current = state.days[day] ?? emptyDay(day);
          return {
            days: {
              ...state.days,
              [day]: { ...current, sessionCount: current.sessionCount + 1 },
            },
          };
        });
      },
      recordActiveMs: (surface, ms, at = Date.now()) => {
        if (!Number.isFinite(ms) || ms <= 0) return;
        const capped = Math.min(Math.round(ms), 60 * 60 * 1000);
        const day = dayFor(at);
        set((state) => {
          const current = state.days[day] ?? emptyDay(day);
          const prevSurface = current.surfaces[surface] ?? 0;
          return {
            days: {
              ...state.days,
              [day]: {
                ...current,
                activeMs: current.activeMs + capped,
                surfaces: { ...current.surfaces, [surface]: prevSurface + capped },
              },
            },
          };
        });
      },
      markUploaded: (day, delta) => {
        set((state) => {
          const current = state.days[day] ?? emptyDay(day);
          const uploadedSurfaces = { ...current.uploadedSurfaces };
          for (const [key, value] of Object.entries(delta.surfaces) as [
            AnalyticsSurface,
            number,
          ][]) {
            uploadedSurfaces[key] = (uploadedSurfaces[key] ?? 0) + (value ?? 0);
          }
          return {
            lastSyncedAt: new Date().toISOString(),
            days: {
              ...state.days,
              [day]: {
                ...current,
                uploadedActiveMs: current.uploadedActiveMs + delta.activeMs,
                uploadedSessionCount: current.uploadedSessionCount + delta.sessionCount,
                uploadedSurfaces,
              },
            },
          };
        });
      },
      resetLocal: () => set({ installId: '', days: {}, lastSyncedAt: undefined }),
    }),
    {
      name: STORAGE_KEYS.usageAnalytics,
      storage: createPersistStorage(),
      partialize: (state) => ({
        installId: state.installId,
        days: state.days,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);

export function summarizeLocalUsage(daysBack = 7): {
  windowDays: number;
  sessionCount: number;
  activeMs: number;
  topSurfaces: { surface: AnalyticsSurface; activeMs: number }[];
} {
  const state = useUsageAnalytics.getState();
  const end = new Date();
  let sessionCount = 0;
  let activeMs = 0;
  const surfaces: Partial<Record<AnalyticsSurface, number>> = {};
  for (let i = 0; i < daysBack; i += 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = toDateKey(d);
    const day = state.days[key];
    if (!day) continue;
    sessionCount += day.sessionCount;
    activeMs += day.activeMs;
    for (const [surface, ms] of Object.entries(day.surfaces) as [AnalyticsSurface, number][]) {
      surfaces[surface] = (surfaces[surface] ?? 0) + (ms ?? 0);
    }
  }
  const topSurfaces = (Object.entries(surfaces) as [AnalyticsSurface, number][])
    .map(([surface, ms]) => ({ surface, activeMs: ms }))
    .sort((a, b) => b.activeMs - a.activeMs)
    .slice(0, 12);
  return { windowDays: daysBack, sessionCount, activeMs, topSurfaces };
}
