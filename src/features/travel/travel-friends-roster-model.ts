import type {
  TravelParticipant,
  TravelPlan,
  TravelTripRosterPerson,
} from '@/features/travel/types';
import { isTravelExpenseMemberId } from '@/services/travel/expense-collaboration';

export type TravelFriendsHostPerson = {
  name: string;
  email?: string;
  isSelf: boolean;
  userId?: string;
};

/** Roster members from server, or expense-sync fallback before roster RPC exists. */
export function resolveTravelFriendsRosterMembers({
  roster,
  plan,
  selfUserId,
}: {
  roster: TravelTripRosterPerson[];
  plan: TravelPlan;
  selfUserId?: string;
}): TravelTripRosterPerson[] {
  const fromServer = roster.filter(
    (person) => person.role === 'member' || person.role === 'cohost',
  );
  if (fromServer.length > 0) return fromServer;
  // Fallback before list_travel_trip_roster is available: expense sync
  // stores accepted friends as member:<auth_uid>.
  const byUserId = new Map<string, TravelTripRosterPerson>();
  for (const person of plan.sharedExpensePeople ?? []) {
    if (!isTravelExpenseMemberId(person.id)) continue;
    const userId = person.id.slice('member:'.length);
    if (!userId || (selfUserId && userId === selfUserId)) continue;
    const match = plan.participants.find(
      (participant) =>
        Boolean(participant.acceptedAt) &&
        participant.name.trim().toLowerCase() === person.name.trim().toLowerCase(),
    );
    byUserId.set(userId, {
      userId,
      displayName: person.name,
      role: 'member',
      ...(match?.email ? { email: match.email } : {}),
      ...(match?.inviteCode ? { inviteCode: match.inviteCode } : {}),
      ...(match?.acceptedAt ? { acceptedAt: match.acceptedAt } : {}),
    });
  }
  return [...byUserId.values()];
}

export function resolveTravelFriendsHostPerson({
  hostFromRoster,
  isSoleHost,
  memberPlan,
  hostFallbackName,
  hostDisplayName,
  selfUserId,
  selfEmail,
}: {
  hostFromRoster?: TravelTripRosterPerson;
  isSoleHost: boolean;
  memberPlan: boolean;
  hostFallbackName: string;
  hostDisplayName?: string;
  selfUserId?: string;
  selfEmail?: string;
}): TravelFriendsHostPerson {
  const isSelfHost = Boolean(selfUserId && hostFromRoster?.userId === selfUserId);
  // Prefer the signed-in profile name for yourself — roster/JWT helpers can
  // fall back to a generic label like "You" / "Guest".
  // Never claim host on a member copy before roster confirms — that duplicated
  // a friend into the host slot after rename.
  if (isSelfHost || (isSoleHost && !memberPlan && !hostFromRoster)) {
    return {
      name: hostFallbackName,
      email: selfEmail ?? hostFromRoster?.email,
      isSelf: true,
      userId: selfUserId ?? hostFromRoster?.userId,
    };
  }
  if (hostFromRoster) {
    return {
      name: hostFromRoster.displayName,
      email: hostFromRoster.email,
      isSelf: false,
      userId: hostFromRoster.userId,
    };
  }
  if (memberPlan && hostDisplayName?.trim()) {
    return { name: hostDisplayName.trim(), isSelf: false };
  }
  if (!memberPlan) {
    return {
      name: hostFallbackName,
      email: selfEmail,
      isSelf: true,
      userId: selfUserId,
    };
  }
  return { name: 'Host', isSelf: false };
}

/** Filter invite/participant rows that duplicate the host or server roster. */
export function filterTravelFriendsVisibleParticipants({
  participants,
  hostPerson,
  hostFromRoster,
  roster,
  memberPlan,
}: {
  participants: TravelParticipant[];
  hostPerson: TravelFriendsHostPerson;
  hostFromRoster?: TravelTripRosterPerson;
  roster: TravelTripRosterPerson[];
  memberPlan: boolean;
}): TravelParticipant[] {
  const hostEmail = hostPerson.email?.trim().toLowerCase();
  const hostName = hostPerson.name.trim().toLowerCase();
  const rosterLoaded = roster.length > 0;
  const rosterEmails = new Set(
    roster
      .map((person) => person.email?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  return participants.filter((person) => {
    const email = person.email?.trim().toLowerCase();
    const name = person.name.trim().toLowerCase();
    // Never list the host again under an older invite / display name.
    if (hostEmail && email && email === hostEmail) return false;
    if (hostName && name === hostName) return false;
    if (
      hostFromRoster &&
      name &&
      hostFromRoster.displayName.trim().toLowerCase() === name
    ) {
      return false;
    }
    // Member copies: once the server roster is in, hide stale accepted
    // local rows (they duplicate host/friends under prior names).
    if (memberPlan && rosterLoaded && person.acceptedAt) return false;
    if (email && rosterEmails.has(email) && person.acceptedAt) return false;
    return true;
  });
}
