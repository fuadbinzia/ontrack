import { isGuestDirtyTrackingSuppressed } from '@/features/auth/guest-dirty-tracking';
import { useAuthAccess } from '@/store/auth-access';
import { newUuid } from '@/utils/id';
import { nowIso } from './todos-normalize';
import type {
  PendingTodoMutation,
  TodoCategory,
  TodoList,
  TodoMutationOperation,
  TodoPersistedState,
  TodoTask,
} from './todos-types';

export function resolveListCategoryId(
  categories: TodoCategory[],
  listId: string,
  categoryId?: string,
): string | undefined {
  if (!categoryId) return undefined;
  return categories.some(
    (category) => category.id === categoryId && category.listId === listId,
  )
    ? categoryId
    : undefined;
}

export function markGuestEdit() {
  if (!isGuestDirtyTrackingSuppressed()) {
    useAuthAccess.getState().markGuestDataDirty();
  }
}

export function privateTodoPayload(state: TodoPersistedState) {
  const privateListIds = new Set(
    state.lists.filter((list) => list.mode === 'private').map((list) => list.id),
  );
  return {
    groceryMigrationVersion: 1 as const,
    lists: state.lists.filter((list) => privateListIds.has(list.id)),
    categories: state.categories.filter((category) => privateListIds.has(category.listId)),
    tasks: state.tasks.filter((task) => privateListIds.has(task.listId)),
    recipes: state.recipes.filter((recipe) => privateListIds.has(recipe.listId)),
  };
}

/** Owner or editor may change list items; members may only complete assigned/open tasks. */
export function canEditTodoContent(list: TodoList): boolean {
  return (
    list.mode === 'private' ||
    list.role === 'owner' ||
    list.role === 'editor'
  );
}

export function canCompleteTodo(
  list: TodoList,
  task: TodoTask,
  actorUserId?: string,
): boolean {
  if (canEditTodoContent(list)) return true;
  const assignees = task.assigneeUserIds ?? [];
  return Boolean(
    actorUserId &&
      (assignees.length === 0 || assignees.includes(actorUserId)),
  );
}

export function queuedMutation(
  list: TodoList | undefined,
  operation: TodoMutationOperation,
  payload: Record<string, unknown>,
): PendingTodoMutation[] {
  if (!list || list.mode !== 'shared') return [];
  return [{
    id: newUuid(),
    listId: list.id,
    operation,
    payload,
    createdAt: nowIso(),
    attempts: 0,
  }];
}
