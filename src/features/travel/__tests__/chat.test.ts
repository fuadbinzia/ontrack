import {
    applyTravelChatPeerReadAt,
    buildTravelChatListItems,
    isTravelChatMessageMine,
    mergeTravelChatMessages,
    toggleTravelChatReactionLocal,
    travelChatAccessCode,
    travelChatDayLabel,
    travelChatDeliveryStatus,
    type TravelChatMessage,
} from '../chat';
import type { TravelPlan } from '../types';

jest.mock('expo-notifications', () => ({}));

const basePlan: TravelPlan = {
  id: 'trip-1',
  title: 'Lisbon',
  destination: 'Lisbon',
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  itinerary: [],
  participants: [],
  baseCurrency: 'USD',
  expenses: [],
  createdAt: '2026-07-27T12:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
};

function message(
  partial: Pick<TravelChatMessage, 'id' | 'createdAt'> &
    Partial<TravelChatMessage>,
): TravelChatMessage {
  return {
    senderName: 'Sam',
    senderDeviceId: 'device-1',
    body: 'Hello',
    kind: 'text',
    reactions: [],
    ...partial,
  };
}

describe('travel chat access', () => {
  it('uses the capability saved when this member accepted an invitation', () => {
    expect(
      travelChatAccessCode({
        ...basePlan,
        chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
        participants: [
          {
            id: 'person-1',
            name: 'Sam',
            inviteCode: 'bbbbbbbbbbbbbbbbbbbb',
            invitedAt: basePlan.createdAt,
            acceptedAt: basePlan.updatedAt,
          },
        ],
      }),
    ).toBe('aaaaaaaaaaaaaaaaaaaa');
  });

  it('prefers an accepted member capability for a trip organizer', () => {
    expect(
      travelChatAccessCode({
        ...basePlan,
        participants: [
          {
            id: 'pending',
            name: 'Pending',
            inviteCode: 'aaaaaaaaaaaaaaaaaaaa',
            invitedAt: basePlan.createdAt,
          },
          {
            id: 'accepted',
            name: 'Accepted',
            inviteCode: 'bbbbbbbbbbbbbbbbbbbb',
            invitedAt: basePlan.createdAt,
            acceptedAt: basePlan.updatedAt,
          },
        ],
      }),
    ).toBe('bbbbbbbbbbbbbbbbbbbb');
  });

  it('prefers the most recently accepted invite for host chat', () => {
    expect(
      travelChatAccessCode({
        ...basePlan,
        participants: [
          {
            id: 'older',
            name: 'Older Friend',
            inviteCode: 'aaaaaaaaaaaaaaaaaaaa',
            invitedAt: '2026-07-01T12:00:00.000Z',
            acceptedAt: '2026-07-02T12:00:00.000Z',
          },
          {
            id: 'newer',
            name: 'Newer Friend',
            inviteCode: 'bbbbbbbbbbbbbbbbbbbb',
            invitedAt: '2026-07-03T12:00:00.000Z',
            acceptedAt: '2026-07-04T12:00:00.000Z',
          },
        ],
      }),
    ).toBe('bbbbbbbbbbbbbbbbbbbb');
  });

  it('keeps chat closed while every invitation is pending', () => {
    expect(
      travelChatAccessCode({
        ...basePlan,
        participants: [
          {
            id: 'pending',
            name: 'Pending',
            inviteCode: 'aaaaaaaaaaaaaaaaaaaa',
            invitedAt: basePlan.createdAt,
          },
        ],
      }),
    ).toBeUndefined();
  });
});

describe('travel chat day labels', () => {
  const now = new Date(2026, 7, 3, 15, 0, 0); // Aug 3, 2026 local

  it('labels today and yesterday', () => {
    expect(travelChatDayLabel('2026-08-03', now)).toBe('Today');
    expect(travelChatDayLabel('2026-08-02', now)).toBe('Yesterday');
  });

  it('uses weekday + date for older days in the same year', () => {
    expect(travelChatDayLabel('2026-07-27', now)).toBe('Monday, July 27');
  });

  it('includes the year for earlier calendar years', () => {
    expect(travelChatDayLabel('2025-12-25', now)).toBe(
      'Thursday, December 25, 2025',
    );
  });
});

describe('isTravelChatMessageMine', () => {
  it('matches by signed-in user across different devices', () => {
    expect(
      isTravelChatMessageMine(
        message({
          id: 'm1',
          createdAt: '2026-08-06T12:00:00.000Z',
          senderDeviceId: 'iphone',
          senderUserId: 'user-1',
        }),
        { userId: 'user-1', deviceId: 'simulator' },
      ),
    ).toBe(true);
  });

  it('does not treat another account as mine when device ids match', () => {
    expect(
      isTravelChatMessageMine(
        message({
          id: 'm1',
          createdAt: '2026-08-06T12:00:00.000Z',
          senderDeviceId: 'shared-device',
          senderUserId: 'user-a',
        }),
        { userId: 'user-b', deviceId: 'shared-device' },
      ),
    ).toBe(false);
  });

  it('falls back to device id when sender_user_id is missing', () => {
    expect(
      isTravelChatMessageMine(
        message({
          id: 'm1',
          createdAt: '2026-08-06T12:00:00.000Z',
          senderDeviceId: 'device-1',
        }),
        { userId: 'user-1', deviceId: 'device-1' },
      ),
    ).toBe(true);
    expect(
      isTravelChatMessageMine(
        message({
          id: 'm2',
          createdAt: '2026-08-06T12:00:00.000Z',
          senderDeviceId: 'device-1',
        }),
        { userId: 'user-1', deviceId: 'other' },
      ),
    ).toBe(false);
  });
});

describe('buildTravelChatListItems', () => {
  const now = new Date(2026, 7, 3, 15, 0, 0);
  const localIso = (year: number, month: number, day: number, hour = 12) =>
    new Date(year, month - 1, day, hour).toISOString();

  it('inserts one date header per local day', () => {
    const items = buildTravelChatListItems(
      [
        message({ id: 'm1', createdAt: localIso(2026, 8, 2), body: 'Yesterday' }),
        message({ id: 'm2', createdAt: localIso(2026, 8, 3, 10), body: 'Today A' }),
        message({ id: 'm3', createdAt: localIso(2026, 8, 3, 15), body: 'Today B' }),
      ],
      now,
    );

    expect(items.map((item) => item.type)).toEqual([
      'date',
      'message',
      'date',
      'message',
      'message',
    ]);
    expect(items[0]).toMatchObject({ type: 'date', label: 'Yesterday' });
    expect(items[2]).toMatchObject({ type: 'date', label: 'Today' });
    expect(items.filter((item) => item.type === 'message')).toHaveLength(3);
  });

  it('returns an empty list when there are no messages', () => {
    expect(buildTravelChatListItems([])).toEqual([]);
  });
});

describe('travel chat merge / ticks / reactions', () => {
  it('keeps pending optimistic rows that are not on the remote snapshot', () => {
    const remote = [
      message({ id: 'm1', createdAt: '2026-08-06T12:00:00.000Z' }),
    ];
    const current = [
      ...remote,
      {
        ...message({ id: 'pending-1', createdAt: '2026-08-06T12:01:00.000Z' }),
        pending: true,
      },
    ];
    const merged = mergeTravelChatMessages(remote, current);
    expect(merged.map((item) => item.id)).toEqual(['m1', 'pending-1']);
  });

  it('marks delivered messages read once a peer watermark passes createdAt', () => {
    expect(
      travelChatDeliveryStatus({
        createdAt: '2026-08-06T12:00:00.000Z',
        peerLastReadAt: '2026-08-06T12:00:01.000Z',
      }),
    ).toBe('read');
    expect(
      travelChatDeliveryStatus({
        createdAt: '2026-08-06T12:00:00.000Z',
        peerLastReadAt: '2026-08-06T11:59:00.000Z',
      }),
    ).toBe('sent');
    expect(
      travelChatDeliveryStatus({
        createdAt: '2026-08-06T12:00:00.000Z',
        pending: true,
      }),
    ).toBe('pending');
  });

  it('applies peer read watermarks across the list', () => {
    const next = applyTravelChatPeerReadAt(
      [message({ id: 'm1', createdAt: '2026-08-06T12:00:00.000Z' })],
      '2026-08-06T13:00:00.000Z',
    );
    expect(next[0]?.peerLastReadAt).toBe('2026-08-06T13:00:00.000Z');
  });

  it('toggles my reaction and clears a previous emoji', () => {
    const withHeart = toggleTravelChatReactionLocal([], '❤️');
    expect(withHeart).toEqual([{ emoji: '❤️', count: 1, mine: true }]);
    const switched = toggleTravelChatReactionLocal(withHeart, '👍');
    expect(switched).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    const cleared = toggleTravelChatReactionLocal(switched, '👍');
    expect(cleared).toEqual([]);
  });
});
