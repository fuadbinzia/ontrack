import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  affinitiesFromUsage,
  isOverviewAffinityRoute,
  type OverviewAffinityEntry,
} from '@/features/overview/overview-affinity';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { summarizeLocalUsage } from '@/store/usage-analytics';

type OverviewAffinityState = {
  byRoute: Record<string, OverviewAffinityEntry>;
  recordVisit: (routeName: string, at?: number) => void;
  seedFromUsageIfEmpty: (now?: number) => void;
  reset: () => void;
};

function sanitizeByRoute(
  value?: Partial<Record<string, unknown>> | null,
): Record<string, OverviewAffinityEntry> {
  if (!value) return {};
  const next: Record<string, OverviewAffinityEntry> = {};
  for (const [routeName, raw] of Object.entries(value)) {
    if (!isOverviewAffinityRoute(routeName)) continue;
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Partial<OverviewAffinityEntry>;
    if (
      typeof entry.visitCount !== 'number' ||
      !Number.isFinite(entry.visitCount) ||
      entry.visitCount <= 0
    ) {
      continue;
    }
    if (
      typeof entry.lastVisitedAt !== 'number' ||
      !Number.isFinite(entry.lastVisitedAt)
    ) {
      continue;
    }
    next[routeName] = {
      visitCount: Math.round(entry.visitCount),
      lastVisitedAt: entry.lastVisitedAt,
    };
  }
  return next;
}

export const useOverviewAffinity = create<OverviewAffinityState>()(
  persist(
    (set, get) => ({
      byRoute: {},
      recordVisit: (routeName, at = Date.now()) => {
        if (!isOverviewAffinityRoute(routeName) || !Number.isFinite(at)) return;
        set((state) => {
          const previous = state.byRoute[routeName];
          // Absorb Strict Mode remounts and accidental double mounts.
          if (previous && at - previous.lastVisitedAt < 750) {
            return state;
          }
          return {
            byRoute: {
              ...state.byRoute,
              [routeName]: {
                visitCount: (previous?.visitCount ?? 0) + 1,
                lastVisitedAt: at,
              },
            },
          };
        });
      },
      seedFromUsageIfEmpty: (now = Date.now()) => {
        if (Object.keys(get().byRoute).length > 0) return;
        const seeded = affinitiesFromUsage(
          summarizeLocalUsage(28).topSurfaces,
          now,
        );
        if (Object.keys(seeded).length === 0) return;
        set({ byRoute: seeded });
      },
      reset: () => set({ byRoute: {} }),
    }),
    {
      name: STORAGE_KEYS.overviewAffinity,
      storage: createPersistStorage(),
      partialize: (state) => ({
        byRoute: state.byRoute,
      }),
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === 'object'
            ? (persisted as Partial<OverviewAffinityState>)
            : undefined;
        return {
          ...current,
          byRoute: sanitizeByRoute(raw?.byRoute),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.seedFromUsageIfEmpty();
      },
    },
  ),
);

useOverviewAffinity.getState().seedFromUsageIfEmpty();
