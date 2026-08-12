import { create } from 'zustand';

import { todayKey } from '@/utils/date';

/** Ephemeral UI state — deliberately not persisted. */
interface UIState {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  activeWorkoutActivityId: string | null;
  setActiveWorkout: (activityId: string | null) => void;
  carouselBrowse: {
    anchorRouteName: string;
    centerRouteName: string;
  } | null;
  setCarouselBrowse: (
    browse: UIState['carouselBrowse'],
  ) => void;
  carouselSwipeClaimed: boolean;
  setCarouselSwipeClaimed: (claimed: boolean) => void;
  carouselPendingRouteName: string | null;
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
  /**
   * Open modal-sheet count (SheetScaffold). While > 0 the tab dock hides so
   * its labels never bleed through translucent sheet glass near the bottom.
   */
  modalSheetCount: number;
  beginModalSheet: () => void;
  endModalSheet: () => void;
  /**
   * Legacy collapse flag — nav stays locked open; kept so older callers /
   * fixtures that force-expand remain harmless no-ops when set false.
   */
  tabBarCollapsed: boolean;
  setTabBarCollapsed: (collapsed: boolean) => void;
  /** Epoch ms of last user page interaction — used to pause cloud sync briefly. */
  lastPageInteractionAt: number;
  notifyPageInteraction: () => void;
}

export const useUI = create<UIState>((set) => ({
  selectedDate: todayKey(),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  activeWorkoutActivityId: null,
  setActiveWorkout: (activeWorkoutActivityId) => set({ activeWorkoutActivityId }),
  carouselBrowse: null,
  setCarouselBrowse: (carouselBrowse) => set({ carouselBrowse }),
  carouselSwipeClaimed: false,
  setCarouselSwipeClaimed: (carouselSwipeClaimed) =>
    set({ carouselSwipeClaimed }),
  carouselPendingRouteName: null,
  tabBarHeight: 0,
  setTabBarHeight: (tabBarHeight) => set({ tabBarHeight }),
  modalSheetCount: 0,
  beginModalSheet: () =>
    set((state) => ({ modalSheetCount: state.modalSheetCount + 1 })),
  endModalSheet: () =>
    set((state) => ({ modalSheetCount: Math.max(0, state.modalSheetCount - 1) })),
  tabBarCollapsed: false,
  setTabBarCollapsed: (tabBarCollapsed) => set({ tabBarCollapsed }),
  lastPageInteractionAt: 0,
  notifyPageInteraction: () =>
    set({
      carouselBrowse: null,
      carouselSwipeClaimed: false,
      carouselPendingRouteName: null,
      lastPageInteractionAt: Date.now(),
    }),
}));
