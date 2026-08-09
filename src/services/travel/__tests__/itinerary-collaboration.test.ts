import { markInviteSnapshotItinerary } from '@/features/travel/itinerary-visibility';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import {
  itemsForPublish,
  mergeItinerarySnapshot,
  parseRemoteItineraryItem,
} from '../itinerary-collaboration';

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
});
