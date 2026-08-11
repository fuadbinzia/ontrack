import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import type { TravelPlan } from '@/features/travel/types';
import {
  createStandaloneTravelMapVisit,
  createTravelMapVisit,
} from '@/features/travel/map/model';
import { resetPersistBackendForTests } from '@/services/storage';
import { useTravelMap } from '@/store/travel-map';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const plan: TravelPlan = {
  id: 'trip-map', title: 'Atlas Trip', destination: 'Iceland',
  startDate: '2026-09-01', endDate: '2026-09-08', itinerary: [], participants: [],
  baseCurrency: 'USD', expenses: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('travel map store', () => {
  beforeEach(async () => {
    resetPersistBackendForTests();
    await mockAsyncStorage.clear();
    useTravelMap.getState().reset();
  });

  it('creates, updates, and deletes visits with sync mutations', () => {
    const visit = createTravelMapVisit({ plan, countryCode: 'IS', countryName: 'Iceland' });
    expect(useTravelMap.getState().saveVisit(visit)).toBe(true);
    expect(useTravelMap.getState().addPlace(visit.id, {
      id: 'pin-1', label: 'Reykjavík', latitude: 64.1466, longitude: -21.9426,
      createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
    })).toBe(true);
    expect(useTravelMap.getState().visits[0]?.places).toHaveLength(1);
    useTravelMap.getState().removeTrip(plan.id);
    expect(useTravelMap.getState().visits).toEqual([]);
    expect(useTravelMap.getState().pendingMutations.at(-1)).toMatchObject({ type: 'delete', visitId: visit.id });
  });

  it('updates linked preview summaries without moving explicit pins', () => {
    const visit = createTravelMapVisit({
      plan, countryCode: 'IS', countryName: 'Iceland',
      place: { label: 'Reykjavík', latitude: 64.1466, longitude: -21.9426 },
    });
    useTravelMap.getState().saveVisit(visit, { enqueue: false });
    useTravelMap.getState().syncTripSummary({ ...plan, title: 'Edited Trip' });
    expect(useTravelMap.getState().visits[0]?.tripSummary.title).toBe('Edited Trip');
    expect(useTravelMap.getState().visits[0]?.places[0]).toMatchObject({ latitude: 64.1466, longitude: -21.9426 });
  });

  it('saves a standalone pin without creating a trip-backed visit', () => {
    const visit = createStandaloneTravelMapVisit({
      countryCode: 'US',
      countryName: 'United States of America',
      place: { label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
    });

    expect(useTravelMap.getState().saveVisit(visit)).toBe(true);
    expect(useTravelMap.getState().visits[0]).toMatchObject({
      countryCode: 'US',
      places: [{ label: 'Denver' }],
    });
    expect(useTravelMap.getState().visits[0]?.tripId).toBeUndefined();
  });

  it('unpins a place and deletes the visit when it was the last pin', () => {
    const visit = createTravelMapVisit({
      plan, countryCode: 'IS', countryName: 'Iceland',
      place: { label: 'Reykjavík', latitude: 64.1466, longitude: -21.9426 },
    });
    const pinId = visit.places[0]!.id;
    useTravelMap.getState().saveVisit(visit, { enqueue: false });

    useTravelMap.getState().removePlace(visit.id, pinId);

    expect(useTravelMap.getState().visits).toEqual([]);
    expect(useTravelMap.getState().pendingMutations.at(-1)).toMatchObject({
      type: 'delete', visitId: visit.id,
    });
  });

  it('keeps the country visit when another place remains pinned', () => {
    const visit = createTravelMapVisit({
      plan, countryCode: 'IS', countryName: 'Iceland',
      place: { label: 'Reykjavík', latitude: 64.1466, longitude: -21.9426 },
    });
    const firstPinId = visit.places[0]!.id;
    useTravelMap.getState().saveVisit(visit, { enqueue: false });
    useTravelMap.getState().addPlace(visit.id, {
      id: 'pin-vik', label: 'Vík', latitude: 63.4186, longitude: -19.006,
      createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
    });

    useTravelMap.getState().removePlace(visit.id, firstPinId);

    expect(useTravelMap.getState().visits[0]?.places).toHaveLength(1);
    expect(useTravelMap.getState().visits[0]?.places[0]?.label).toBe('Vík');
    expect(useTravelMap.getState().pendingMutations.at(-1)).toMatchObject({ type: 'upsert' });
  });

  it('does not pin the same place twice when a new pin id is generated', () => {
    const visit = createTravelMapVisit({
      plan, countryCode: 'IS', countryName: 'Iceland',
      place: { label: 'Reykjavik', latitude: 64.1466, longitude: -21.9426 },
    });
    useTravelMap.getState().saveVisit(visit, { enqueue: false });
    const mutationCount = useTravelMap.getState().pendingMutations.length;

    const saved = useTravelMap.getState().addPlace(visit.id, {
      id: 'pin-repeat', label: 'Reykjavik, Iceland',
      latitude: 64.1466001, longitude: -21.9426001,
      createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
    });

    expect(saved).toBe(false);
    expect(useTravelMap.getState().visits[0]?.places).toHaveLength(1);
    expect(useTravelMap.getState().pendingMutations).toHaveLength(mutationCount);
  });
});
