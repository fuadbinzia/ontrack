import { canShowChecklistCollaborator } from '@/features/todos/checklist-collaborator-visibility';

describe('checklist collaborator visibility', () => {
  const friendUserIds = new Set(['friend-user']);

  it('shows accepted friends to the signed-in viewer', () => {
    expect(canShowChecklistCollaborator({
      collaboratorUserId: 'friend-user',
      viewerUserId: 'viewer-user',
      friendUserIds,
    })).toBe(true);
  });

  it('hides non-friends, the viewer, and users before friendship is known', () => {
    expect(canShowChecklistCollaborator({
      collaboratorUserId: 'not-a-friend',
      viewerUserId: 'viewer-user',
      friendUserIds,
    })).toBe(false);
    expect(canShowChecklistCollaborator({
      collaboratorUserId: 'viewer-user',
      viewerUserId: 'viewer-user',
      friendUserIds,
    })).toBe(false);
    expect(canShowChecklistCollaborator({
      collaboratorUserId: 'friend-user',
      viewerUserId: undefined,
      friendUserIds,
    })).toBe(false);
  });
});
