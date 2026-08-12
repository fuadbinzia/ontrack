import { appPrompt } from '@/components/primitives';
import { deletePersistedRecipeImage } from '@/services/recipes';
import {
  deleteSharedTodoList,
  leaveTodoList,
} from '@/services/todos/collaboration';
import { useTodos, type TodoList } from '@/store/todos';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';

function listHasNonOwnerMembers(listId: string): boolean {
  return useTodos.getState().members.some(
    (member) => member.listId === listId && member.role !== 'owner',
  );
}

export async function performTodoListRemoval(
  list: TodoList,
  leaving: boolean,
): Promise<void> {
  if (list.mode === 'private') {
    useTodos
      .getState()
      .recipes.filter((recipe) => recipe.listId === list.id)
      .forEach((recipe) => deletePersistedRecipeImage(recipe.sourceImageUri));
    useTodos.getState().deleteList(list.id);
    return;
  }
  if (leaving) {
    await leaveTodoList(list.id);
    return;
  }
  await deleteSharedTodoList(list.id);
}

export function confirmRemoveTodoList(
  list: TodoList,
  options?: { afterRemoved?: () => void },
): void {
  const leaving = list.mode === 'shared' && list.role !== 'owner';
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
      void performTodoListRemoval(list, leaving)
        .then(() => {
          haptics.warning();
          options?.afterRemoved?.();
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
