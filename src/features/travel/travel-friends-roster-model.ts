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

function normalizedEmail(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

/** Stable identity match between a saved invite row and the server roster. */
export function travelParticipantMatchesRosterMember(
  participant: TravelParticipant,
  member: TravelTripRosterPerson,
): boolean {
  if (participant.userId && participant.userId === member.userId) return true;
  if (
    participant.inviteCode &&
    member.inviteCode &&
    participant.inviteCode === member.inviteCode
  ) {
    return true;
  }
  const participantEmail = normalizedEmail(participant.email);
  const memberEmail = normalizedEmail(member.email);
  return Boolean(
    participantEmail && memberEmail && participantEmail === memberEmail,
  );
}

/**
 * After a revoke, remove accepted local rows that no longer exist as either a
 * live invite or a roster member. Pending invitations remain intact.
 */
export function pruneRevokedTravelParticipants({
  participants,
  inviteStatuses,
  roster,
}: {
  participants: TravelParticipant[];
  inviteStatuses: Record<string, string>;
  roster: TravelTripRosterPerson[];
}): TravelParticipant[] {
  return participants.filter(
    (participant) =>
      !participant.acceptedAt ||
      Boolean(inviteStatuses[participant.inviteCode]) ||
      roster.some((member) =>
        travelParticipantMatchesRosterMember(participant, member),
      ),
  );
}

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
  const rosterUserIds = new Set(roster.map((person) => person.userId));
  const rosterInviteCodes = new Set(
    roster
      .map((person) => person.inviteCode)
      .filter((value): value is string => Boolean(value)),
  );
  const rosterNameCounts = new Map<string, number>();
  for (const person of roster) {
    const name = person.displayName.trim().toLowerCase();
    if (name) rosterNameCounts.set(name, (rosterNameCounts.get(name) ?? 0) + 1);
  }
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
    if (person.acceptedAt && person.userId && rosterUserIds.has(person.userId)) {
      return false;
    }
    if (person.acceptedAt && rosterInviteCodes.has(person.inviteCode)) {
      return false;
    }
    if (email && rosterEmails.has(email) && person.acceptedAt) return false;
    // Privacy-safe roster responses omit email. An older accepted invite can
    // also have a different code, so use the display name only when it maps to
    // exactly one roster account; equal-name travelers remain separate.
    if (person.acceptedAt && name && rosterNameCounts.get(name) === 1) {
      return false;
    }
    return true;
  });
}
