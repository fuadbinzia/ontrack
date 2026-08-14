import type { TravelPlan } from '@/features/travel/types';
import { isTravelMemberPlan } from '@/features/travel/trip-roster';
import type { FriendProfile } from '@/services/friends';
import { todayKey } from '@/utils/date';

export type SocialTripMembership = {
  plan: TravelPlan;
  status: 'member' | 'invited';
};

function key(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Match a friend to canonical trip participants by opaque user id, with a narrow name
 * fallback for member copies where the friend is represented as the host.
 */
export function socialTripMemberships(
  friend: Pick<FriendProfile, 'userId' | 'displayName'>,
  plans: TravelPlan[],
): SocialTripMembership[] {
  const friendName = key(friend.displayName);

  return plans.flatMap((plan) => {
    const participant = plan.participants.find(
      (person) => person.userId === friend.userId,
    );
    if (participant) {
      return [{ plan, status: participant.acceptedAt ? 'member' : 'invited' } as const];
    }

    // A joined member copy stores the remote host by name, not participant email.
    if (isTravelMemberPlan(plan) && friendName && key(plan.hostDisplayName) === friendName) {
      return [{ plan, status: 'member' } as const];
    }

    return [];
  });
}

/** Upcoming trips that actually involve another person. */
export function sharedUpcomingTrips(
  plans: TravelPlan[],
  today = todayKey(),
): TravelPlan[] {
  return plans
    .filter(
      (plan) =>
        plan.endDate >= today &&
        (plan.participants.length > 0 || isTravelMemberPlan(plan)),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
