import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  clampPinnedCount,
  DEFAULT_PINNED_COUNT,
  DEFAULT_TRACKER_ORDER,
  mergeTrackerSections,
  NAV_PIN_LIMIT,
  NAV_PIN_MIN,
  promoteMoreSelection,
  sanitizeTrackerOrder,
} from '@/components/navigation/tab-pins';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

type TabPinsState = {
  /** Full tracker order — first `pinnedCount` names are In nav. */
  trackerOrder: string[];
  pinnedCount: number;
  setTrackerOrder: (orderedIds: string[], pinnedCount?: number) => void;
  setInNavOrder: (inNav: string[], others: string[]) => void;
  /** Bump a More-list route to the top of More; In nav unchanged. */
  promoteInMore: (routeName: string) => void;
  addToNav: (routeName: string) => void;
  removeFromNav: (routeName: string) => void;
};

export const useTabPins = create<TabPinsState>()(
  persist(
    (set, get) => ({
      trackerOrder: [...DEFAULT_TRACKER_ORDER],
      pinnedCount: DEFAULT_PINNED_COUNT,
      setTrackerOrder: (orderedIds, pinnedCount) => {
        const trackerOrder = sanitizeTrackerOrder(orderedIds);
        set({
          trackerOrder,
          pinnedCount: clampPinnedCount(
            pinnedCount ?? get().pinnedCount,
            trackerOrder.length,
          ),
        });
      },
      setInNavOrder: (inNav, others) => {
        set(mergeTrackerSections(inNav, others));
      },
      promoteInMore: (routeName) => {
        const next = promoteMoreSelection(
          get().trackerOrder,
          routeName,
          get().pinnedCount,
        );
        if (next) set(next);
      },
      addToNav: (routeName) => {
        const trackerOrder = sanitizeTrackerOrder(get().trackerOrder);
        let pinnedCount = clampPinnedCount(
          get().pinnedCount,
          trackerOrder.length,
        );
        const inNav = trackerOrder.slice(0, pinnedCount);
        const others = trackerOrder.slice(pinnedCount);
        if (inNav.includes(routeName)) return;
        if (!others.includes(routeName)) return;
        if (pinnedCount >= NAV_PIN_LIMIT) return;
        const nextOthers = others.filter((name) => name !== routeName);
        set(
          mergeTrackerSections([...inNav, routeName], nextOthers),
        );
      },
      removeFromNav: (routeName) => {
        const trackerOrder = sanitizeTrackerOrder(get().trackerOrder);
        const pinnedCount = clampPinnedCount(
          get().pinnedCount,
          trackerOrder.length,
        );
        if (pinnedCount <= NAV_PIN_MIN) return;
        const inNav = trackerOrder.slice(0, pinnedCount);
        const others = trackerOrder.slice(pinnedCount);
        if (!inNav.includes(routeName)) return;
        set(
          mergeTrackerSections(
            inNav.filter((name) => name !== routeName),
            [routeName, ...others],
          ),
        );
      },
    }),
    {
      name: STORAGE_KEYS.tabPins,
      storage: createPersistStorage(),
      partialize: (state) => ({
        trackerOrder: state.trackerOrder,
        pinnedCount: state.pinnedCount,
      }),
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === 'object'
            ? (persisted as Partial<TabPinsState>)
            : undefined;
        const trackerOrder = sanitizeTrackerOrder(raw?.trackerOrder);
        return {
          ...current,
          trackerOrder,
          pinnedCount: clampPinnedCount(
            raw?.pinnedCount ?? DEFAULT_PINNED_COUNT,
            trackerOrder.length,
          ),
        };
      },
    },
  ),
);
