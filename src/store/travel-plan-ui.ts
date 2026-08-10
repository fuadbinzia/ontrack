import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DetailSectionKey } from '@/features/travel/travel-plan-detail-sections';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

export type TravelPlanUiPrefs = {
  sectionExpanded?: Partial<Record<DetailSectionKey, boolean>>;
  /** Present once the user has toggled any itinerary card. */
  minimizedItemIds?: string[];
  collapsedDayDates?: string[];
  dayCollapseTouched?: string[];
  notesExpanded?: boolean;
};

type TravelPlanUiState = {
  byPlanId: Record<string, TravelPlanUiPrefs>;
  patchPlanUi: (planId: string, patch: Partial<TravelPlanUiPrefs>) => void;
  clearPlanUi: (planId: string) => void;
  retainPlanIds: (planIds: readonly string[]) => void;
};

const DETAIL_SECTION_KEYS = new Set<DetailSectionKey>([
  'tools',
  'transport',
  'flights',
  'ground',
  'stays',
  'rentals',
  'events',
  'timeline',
]);

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const next = [
    ...new Set(
      value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
    ),
  ];
  return next;
}

function asSectionExpanded(
  value: unknown,
): Partial<Record<DetailSectionKey, boolean>> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const next: Partial<Record<DetailSectionKey, boolean>> = {};
  for (const [key, expanded] of Object.entries(value)) {
    if (!DETAIL_SECTION_KEYS.has(key as DetailSectionKey)) continue;
    if (typeof expanded !== 'boolean') continue;
    next[key as DetailSectionKey] = expanded;
  }
  return Object.keys(next).length ? next : undefined;
}

export function normalizeTravelPlanUiPrefs(value: unknown): TravelPlanUiPrefs {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const prefs: TravelPlanUiPrefs = {};
  const sectionExpanded = asSectionExpanded(raw.sectionExpanded);
  if (sectionExpanded) prefs.sectionExpanded = sectionExpanded;
  const minimizedItemIds = asStringArray(raw.minimizedItemIds);
  if (minimizedItemIds) prefs.minimizedItemIds = minimizedItemIds;
  const collapsedDayDates = asStringArray(raw.collapsedDayDates);
  if (collapsedDayDates) prefs.collapsedDayDates = collapsedDayDates;
  const dayCollapseTouched = asStringArray(raw.dayCollapseTouched);
  if (dayCollapseTouched) prefs.dayCollapseTouched = dayCollapseTouched;
  if (typeof raw.notesExpanded === 'boolean') {
    prefs.notesExpanded = raw.notesExpanded;
  }
  return prefs;
}

function normalizeByPlanId(value: unknown): Record<string, TravelPlanUiPrefs> {
  if (!value || typeof value !== 'object') return {};
  const next: Record<string, TravelPlanUiPrefs> = {};
  for (const [planId, prefs] of Object.entries(value)) {
    if (typeof planId !== 'string' || !planId) continue;
    next[planId] = normalizeTravelPlanUiPrefs(prefs);
  }
  return next;
}

export const useTravelPlanUi = create<TravelPlanUiState>()(
  persist(
    (set) => ({
      byPlanId: {},
      patchPlanUi: (planId, patch) => {
        if (!planId) return;
        set((state) => {
          const current = state.byPlanId[planId] ?? {};
          const merged = normalizeTravelPlanUiPrefs({ ...current, ...patch });
          return {
            byPlanId: {
              ...state.byPlanId,
              [planId]: merged,
            },
          };
        });
      },
      clearPlanUi: (planId) => {
        if (!planId) return;
        set((state) => {
          if (!(planId in state.byPlanId)) return state;
          const { [planId]: _removed, ...byPlanId } = state.byPlanId;
          return { byPlanId };
        });
      },
      retainPlanIds: (planIds) => {
        const keep = new Set(planIds);
        set((state) => {
          let changed = false;
          const byPlanId: Record<string, TravelPlanUiPrefs> = {};
          for (const [planId, prefs] of Object.entries(state.byPlanId)) {
            if (!keep.has(planId)) {
              changed = true;
              continue;
            }
            byPlanId[planId] = prefs;
          }
          return changed ? { byPlanId } : state;
        });
      },
    }),
    {
      name: STORAGE_KEYS.travelPlanUi,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TravelPlanUiState> | undefined;
        return {
          ...currentState,
          byPlanId: normalizeByPlanId(persisted?.byPlanId),
        };
      },
    },
  ),
);
