import {
  sharedUpcomingTrips,
  socialTripMemberships,
} from '@/features/social/social-trip-membership';
import type { TravelPlan } from '@/features/travel/types';
import type { FriendProfile } from '@/services/friends';

const friend: FriendProfile = {
  userId: 'jordan',
  displayName: 'Jordan Lee',
  avatar: { kind: 'initials', color: '#2E7D5A' },
};

function plan(overrides: Partial<TravelPlan> = {}): TravelPlan {
  return {
    id: 'trip-iceland',
    title: 'Iceland',
    destination: 'Iceland',
    startDate: '2026-08-20',
    endDate: '2026-08-27',
    itinerary: [],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-08-02T15:22:07.010Z',
    ...overrides,
  };
}

describe('social trip membership', () => {
  it('recognizes an accepted trip participant by opaque user id', () => {
    const iceland = plan({
      participants: [
        {
          id: 'participant-jordan',
          userId: friend.userId,
          name: 'Jordan Lee',
          inviteCode: 'invite-jordan',
          invitedAt: '2026-08-01T12:00:00.000Z',
          acceptedAt: '2026-08-02T15:22:07.010Z',
        },
      ],
    });

    expect(socialTripMemberships(friend, [iceland])).toEqual([
      { plan: iceland, status: 'member' },
    ]);
  });

  it('keeps an unaccepted participant labeled as invited', () => {
    const iceland = plan({
      participants: [
        {
          id: 'participant-jordan',
          userId: friend.userId,
          name: 'Jordan Lee',
          inviteCode: 'invite-jordan',
          invitedAt: '2026-08-01T12:00:00.000Z',
        },
      ],
    });

    expect(socialTripMemberships(friend, [iceland])).toEqual([
      { plan: iceland, status: 'invited' },
    ]);
  });

  it('recognizes the host on a joined member copy by host display name', () => {
    const hostTrip = plan({
      id: 'trip-local-copy',
      hostTripId: 'trip-host-iceland',
      hostDisplayName: ' JORDAN LEE ',
    });

    expect(socialTripMemberships(friend, [hostTrip])).toEqual([
      { plan: hostTrip, status: 'member' },
    ]);
  });

  it('does not use a host-name fallback on the canonical host plan', () => {
    const unrelatedTrip = plan({
      hostTripId: 'trip-iceland',
      hostDisplayName: friend.displayName,
    });

    expect(socialTripMemberships(friend, [unrelatedTrip])).toEqual([]);
  });

  it('only includes shared or member-copy trips in upcoming together', () => {
    const solo = plan({ id: 'solo', endDate: '2026-08-30' });
    const shared = plan({
      id: 'shared',
      startDate: '2026-08-21',
      endDate: '2026-08-22',
      participants: [{ id: 'mina', name: 'Mina', inviteCode: 'invite', invitedAt: '2026-08-01' }],
    });
    const memberCopy = plan({
      id: 'member',
      endDate: '2026-08-25',
      chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
    });
    const pastShared = plan({
      id: 'past',
      endDate: '2026-08-10',
      participants: [{ id: 'mina', name: 'Mina', inviteCode: 'invite', invitedAt: '2026-08-01' }],
    });

    expect(sharedUpcomingTrips([solo, memberCopy, pastShared, shared], '2026-08-20')).toEqual([
      memberCopy,
      shared,
    ]);
  });
});
