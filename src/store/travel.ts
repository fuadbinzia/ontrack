import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  ALL_ACCOUNTS_TEST_TRIP,
  withAllAccountsTestTrip,
} from '@/constants/travel';
import { featureFlags } from '@/constants/feature-flags';
import { flushCloudDomain } from '@/services/cloud/sync-session';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { normalizeTravelPlan, normalizeTravelPlans } from '@/features/travel/normalize';
import type { TravelPlan } from '@/features/travel/types';
import { useDevMode } from '@/store/dev-mode';
import { useSchedule } from '@/store/schedule';
import { useTravelPlanUi } from '@/store/travel-plan-ui';
import { useTravelMap } from '@/store/travel-map';

/** Prevent Dev Mode exit / agent settle from resurrecting a deleted trip. */
function forgetPlanInDevModeSnapshot(planId: string) {
  const { enabled, liveSnapshot } = useDevMode.getState();
  if (!enabled || !liveSnapshot) return;
  const travel = liveSnapshot.domains.travel;
  if (!travel || !Array.isArray(travel.plans)) return;
  const nextPlans = travel.plans.filter(
    (entry) =>
      !(
        entry &&
        typeof entry === 'object' &&
        'id' in entry &&
        (entry as { id?: unknown }).id === planId
      ),
  );
  if (nextPlans.length === travel.plans.length) return;
  useDevMode.getState().setLiveSnapshot({
    ...liveSnapshot,
    domains: {
      ...liveSnapshot.domains,
      travel: { ...travel, plans: nextPlans },
    },
  });
}

interface TravelState {
  plans: TravelPlan[];
  /** Device-local MRU order; opening a trip must not mutate shared plan data. */
  recentPlanIds: string[];
  recordPlanInteraction: (id: string) => void;
  /** Returns false when normalization rejects the plan and nothing is stored. */
  savePlan: (plan: TravelPlan) => boolean;
  removePlan: (id: string) => void;
  replacePlans: (plans: TravelPlan[]) => void;
  reset: () => void;
}

export const useTravel = create<TravelState>()(
  persist(
    (set, get) => ({
      plans: withAllAccountsTestTrip([]),
      recentPlanIds: [],
      recordPlanInteraction: (id) =>
        set((state) => {
          if (!state.plans.some((plan) => plan.id === id)) return state;
          if (state.recentPlanIds[0] === id) return state;
          return {
            recentPlanIds: [
              id,
              ...state.recentPlanIds.filter(
                (planId) => planId !== id && state.plans.some((plan) => plan.id === planId),
              ),
            ],
          };
        }),
      savePlan: (plan) => {
        const normalized = normalizeTravelPlan(plan);
        if (!normalized) return false;
        set((state) => {
          return {
            plans: [
              ...state.plans.filter((item) => item.id !== normalized.id),
              normalized,
            ],
            recentPlanIds: [
              normalized.id,
              ...state.recentPlanIds.filter((id) => id !== normalized.id),
            ],
          };
        });
        useTravelMap.getState().syncTripSummary(normalized);
        return true;
      },
      removePlan: (id) => {
        const keepPlan =
          id === ALL_ACCOUNTS_TEST_TRIP.id && featureFlags.allAccountsTestTrip;
        set((state) => ({
          plans: keepPlan ? state.plans : state.plans.filter((item) => item.id !== id),
          recentPlanIds: state.recentPlanIds.filter((planId) => planId !== id),
        }));
        if (!keepPlan) {
          useSchedule.getState().removeTravelActivities([id]);
          useTravelPlanUi.getState().clearPlanUi(id);
          useTravelMap.getState().removeTrip(id);
          // Dev Mode restore merges snapshot∪sandbox adds — without this, a
          // deleted live trip comes back on exit / agent cold-start settle.
          forgetPlanInDevModeSnapshot(id);
          // Skip the 1.2s+ debounce so reload cannot pull a pre-delete cloud row.
          void flushCloudDomain('travel');
        }
      },
      replacePlans: (plans) => {
        const nextPlans = withAllAccountsTestTrip(normalizeTravelPlans(plans));
        const nextIds = new Set(nextPlans.map((plan) => plan.id));
        const droppedIds = get()
          .plans.map((plan) => plan.id)
          .filter((id) => !nextIds.has(id));
        set((state) => ({
          plans: nextPlans,
          recentPlanIds: state.recentPlanIds.filter((id) => nextIds.has(id)),
        }));
        useSchedule.getState().removeTravelActivities(droppedIds);
        useTravelPlanUi.getState().retainPlanIds([...nextIds]);
        for (const plan of nextPlans) useTravelMap.getState().syncTripSummary(plan);
        for (const id of droppedIds) useTravelMap.getState().removeTrip(id);
      },
      reset: () => {
        set({ plans: withAllAccountsTestTrip([]), recentPlanIds: [] });
        useTravelPlanUi
          .getState()
          .retainPlanIds(
            withAllAccountsTestTrip([]).map((plan) => plan.id),
          );
        useTravelMap.getState().reset();
      },
    }),
    {
      name: STORAGE_KEYS.travel,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TravelState>;
        const plans = withAllAccountsTestTrip(normalizeTravelPlans(persisted.plans));
        const planIds = new Set(plans.map((plan) => plan.id));
        return {
          ...currentState,
          ...persisted,
          plans,
          recentPlanIds: Array.isArray(persisted.recentPlanIds)
            ? [...new Set(persisted.recentPlanIds)].filter(
                (id): id is string => typeof id === 'string' && planIds.has(id),
              )
            : [],
        };
      },
    },
  ),
);

export function orderTravelPlansByRecency(
  plans: TravelPlan[],
  recentPlanIds: readonly string[],
): TravelPlan[] {
  const rank = new Map(recentPlanIds.map((id, index) => [id, index]));
  return [...plans].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);
    if (aRank !== undefined || bRank !== undefined) {
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    }
    return a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt);
  });
}

/** Current/upcoming trips first (endDate ≥ today), then past — each bucket keeps recency order. */
export function orderTravelPlansForLauncher(
  plans: TravelPlan[],
  recentPlanIds: readonly string[],
  today: string,
): TravelPlan[] {
  const sorted = orderTravelPlansByRecency(plans, recentPlanIds);
  const current: TravelPlan[] = [];
  const past: TravelPlan[] = [];
  for (const plan of sorted) {
    if (plan.endDate >= today) current.push(plan);
    else past.push(plan);
  }
  return [...current, ...past];
}
