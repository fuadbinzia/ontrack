import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import type { TravelPlan } from '@/features/travel/types';
import { resetPersistBackendForTests, STORAGE_KEYS } from '@/services/storage';
import {
  orderTravelPlansByRecency,
  orderTravelPlansForLauncher,
  useTravel,
} from '@/store/travel';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('disabled all-accounts travel test fixture', () => {
  beforeEach(async () => {
    resetPersistBackendForTests();
    await mockAsyncStorage.clear();
    useTravel.getState().reset();
  });

  function trip(id: string): TravelPlan {
    return {
      id,
      title: 'Same trip name',
      destination: 'Boston',
      startDate: '2026-08-04',
      endDate: '2026-08-04',
      itinerary: [],
      participants: [],
      baseCurrency: 'USD',
      expenses: [],
      createdAt: `2026-08-04T12:00:0${id.at(-1)}.000Z`,
      updatedAt: `2026-08-04T12:00:0${id.at(-1)}.000Z`,
    };
  }

  async function persistedTravelPlans(expectedCount: number): Promise<TravelPlan[]> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const raw = await mockAsyncStorage.getItem(STORAGE_KEYS.travel);
      if (raw) {
        const plans = JSON.parse(raw)?.state?.plans;
        if (Array.isArray(plans) && plans.length === expectedCount) return plans;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return [];
  }

  it('is absent from a reset travel store', () => {
    expect(useTravel.getState().plans).not.toContainEqual(ALL_ACCOUNTS_TEST_TRIP);
  });

  it('is removed from existing persisted account trips', async () => {
    await mockAsyncStorage.setItem(
      STORAGE_KEYS.travel,
      JSON.stringify({
        state: {
          plans: [
            {
              ...ALL_ACCOUNTS_TEST_TRIP,
              title: 'Stale test trip',
            },
            {
              ...ALL_ACCOUNTS_TEST_TRIP,
              id: 'trip-personal',
              title: 'Personal trip',
            },
          ],
        },
        version: 0,
      }),
    );

    await useTravel.persist.rehydrate();

    expect(useTravel.getState().plans).toEqual([
      expect.objectContaining({ id: 'trip-personal', title: 'Personal trip' }),
    ]);
  });

  it('stays absent when cloud sync replaces an account with no trips', () => {
    useTravel.getState().replacePlans([]);

    expect(useTravel.getState().plans).toEqual([]);
  });

  it('stores and persists more than two distinct trips with matching details', async () => {
    const plans = [trip('trip-1'), trip('trip-2'), trip('trip-3'), trip('trip-4')];

    expect(plans.map((plan) => useTravel.getState().savePlan(plan))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(useTravel.getState().plans.map((plan) => plan.id)).toEqual([
      'trip-1',
      'trip-2',
      'trip-3',
      'trip-4',
    ]);
    await expect(persistedTravelPlans(plans.length)).resolves.toEqual(
      expect.arrayContaining(plans.map((plan) => expect.objectContaining({ id: plan.id }))),
    );
  });

  it('keeps a trip checklist link when a later save omits packingListId', () => {
    expect(useTravel.getState().savePlan({
      ...trip('trip-1'),
      packingListId: 'checklist-1',
    })).toBe(true);

    expect(useTravel.getState().savePlan(trip('trip-1'))).toBe(true);

    expect(
      useTravel.getState().plans.find((item) => item.id === 'trip-1')?.packingListId,
    ).toBe('checklist-1');
  });

  it('keeps a trip checklist link when cloud replace omits packingListId', () => {
    expect(useTravel.getState().savePlan({
      ...trip('trip-1'),
      packingListId: 'checklist-1',
    })).toBe(true);

    useTravel.getState().replacePlans([trip('trip-1')]);

    expect(
      useTravel.getState().plans.find((item) => item.id === 'trip-1')?.packingListId,
    ).toBe('checklist-1');
  });

  it('reports normalization rejection without changing existing trips', () => {
    expect(useTravel.getState().savePlan(trip('trip-1'))).toBe(true);

    expect(useTravel.getState().savePlan({ id: 'invalid' } as TravelPlan)).toBe(false);
    expect(useTravel.getState().plans.map((plan) => plan.id)).toEqual(['trip-1']);
  });

  it('persists removePlan without the deleted trip', async () => {
    expect(useTravel.getState().savePlan(trip('trip-1'))).toBe(true);
    expect(useTravel.getState().savePlan(trip('trip-2'))).toBe(true);
    useTravel.getState().removePlan('trip-1');

    await expect(persistedTravelPlans(1)).resolves.toEqual([
      expect.objectContaining({ id: 'trip-2' }),
    ]);
  });
});

const plan = (id: string, startDate: string): TravelPlan => ({
  id,
  title: id,
  destination: id,
  startDate,
  endDate: startDate,
  itinerary: [],
  participants: [],
  baseCurrency: 'USD',
  expenses: [],
  createdAt: `${startDate}T00:00:00.000Z`,
  updatedAt: `${startDate}T00:00:00.000Z`,
});

describe('travel trip recency', () => {
  beforeEach(() => useTravel.getState().reset());

  it('keeps untouched trips in date order and promotes interacted trips', () => {
    const later = plan('later', '2026-09-01');
    const sooner = plan('sooner', '2026-08-01');

    expect(orderTravelPlansByRecency([later, sooner], [])).toEqual([sooner, later]);
    expect(orderTravelPlansByRecency([later, sooner], ['later'])).toEqual([later, sooner]);
  });

  it('records a most-recently-used order without changing plan timestamps', () => {
    const first = plan('first', '2026-08-01');
    const second = plan('second', '2026-09-01');
    useTravel.getState().savePlan(first);
    useTravel.getState().savePlan(second);
    const updatedAt = first.updatedAt;

    useTravel.getState().recordPlanInteraction(first.id);

    expect(useTravel.getState().recentPlanIds).toEqual(['first', 'second']);
    expect(useTravel.getState().plans.find((item) => item.id === first.id)?.updatedAt).toBe(updatedAt);
  });

  it('lists upcoming trips before past trips on the launcher', () => {
    const past = plan('past', '2026-06-01');
    const upcoming = plan('upcoming', '2026-09-01');
    const today = '2026-08-07';

    // Past interacted more recently must still stay below upcoming.
    expect(orderTravelPlansForLauncher([past, upcoming], ['past'], today).map((p) => p.id)).toEqual([
      'upcoming',
      'past',
    ]);
  });
});
