import { markInviteSnapshotItinerary } from '@/features/travel/itinerary-visibility';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import {
  itineraryItemIdsToDelete,
  itemsForPublish,
  mergeItinerarySnapshot,
  parseRemoteItineraryItem,
  publishTravelTripItinerary,
} from '../itinerary-collaboration';

const mockRpc = jest.fn();
const mockSavePlan = jest.fn();

jest.mock('@/services/travel/travel-collaboration-shared', () => {
  const actual = jest.requireActual('@/services/travel/travel-collaboration-shared');
  return {
    ...actual,
    authenticatedTravelCollaborationClient: jest.fn(async () => ({
      client: { rpc: (...args: unknown[]) => mockRpc(...args) },
      userId: 'user-me',
    })),
  };
});

jest.mock('@/store/travel', () => ({
  useTravel: {
    getState: () => ({ savePlan: mockSavePlan, plans: [] }),
  },
}));

function planWith(
  itinerary: TravelItineraryItem[],
  overrides: Partial<TravelPlan> = {},
): TravelPlan {
  return {
    id: 'trip-local',
    title: 'Iceland',
    destination: 'Iceland',
    startDate: '2026-09-08',
    endDate: '2026-09-13',
    itinerary,
    participants: [{ id: 'p1', name: 'Jordan', inviteCode: 'x', invitedAt: '2026-08-01T00:00:00.000Z' }],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function item(
  overrides: Partial<TravelItineraryItem> & Pick<TravelItineraryItem, 'id'>,
): TravelItineraryItem {
  return {
    kind: 'flight',
    title: 'Flight',
    date: '2026-09-08',
    startMinutes: 600,
    durationMinutes: 180,
    shareMode: 'trip',
    flight: {
      airline: 'AA',
      flightNumber: '1',
      confirmationCode: 'SECRET',
      seat: '1A',
    },
    ...overrides,
  };
}

describe('itinerary collaboration merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps owned items and drops peer items that are no longer shared', () => {
    const local = planWith([
      item({ id: 'mine', ownerUserId: 'user-me', shareMode: 'trip' }),
      item({
        id: 'peer-gone',
        ownerUserId: 'user-host',
        shareMode: 'trip',
        title: 'Old peer flight',
      }),
    ]);
    const merged = mergeItinerarySnapshot(
      local,
      {
        tripId: 'trip-host',
        items: [
          item({
            id: 'peer-kept',
            ownerUserId: 'user-host',
            shareMode: 'trip',
            title: 'Shared stay',
            kind: 'stay',
          }),
        ],
      },
      'user-me',
    );
    expect(merged.hostTripId).toBe('trip-host');
    expect(merged.itinerary.map((row) => row.id).sort()).toEqual([
      'mine',
      'peer-kept',
    ]);
    expect(merged.itinerary.find((row) => row.id === 'mine')?.flight?.confirmationCode).toBe(
      'SECRET',
    );
    expect(merged.packingListId).toBeUndefined();
  });

  it('keeps a trip checklist link while merging a remote itinerary', () => {
    const local = planWith([], { packingListId: 'checklist-1' });
    const merged = mergeItinerarySnapshot(
      local,
      { tripId: 'trip-host', items: [] },
      'user-me',
    );
    expect(merged.packingListId).toBe('checklist-1');
  });

  it('publishes compact owned payloads without booking secrets', () => {
    const rows = itemsForPublish(
      planWith([
        item({
          id: 'mine',
          ownerUserId: 'user-me',
          shareMode: 'trip',
          bookingUrl: 'https://example.com',
        }),
        item({
          id: 'peer',
          ownerUserId: 'user-host',
          shareMode: 'trip',
        }),
      ]),
      'user-me',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.flight?.confirmationCode).toBeUndefined();
    expect(rows[0]?.payload.flight?.seat).toBeUndefined();
    expect(rows[0]?.payload.bookingUrl).toBeUndefined();
    expect(rows[0]?.shareMode).toBe('trip');
  });

  it('lets a co-host publish edits to every trip itinerary item', () => {
    const rows = itemsForPublish(
      planWith([
        item({ id: 'mine', ownerUserId: 'user-me' }),
        item({ id: 'hosts', ownerUserId: 'user-host', title: 'Updated flight' }),
      ]),
      'user-me',
      true,
    );

    expect(rows.map((row) => row.itemId)).toEqual(['mine', 'hosts']);
    expect(rows[1]?.payload).toMatchObject({
      ownerUserId: 'user-host',
      title: 'Updated flight',
    });
  });

  it('does not let a stale co-host snapshot delete a peer item implicitly', () => {
    expect(
      itineraryItemIdsToDelete({
        remoteItems: [item({ id: 'peer-new', ownerUserId: 'user-peer' })],
        localItemIds: new Set(),
        localUserId: 'user-me',
        canManageTrip: true,
      }),
    ).toEqual([]);
  });

  it('lets a co-host explicitly delete another traveler’s itinerary item', () => {
    expect(
      itineraryItemIdsToDelete({
        remoteItems: [item({ id: 'peer-stop', ownerUserId: 'user-peer' })],
        localItemIds: new Set(),
        localUserId: 'user-me',
        canManageTrip: true,
        explicitlyDeletedIds: ['peer-stop'],
      }),
    ).toEqual(['peer-stop']);
  });

  it('marks invite snapshot items as trip-shared for the host', () => {
    const stamped = markInviteSnapshotItinerary(
      [item({ id: 'host-flight' })],
      'host-user-id',
    );
    expect(stamped[0]).toMatchObject({
      ownerUserId: 'host-user-id',
      shareMode: 'trip',
    });
  });

  it('parses remote RPC rows into itinerary items', () => {
    const parsed = parseRemoteItineraryItem({
      itemId: 'item-9',
      ownerUserId: 'user-host',
      shareMode: 'trip',
      updatedAt: '2026-08-07T12:00:00.000Z',
      payload: {
        id: 'item-9',
        kind: 'activity',
        title: 'Hike',
        date: '2026-09-09',
        startMinutes: 600,
        durationMinutes: 120,
      },
    });
    expect(parsed).toMatchObject({
      id: 'item-9',
      ownerUserId: 'user-host',
      shareMode: 'trip',
      sharedUpdatedAt: '2026-08-07T12:00:00.000Z',
      title: 'Hike',
    });
  });

  it('collapses legacy selected remote rows to trip', () => {
    const parsed = parseRemoteItineraryItem({
      itemId: 'item-legacy',
      ownerUserId: 'user-host',
      shareMode: 'selected',
      sharedWithUserIds: ['user-me'],
      updatedAt: '2026-08-07T12:00:00.000Z',
      payload: {
        id: 'item-legacy',
        kind: 'activity',
        title: 'Museum',
        date: '2026-09-09',
        startMinutes: 600,
        durationMinutes: 90,
      },
    });
    expect(parsed?.shareMode).toBe('trip');
  });

  it('asks the server whether the actor can manage peer itinerary items before publishing', async () => {
    const peerItem = item({ id: 'peer-stop', ownerUserId: 'user-peer' });
    const plan = planWith([peerItem], { hostTripId: 'trip-host' });
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'is_travel_trip_manager') return { data: true, error: null };
      if (name === 'upsert_travel_trip_itinerary_items') return { data: null, error: null };
      if (name === 'fetch_travel_trip_itinerary') {
        return {
          data: { tripId: 'trip-host', items: [peerItem] },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await expect(publishTravelTripItinerary(plan)).resolves.toMatchObject({
      tripId: 'trip-host',
      items: [expect.objectContaining({ id: 'peer-stop' })],
    });

    expect(mockRpc).toHaveBeenCalledWith('is_travel_trip_manager', {
      requested_trip_id: 'trip-host',
    });
    expect(mockRpc).toHaveBeenCalledWith('upsert_travel_trip_itinerary_items', {
      requested_trip_id: 'trip-host',
      requested_items: [expect.objectContaining({ itemId: 'peer-stop' })],
    });
  });

  it('keeps peer items out of the publish payload when the manager RPC denies access', async () => {
    const peerItem = item({ id: 'peer-stop', ownerUserId: 'user-peer' });
    const plan = planWith([peerItem], { hostTripId: 'trip-host' });
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'is_travel_trip_manager') return { data: false, error: null };
      if (name === 'upsert_travel_trip_itinerary_items') return { data: null, error: null };
      if (name === 'fetch_travel_trip_itinerary') {
        return { data: { tripId: 'trip-host', items: [] }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await publishTravelTripItinerary(plan);

    expect(mockRpc).toHaveBeenCalledWith('upsert_travel_trip_itinerary_items', {
      requested_trip_id: 'trip-host',
      requested_items: [],
    });
  });
});
