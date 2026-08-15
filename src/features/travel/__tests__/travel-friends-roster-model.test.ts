import {
  filterTravelFriendsVisibleParticipants,
  pruneRevokedTravelParticipants,
  travelParticipantMatchesRosterMember,
} from '@/features/travel/travel-friends-roster-model';
import type {
  TravelParticipant,
  TravelTripRosterPerson,
} from '@/features/travel/types';

const accepted: TravelParticipant = {
  id: 'participant-1',
  name: 'Alex Rivera',
  inviteCode: 'invite-1',
  invitedAt: '2026-08-01T00:00:00.000Z',
  acceptedAt: '2026-08-02T00:00:00.000Z',
};

const rosterMember: TravelTripRosterPerson = {
  userId: 'user-1',
  displayName: 'Alex Rivera',
  inviteCode: 'invite-1',
  acceptedAt: '2026-08-02T00:00:00.000Z',
  role: 'cohost',
};

describe('travel friends roster identity', () => {
  it('deduplicates an older accepted invite when roster email is private', () => {
    expect(
      filterTravelFriendsVisibleParticipants({
        participants: [{ ...accepted, inviteCode: 'older-invite' }],
        hostPerson: { name: 'Taylor Morgan', isSelf: true },
        roster: [rosterMember],
        memberPlan: false,
      }),
    ).toEqual([]);
  });

  it('does not merge distinct roster travelers who share a display name', () => {
    expect(
      filterTravelFriendsVisibleParticipants({
        participants: [{ ...accepted, inviteCode: 'older-invite' }],
        hostPerson: { name: 'Taylor Morgan', isSelf: true },
        roster: [
          rosterMember,
          { ...rosterMember, userId: 'user-2', inviteCode: 'invite-2' },
        ],
        memberPlan: false,
      }),
    ).toHaveLength(1);
  });

  it('matches by user id or normalized email as surrounding identity paths', () => {
    expect(
      travelParticipantMatchesRosterMember(
        { ...accepted, inviteCode: 'old-invite', userId: 'user-1' },
        rosterMember,
      ),
    ).toBe(true);
    expect(
      travelParticipantMatchesRosterMember(
        { ...accepted, inviteCode: 'old-invite', email: ' ALEX@EXAMPLE.COM ' },
        { ...rosterMember, inviteCode: 'new-invite', email: 'alex@example.com' },
      ),
    ).toBe(true);
  });

  it('keeps pending invites while pruning revoked accepted duplicates', () => {
    const pending = {
      ...accepted,
      id: 'participant-pending',
      inviteCode: 'pending-invite',
      acceptedAt: undefined,
    };
    const otherAccepted = {
      ...accepted,
      id: 'participant-other',
      inviteCode: 'live-invite',
    };
    expect(
      pruneRevokedTravelParticipants({
        participants: [accepted, pending, otherAccepted],
        inviteStatuses: {
          'live-invite': '2026-08-02T00:00:00.000Z',
        },
        roster: [],
      }),
    ).toEqual([pending, otherAccepted]);
  });

  it('keeps an accepted local row while its traveler remains on the roster', () => {
    expect(
      pruneRevokedTravelParticipants({
        participants: [accepted],
        inviteStatuses: {},
        roster: [rosterMember],
      }),
    ).toEqual([accepted]);
  });
});
