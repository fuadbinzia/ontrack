import type { AppIconName } from '@/design-system';
import { socialActionTones } from '@/features/social/social-chrome';
import type { FriendProfile } from '@/services/friends';

export type SocialQuickActionId =
  | 'invite-trip'
  | 'challenge'
  | 'share-calendar'
  | 'share-todos'
  | 'chat'
  | 'share-workout'
  | 'share-photos'
  | 'share-story'
  | 'poll'
  | 'create-group';

export type SocialQuickAction = {
  id: SocialQuickActionId;
  label: string;
  icon: AppIconName;
  tone: keyof typeof socialActionTones;
};

export const SOCIAL_QUICK_ACTIONS: SocialQuickAction[] = [
  { id: 'invite-trip', label: 'Invite to\nTrip', icon: 'flight', tone: 'trip' },
  { id: 'challenge', label: 'Challenge', icon: 'games', tone: 'challenge' },
  { id: 'share-calendar', label: 'Share\nCalendar', icon: 'calendar', tone: 'calendar' },
  { id: 'share-todos', label: 'Share\nTo-Do', icon: 'tasks', tone: 'tasks' },
  { id: 'chat', label: 'Chat', icon: 'chat', tone: 'chat' },
  { id: 'share-workout', label: 'Share\nWorkout', icon: 'gym', tone: 'workout' },
  { id: 'share-photos', label: 'Share\nPhotos', icon: 'photo', tone: 'photos' },
  { id: 'share-story', label: 'Share\nStory', icon: 'plus-circle', tone: 'story' },
  { id: 'poll', label: 'Poll /\nVote', icon: 'insights', tone: 'poll' },
  { id: 'create-group', label: 'Create\nGroup', icon: 'people', tone: 'group' },
];

export type SocialFeedScope = 'friend' | 'group';

type SocialFeedBase = {
  id: string;
  scope: SocialFeedScope;
  actor: Pick<FriendProfile, 'userId' | 'displayName'>;
  createdAt: string;
};

export type SocialFeedItem =
  | (SocialFeedBase & {
      kind: 'connection';
    })
  | (SocialFeedBase & {
      kind: 'trip';
      tripId: string;
      tripTitle: string;
      destination: string;
      dateRange: string;
    })
  | (SocialFeedBase & {
      kind: 'photos';
      tripId: string;
      tripTitle: string;
      photoUris: string[];
    })
  | (SocialFeedBase & {
      kind: 'workout';
      workoutTitle: string;
      durationMinutes: number;
      calories?: number;
      achievement?: string;
      thumbnailUri?: string;
    })
  | (SocialFeedBase & {
      kind: 'poll';
      groupName: string;
      question: string;
      choices: { id: string; label: string; votes: number }[];
    })
  | (SocialFeedBase & {
      kind: 'story';
      previewUri?: string;
      expiresAt: string;
      viewerCount?: number;
    });

export type SocialPlaceholder = {
  id: string;
  title: string;
  message: string;
  icon: AppIconName;
  primaryLabel?: string;
  statusTitle?: string;
  statusMessage?: string;
};
