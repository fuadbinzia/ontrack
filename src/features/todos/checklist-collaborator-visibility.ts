export function canShowChecklistCollaborator({
  collaboratorUserId,
  viewerUserId,
  friendUserIds,
}: {
  collaboratorUserId: string;
  viewerUserId?: string;
  friendUserIds: ReadonlySet<string>;
}) {
  return Boolean(
    viewerUserId &&
    collaboratorUserId !== viewerUserId &&
    friendUserIds.has(collaboratorUserId),
  );
}
