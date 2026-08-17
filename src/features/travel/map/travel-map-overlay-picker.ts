import type { AppIconName } from '@/design-system';

export type TravelMapOverlayEmptyKind =
  | 'no-friends'
  | 'none-sharing'
  | 'all-overlaid'
  | 'no-search-match';

export function travelMapOverlayPickerState({
  friends,
  sharingUserIds,
  selectedFriendIds,
}: {
  friends: ReadonlyArray<{ userId: string }>;
  sharingUserIds: ReadonlyArray<string>;
  selectedFriendIds: ReadonlyArray<string>;
}): {
  includeIds: string[];
  excludeIds: string[];
  showSearch: boolean;
  emptyKind: Exclude<TravelMapOverlayEmptyKind, 'no-search-match'> | null;
} {
  const selected = new Set(selectedFriendIds);
  const includeIds = [...new Set(sharingUserIds)];
  const excludeIds = includeIds.filter((id) => selected.has(id));

  if (friends.length === 0 && includeIds.length === 0) {
    return { includeIds, excludeIds, showSearch: false, emptyKind: 'no-friends' };
  }
  if (includeIds.length === 0) {
    return {
      includeIds,
      excludeIds,
      showSearch: false,
      emptyKind: 'none-sharing',
    };
  }
  if (excludeIds.length === includeIds.length) {
    return {
      includeIds,
      excludeIds,
      showSearch: false,
      emptyKind: 'all-overlaid',
    };
  }
  return { includeIds, excludeIds, showSearch: true, emptyKind: null };
}

export function travelMapOverlayEmptyCopy(kind: TravelMapOverlayEmptyKind): {
  icon: AppIconName;
  title: string;
  message: string;
} {
  switch (kind) {
    case 'no-friends':
      return {
        icon: 'people',
        title: 'Invite a Friend First',
        message: 'Add someone on Social, then overlay their atlas here.',
      };
    case 'none-sharing':
      return {
        icon: 'globe',
        title: 'Waiting On Their Maps',
        message:
          'When a friend turns on Share My Map, their pins will appear here so you can explore together.',
      };
    case 'all-overlaid':
      return {
        icon: 'check',
        title: 'Already On Your Atlas',
        message: 'Every friend who shares a map is already overlaid.',
      };
    case 'no-search-match':
      return {
        icon: 'search',
        title: 'No One Matches That',
        message: 'Try a different name. Only friends who share their map appear here.',
      };
  }
}

export function travelMapOverlayConfirmIds(
  pickedUserIds: readonly string[],
  sharingUserIds: readonly string[],
  selectedFriendIds: readonly string[],
): string[] {
  const sharing = new Set(sharingUserIds);
  const next = new Set<string>(selectedFriendIds);
  for (const id of pickedUserIds) {
    if (sharing.has(id)) {
      next.add(id);
    }
  }
  return [...next];
}
