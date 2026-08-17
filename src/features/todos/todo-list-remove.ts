import { appPrompt } from '@/components/primitives';
import { deletePersistedRecipeImage } from '@/services/recipes';
import {
  deleteSharedChecklist,
  leaveChecklist,
} from '@/services/todos/collaboration';
import { canDeleteChecklist, canLeaveChecklist } from '@/store/todos-helpers';
import { useChecklists, type Checklist } from '@/store/todos';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';

function listHasNonOwnerMembers(listId: string): boolean {
  return useChecklists.getState().members.some(
    (member) => member.listId === listId && member.role !== 'owner',
  );
}

export async function performChecklistRemoval(list: Checklist): Promise<void> {
  if (canLeaveChecklist(list)) {
    await leaveChecklist(list.id);
    return;
  }
  if (!canDeleteChecklist(list)) return;
  if (list.mode === 'private') {
    useChecklists
      .getState()
      .recipes.filter((recipe) => recipe.listId === list.id)
      .forEach((recipe) => deletePersistedRecipeImage(recipe.sourceImageUri));
    useChecklists.getState().deleteList(list.id);
    return;
  }
  await deleteSharedChecklist(list.id);
}

export function confirmRemoveChecklist(
  list: Checklist,
  options?: { afterRemoved?: () => void },
): void {
  const leaving = canLeaveChecklist(list);
  if (!leaving && !canDeleteChecklist(list)) return;
  const sharedOwnerDelete =
    !leaving && list.mode === 'shared' && listHasNonOwnerMembers(list.id);
  confirmDestructiveAction({
    title: leaving ? `Leave “${list.name}”?` : `Delete “${list.name}”?`,
    message: leaving
      ? 'This checklist will be removed from your account. The owner and other collaborators will keep it.'
      : sharedOwnerDelete
        ? 'This permanently deletes the checklist for you and every collaborator. It only stays available if you make someone else the owner first.'
        : 'The checklist and every item in it will be permanently deleted.',
    actionLabel: leaving ? 'Leave' : 'Delete',
    onConfirm: () => {
      options?.afterRemoved?.();
      void performChecklistRemoval(list)
        .then(() => {
          haptics.warning();
        })
        .catch((caught: unknown) => {
          appPrompt.alert(
            leaving ? 'Could not leave checklist' : 'Could not delete checklist',
            caught instanceof Error ? caught.message : 'Please try again.',
          );
        });
    },
  });
}
