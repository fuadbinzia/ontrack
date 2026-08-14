import { resolveTravelPhotoUris } from '@/features/travel/travel-moment-media';
import type { TravelPlan } from '@/features/travel/types';
import type { SocialFeedItem } from '@/features/social/social-types';
import type { FriendProfile } from '@/services/friends';
import { formatDateLong } from '@/utils/date';

type FeedActor = Pick<FriendProfile, 'userId' | 'displayName'>;

function isUsefulIso(value: string | undefined): value is string {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

export function buildSocialFeedItems({
  friends,
  plans,
  self,
}: {
  friends: FriendProfile[];
  plans: TravelPlan[];
  self: FeedActor;
}): SocialFeedItem[] {
  const items: SocialFeedItem[] = [];

  for (const plan of plans) {
    if (plan.participants.length === 0) continue;
    const photoUris = resolveTravelPhotoUris(
      plan.itinerary.flatMap((entry) => entry.photoUris ?? []),
    ).slice(0, 5);
    if (photoUris.length > 0) {
      items.push({
        id: `photos-${plan.id}`,
        kind: 'photos',
        scope: 'group',
        actor: self,
        createdAt: plan.updatedAt,
        tripId: plan.id,
        tripTitle: plan.title,
        photoUris,
      });
    } else {
      items.push({
        id: `trip-${plan.id}`,
        kind: 'trip',
        scope: 'group',
        actor: self,
        createdAt: plan.updatedAt,
        tripId: plan.id,
        tripTitle: plan.title,
        destination: plan.destination,
        dateRange: `${formatDateLong(plan.startDate)} – ${formatDateLong(plan.endDate)}`,
      });
    }
  }

  for (const friend of friends) {
    items.push({
      id: `connection-${friend.userId}`,
      kind: 'connection',
      scope: 'friend',
      actor: friend,
      createdAt: isUsefulIso(friend.friendsSince)
        ? friend.friendsSince
        : '1970-01-01T00:00:00.000Z',
    });
  }

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function formatSocialActivityTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Connected';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
