import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEFAULT_TRAVEL_MAP_SETTINGS,
  normalizeTravelMapSettings,
  normalizeTravelMapVisit,
  normalizeTravelMapVisits,
} from '@/features/travel/map/normalize';
import type {
  TravelMapPlacePin,
  TravelMapSettings,
  TravelMapVisit,
} from '@/features/travel/map/types';
import {
  isSameTravelMapPlace,
  syncTravelMapVisitSummary,
} from '@/features/travel/map/model';
import type { TravelPlan } from '@/features/travel/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { newUuid } from '@/utils/id';

export type TravelMapMutation =
  | { id: string; createdAt: string; type: 'upsert'; visit: TravelMapVisit }
  | { id: string; createdAt: string; type: 'delete'; visitId: string };

interface TravelMapState {
  visits: TravelMapVisit[];
  settings: TravelMapSettings;
  pendingMutations: TravelMapMutation[];
  saveVisit: (visit: TravelMapVisit, options?: { enqueue?: boolean }) => boolean;
  removeVisit: (visitId: string, options?: { enqueue?: boolean }) => void;
  addPlace: (visitId: string, pin: TravelMapPlacePin) => boolean;
  removePlace: (visitId: string, pinId: string) => void;
  removeTrip: (tripId: string) => void;
  syncTripSummary: (plan: TravelPlan) => void;
  replaceVisits: (visits: TravelMapVisit[]) => void;
  clearPendingMutations: (ids: string[]) => void;
  setShareWithFriends: (enabled: boolean) => void;
  setSelectedFriendIds: (ids: string[]) => void;
  dismissSuggestion: (fingerprint: string) => void;
  reset: () => void;
}

type TravelMapMutationInput =
  | { type: 'upsert'; visit: TravelMapVisit }
  | { type: 'delete'; visitId: string };

function mutation(op: TravelMapMutationInput): TravelMapMutation {
  return {
    ...op,
    id: newUuid(),
    createdAt: new Date().toISOString(),
  } as TravelMapMutation;
}

export const useTravelMap = create<TravelMapState>()(
  persist(
    (set) => ({
      visits: [],
      settings: DEFAULT_TRAVEL_MAP_SETTINGS,
      pendingMutations: [],
      saveVisit: (visit, options) => {
        const normalized = normalizeTravelMapVisit(visit);
        if (!normalized) return false;
        set((state) => ({
          visits: [...state.visits.filter((entry) => entry.id !== normalized.id), normalized],
          pendingMutations:
            options?.enqueue === false
              ? state.pendingMutations
              : [...state.pendingMutations, mutation({ type: 'upsert', visit: normalized })],
        }));
        return true;
      },
      removeVisit: (visitId, options) =>
        set((state) => ({
          visits: state.visits.filter((visit) => visit.id !== visitId),
          pendingMutations:
            options?.enqueue === false
              ? state.pendingMutations
              : [...state.pendingMutations, mutation({ type: 'delete', visitId })],
        })),
      addPlace: (visitId, pin) => {
        let saved = false;
        set((state) => {
          const current = state.visits.find((visit) => visit.id === visitId);
          if (!current) return state;
          if (current.places.some((entry) => isSameTravelMapPlace(entry, pin))) {
            return state;
          }
          const next = normalizeTravelMapVisit({
            ...current,
            places: [...current.places.filter((entry) => entry.id !== pin.id), pin],
            updatedAt: new Date().toISOString(),
          });
          if (!next) return state;
          saved = true;
          return {
            visits: [...state.visits.filter((visit) => visit.id !== visitId), next],
            pendingMutations: [
              ...state.pendingMutations,
              mutation({ type: 'upsert', visit: next }),
            ],
          };
        });
        return saved;
      },
      removePlace: (visitId, pinId) =>
        set((state) => {
          const current = state.visits.find((visit) => visit.id === visitId);
          if (!current) return state;
          const places = current.places.filter((pin) => pin.id !== pinId);
          if (places.length === current.places.length) return state;
          if (places.length === 0) {
            return {
              visits: state.visits.filter((visit) => visit.id !== visitId),
              pendingMutations: [
                ...state.pendingMutations,
                mutation({ type: 'delete', visitId }),
              ],
            };
          }
          const next = {
            ...current,
            places,
            updatedAt: new Date().toISOString(),
          };
          return {
            visits: [...state.visits.filter((visit) => visit.id !== visitId), next],
            pendingMutations: [
              ...state.pendingMutations,
              mutation({ type: 'upsert', visit: next }),
            ],
          };
        }),
      removeTrip: (tripId) =>
        set((state) => {
          const removed = state.visits.filter((visit) => visit.tripId === tripId);
          if (removed.length === 0) return state;
          return {
            visits: state.visits.filter((visit) => visit.tripId !== tripId),
            pendingMutations: [
              ...state.pendingMutations,
              ...removed.map((visit) => mutation({ type: 'delete', visitId: visit.id })),
            ],
          };
        }),
      syncTripSummary: (plan) =>
        set((state) => {
          const changed = state.visits
            .filter((visit) => visit.tripId === plan.id)
            .map((visit) => syncTravelMapVisitSummary(visit, plan))
            .filter((visit) => state.visits.find((current) => current.id === visit.id) !== visit);
          if (changed.length === 0) return state;
          const changedById = new Map(changed.map((visit) => [visit.id, visit]));
          return {
            visits: state.visits.map((visit) => changedById.get(visit.id) ?? visit),
            pendingMutations: [
              ...state.pendingMutations,
              ...changed.map((visit) => mutation({ type: 'upsert', visit })),
            ],
          };
        }),
      replaceVisits: (visits) => set({ visits: normalizeTravelMapVisits(visits) }),
      clearPendingMutations: (ids) =>
        set((state) => ({
          pendingMutations: state.pendingMutations.filter((entry) => !ids.includes(entry.id)),
        })),
      setShareWithFriends: (enabled) =>
        set((state) => ({
          settings: { ...state.settings, shareWithFriends: enabled },
        })),
      setSelectedFriendIds: (ids) =>
        set((state) => ({
          settings: {
            ...state.settings,
            selectedFriendIds: [...new Set(ids.filter(Boolean))],
          },
        })),
      dismissSuggestion: (fingerprint) =>
        set((state) => ({
          settings: normalizeTravelMapSettings({
            ...state.settings,
            dismissedSuggestionFingerprints: [
              ...state.settings.dismissedSuggestionFingerprints,
              fingerprint,
            ],
          }),
        })),
      reset: () =>
        set({
          visits: [],
          settings: DEFAULT_TRAVEL_MAP_SETTINGS,
          pendingMutations: [],
        }),
    }),
    {
      name: STORAGE_KEYS.travelMap,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TravelMapState>;
        return {
          ...currentState,
          ...persisted,
          visits: normalizeTravelMapVisits(persisted.visits),
          settings: normalizeTravelMapSettings(persisted.settings),
          pendingMutations: Array.isArray(persisted.pendingMutations)
            ? persisted.pendingMutations
            : [],
        };
      },
      partialize: (state) =>
        ({
          visits: state.visits,
          settings: state.settings,
          pendingMutations: state.pendingMutations,
        }) as TravelMapState,
    },
  ),
);
