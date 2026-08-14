import { buildSocialFeedItems, formatSocialActivityTime } from '@/features/social/social-feed-model';
import type { TravelPlan } from '@/features/travel/types';
import type { FriendProfile } from '@/services/friends';

const friend: FriendProfile = {
  userId: 'friend-1',
  displayName: 'Mina',
  friendsSince: '2026-07-01T12:00:00.000Z',
  avatar: { kind: 'initials', color: '#2E7D5A' },
};

function plan(overrides: Partial<TravelPlan> = {}): TravelPlan {
  return {
    id: 'trip-1',
    title: 'Weekend Away',
    destination: 'Portland, Maine',
    startDate: '2026-08-20',
    endDate: '2026-08-23',
    itinerary: [],
    participants: [
      {
        id: 'person-1',
        userId: friend.userId,
        name: 'Mina',
        inviteCode: 'invite-1',
        invitedAt: '2026-07-20T12:00:00.000Z',
      },
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('social feed model', () => {
  it('derives connection and shared-trip activity from existing stores', () => {
    const items = buildSocialFeedItems({
      friends: [friend],
      plans: [plan()],
      self: { userId: 'self', displayName: 'Rocky' },
    });

    expect(items.map((item) => item.kind)).toEqual(['trip', 'connection']);
    expect(items[0]).toMatchObject({ tripId: 'trip-1', scope: 'group' });
    expect(items[1]).toMatchObject({ actor: { userId: friend.userId }, scope: 'friend' });
  });

  it('does not describe a solo trip as shared social activity', () => {
    const items = buildSocialFeedItems({
      friends: [],
      plans: [plan({ participants: [] })],
      self: { userId: 'self', displayName: 'You' },
    });

    expect(items).toEqual([]);
  });

  it('uses a stable fallback for unknown connection dates', () => {
    expect(formatSocialActivityTime('not-a-date')).toBe('Connected');
  });
});
