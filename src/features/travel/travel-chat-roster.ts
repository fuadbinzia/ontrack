import { travelChatAccessCode } from '@/features/travel/chat';
import { isTravelMemberPlan } from '@/features/travel/trip-roster';
import type { TravelChatMember } from '@/features/travel/chat';
import type { TravelPlan, TravelTripRosterPerson } from '@/features/travel/types';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { asNonEmptyString, asString } from '@/utils/parse';
import { newId } from '@/utils/id';

export type TravelChatAccessCapability = {
  tripId: string;
  accessCode: string;
  role: 'host' | 'member';
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
};

/**
 * Chat capability from local plan fields, or recovered from the live server
 * roster when a member lost `chatAccessCode` / a host never wrote acceptedAt.
 */
export function resolveTravelChatAccessFromRoster(input: {
  plan: TravelPlan;
  roster: TravelTripRosterPerson[];
  selfUserId?: string;
}): string | undefined {
  const existing = travelChatAccessCode(input.plan);
  if (existing) return existing;
  if (!input.selfUserId || input.roster.length === 0) return undefined;

  const me = input.roster.find((person) => person.userId === input.selfUserId);
  if (!me) return undefined;

  if (me.role === 'member' || me.role === 'cohost') {
    return me.inviteCode;
  }

  const accepted = input.roster
    .filter(
      (person) =>
        (person.role === 'member' || person.role === 'cohost') &&
        person.inviteCode &&
        person.acceptedAt,
    )
    .sort((a, b) => (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? ''));
  return accepted[0]?.inviteCode;
}

/** Overlapping chat header discs — prefer roster so custom avatars resolve. */
export function resolveTravelChatMembersFromRoster(input: {
  roster: TravelTripRosterPerson[];
  selfUserId?: string;
  selfDisplayName: string;
  fallback: TravelChatMember[];
}): TravelChatMember[] {
  if (input.roster.length === 0) return input.fallback;

  const selfName = input.selfDisplayName.trim() || 'Trip member';
  const ordered = [...input.roster].sort((a, b) => {
    const aSelf = a.userId === input.selfUserId ? 0 : 1;
    const bSelf = b.userId === input.selfUserId ? 0 : 1;
    if (aSelf !== bSelf) return aSelf - bSelf;
    if (a.role === 'host' && b.role !== 'host') return -1;
    if (b.role === 'host' && a.role !== 'host') return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return ordered.map((person) => {
    const isSelf = Boolean(input.selfUserId && person.userId === input.selfUserId);
    const avatar: TravelChatMember['avatar'] | undefined = person.avatarKind
      ? {
          kind: person.avatarKind,
          color: person.avatarColor,
          iconId: person.avatarIconId,
          photoPath: person.avatarPhotoPath,
        }
      : undefined;
    return {
      id: person.userId,
      name: isSelf ? selfName : person.displayName,
      userId: person.userId,
      isSelf,
      ...(avatar ? { avatar } : {}),
    };
  });
}

/**
 * Persist recovered chat access + accepted friends so chat stays unlocked
 * without reopening Co-Travelers. Never writes `chatAccessCode` onto a host
 * plan (that flag marks member copies).
 */
export function planPatchFromTravelChatRoster(input: {
  plan: TravelPlan;
  roster: TravelTripRosterPerson[];
  selfUserId?: string;
  accessCode?: string;
}): TravelPlan | undefined {
  const { plan, roster, selfUserId, accessCode } = input;
  if (roster.length === 0) return undefined;

  const me = selfUserId
    ? roster.find((person) => person.userId === selfUserId)
    : undefined;
  const memberCopy =
    me?.role === 'member' ||
    me?.role === 'cohost' ||
    (!me && isTravelMemberPlan(plan));

  let next: TravelPlan = plan;
  let changed = false;

  if (memberCopy && accessCode && plan.chatAccessCode !== accessCode) {
    next = { ...next, chatAccessCode: accessCode };
    changed = true;
  }

  const host = roster.find((person) => person.role === 'host');
  if (
    memberCopy &&
    host?.displayName &&
    next.hostDisplayName !== host.displayName
  ) {
    next = { ...next, hostDisplayName: host.displayName };
    changed = true;
  }

  if (!memberCopy) {
    const now = new Date().toISOString();
    let participants = next.participants;
    for (const member of roster) {
      if (member.role !== 'member' && member.role !== 'cohost') continue;
      if (!member.inviteCode || !member.acceptedAt) continue;
      const index = participants.findIndex(
        (person) =>
          person.inviteCode === member.inviteCode ||
          (member.email &&
            person.email &&
            person.email.toLowerCase() === member.email.toLowerCase()),
      );
      if (index >= 0) {
        const current = participants[index]!;
        if (
          current.acceptedAt === member.acceptedAt &&
          current.name === member.displayName
        ) {
          continue;
        }
        changed = true;
        participants = participants.map((person, i) =>
          i === index
            ? {
                ...person,
                name: member.displayName,
                acceptedAt: member.acceptedAt,
                ...(member.email ? { email: member.email } : {}),
              }
            : person,
        );
        continue;
      }
      changed = true;
      participants = [
        ...participants,
        {
          id: newId('trip-person'),
          name: member.displayName,
          ...(member.email ? { email: member.email } : {}),
          inviteCode: member.inviteCode,
          invitedAt: member.acceptedAt ?? now,
          acceptedAt: member.acceptedAt ?? now,
        },
      ];
    }
    if (participants !== next.participants) {
      next = { ...next, participants };
    }
  }

  if (!changed) return undefined;
  return { ...next, updatedAt: new Date().toISOString() };
}

function parseTravelChatAccessCapability(
  value: unknown,
): TravelChatAccessCapability | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const tripId = asNonEmptyString(row.tripId);
  const accessCode = asNonEmptyString(asString(row.accessCode));
  const role = row.role === 'host' || row.role === 'member' ? row.role : undefined;
  if (!tripId || !accessCode || !role) return undefined;
  if (!/^[a-f0-9]{20}$/.test(accessCode)) return undefined;
  return {
    tripId,
    accessCode,
    role,
    title: asString(row.title)?.trim() ?? '',
    destination: asString(row.destination)?.trim() ?? '',
    startDate: asString(row.startDate)?.trim() ?? '',
    endDate: asString(row.endDate)?.trim() ?? '',
  };
}

export async function listMyTravelChatAccess(): Promise<TravelChatAccessCapability[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc('list_my_travel_chat_access');
  if (error || !Array.isArray(data)) return [];
  return data
    .map(parseTravelChatAccessCapability)
    .filter((row): row is TravelChatAccessCapability => Boolean(row));
}

/**
 * Prefer an accepted membership over a same-titled host fork (the Iceland
 * first-trip failure mode: local plan id is the invite local id / a forked
 * host trip, while chat lives on the friend's canonical trip).
 */
export function matchTravelChatAccessCapability(
  plan: Pick<TravelPlan, 'id' | 'hostTripId' | 'title' | 'startDate' | 'endDate'>,
  capabilities: TravelChatAccessCapability[],
): TravelChatAccessCapability | undefined {
  if (capabilities.length === 0) return undefined;

  const hostTripId = plan.hostTripId?.trim();
  const byExactId = capabilities.find(
    (item) => item.tripId === hostTripId || item.tripId === plan.id,
  );
  if (byExactId?.role === 'member') return byExactId;

  const title = plan.title.trim().toLowerCase();
  const byIdentity = capabilities.filter(
    (item) =>
      item.title.trim().toLowerCase() === title &&
      item.startDate === plan.startDate &&
      item.endDate === plan.endDate,
  );
  const memberMatch = byIdentity.find((item) => item.role === 'member');
  if (memberMatch) return memberMatch;
  if (byExactId) return byExactId;
  return byIdentity[0];
}

/**
 * Remap every local plan that matches a signed-in membership / host chat
 * capability. Runs from Travel tab hydrate so chat is fixed before Group Chat
 * opens (OTA may land while the user is still on the list).
 */
export async function repairTravelPlansChatAccess(input: {
  plans: TravelPlan[];
  savePlan: (plan: TravelPlan) => void;
}): Promise<number> {
  const capabilities = await listMyTravelChatAccess();
  if (capabilities.length === 0) return 0;
  let repaired = 0;
  for (const plan of input.plans) {
    const matched = matchTravelChatAccessCapability(plan, capabilities);
    if (!matched) continue;
    const patched = planPatchFromTravelChatCapability({ plan, capability: matched });
    if (!patched) continue;
    input.savePlan(patched);
    repaired += 1;
  }
  return repaired;
}

/** Rewire an orphan local copy onto the shared trip + chat capability. */
export function planPatchFromTravelChatCapability(input: {
  plan: TravelPlan;
  capability: TravelChatAccessCapability;
}): TravelPlan | undefined {
  const { plan, capability } = input;
  let next = plan;
  let changed = false;

  if (capability.role === 'member') {
    if (plan.chatAccessCode !== capability.accessCode) {
      next = { ...next, chatAccessCode: capability.accessCode };
      changed = true;
    }
    if (plan.hostTripId !== capability.tripId) {
      next = { ...next, hostTripId: capability.tripId };
      changed = true;
    }
    if (plan.openJoinCode) {
      next = { ...next, openJoinCode: undefined };
      changed = true;
    }
  } else {
    // Host capability: unlock via accepted participant invite, never chatAccessCode.
    const existing = next.participants.find(
      (person) => person.inviteCode === capability.accessCode,
    );
    if (!existing) {
      const now = new Date().toISOString();
      next = {
        ...next,
        participants: [
          ...next.participants,
          {
            id: newId('trip-person'),
            name: 'Trip member',
            inviteCode: capability.accessCode,
            invitedAt: now,
            acceptedAt: now,
          },
        ],
      };
      changed = true;
    } else if (!existing.acceptedAt) {
      next = {
        ...next,
        participants: next.participants.map((person) =>
          person.inviteCode === capability.accessCode
            ? { ...person, acceptedAt: person.acceptedAt ?? new Date().toISOString() }
            : person,
        ),
      };
      changed = true;
    }
    if (plan.hostTripId && plan.hostTripId !== plan.id && plan.hostTripId !== capability.tripId) {
      // Keep hostTripId aligned to the hosted server trip when known.
      next = { ...next, hostTripId: capability.tripId };
      changed = true;
    }
  }

  if (!changed) return undefined;
  return { ...next, updatedAt: new Date().toISOString() };
}
