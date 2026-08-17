export function travelMapOverlayPickerIds({
  friends,
  sharingUserIds,
  selectedFriendIds,
}: {
  friends: ReadonlyArray<{ userId: string }>;
  sharingUserIds: ReadonlyArray<string>;
  selectedFriendIds: ReadonlyArray<string>;
}): { excludeIds: string[]; disabledIds: string[] } {
  const sharing = new Set(sharingUserIds);
  const selected = new Set(selectedFriendIds);
  const excludeIds: string[] = [];
  const disabledIds: string[] = [];

  for (const friend of friends) {
    if (selected.has(friend.userId)) {
      excludeIds.push(friend.userId);
      continue;
    }
    if (!sharing.has(friend.userId)) {
      disabledIds.push(friend.userId);
    }
  }

  return { excludeIds, disabledIds };
}

export function travelMapOverlayConfirmIds(
  pickedUserIds: readonly string[],
  sharingUserIds: readonly string[],
  selectedFriendIds: readonly string[],
): string[] {
  const sharing = new Set(sharingUserIds);
  const added = pickedUserIds.filter((id) => sharing.has(id));
  return [...selectedFriendIds, ...added];
}
