import { isGuestDirtyTrackingSuppressed } from '@/features/auth/guest-dirty-tracking';
import { useAuthAccess } from '@/store/auth-access';
import { newUuid } from '@/utils/id';
import { nowIso } from './todos-normalize';
import type {
    Checklist,
    ChecklistCategory,
    ChecklistMutationOperation,
    ChecklistPersistedState,
    ChecklistTask,
    PendingChecklistMutation,
} from './todos-types';

export function resolveListCategoryId(
  categories: ChecklistCategory[],
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

export function privateChecklistPayload(state: ChecklistPersistedState) {
  const privateListIds = new Set(
    state.lists.filter((list) => list.mode === 'private').map((list) => list.id),
  );
  return {
    groceryMigrationVersion: 1 as const,
    lists: state.lists.filter((list) => privateListIds.has(list.id)),
    // Full catalog order (private + shared ids) plus open recency, so a
    // sign-in restore puts every list — including a just-promoted one —
    // back where the user left it.
    listOrderHint: state.lists.map((list) => list.id),
    listOpenedAt: state.listOpenedAt,
    categories: state.categories.filter((category) => privateListIds.has(category.listId)),
    tasks: state.tasks.filter((task) => privateListIds.has(task.listId)),
    recipes: state.recipes.filter((recipe) => privateListIds.has(recipe.listId)),
  };
}

/** Owner or editor may change list items; members may only complete assigned/open tasks. */
export function canEditChecklistContent(list: Checklist): boolean {
  return (
    list.mode === 'private' ||
    list.role === 'owner' ||
    list.role === 'editor'
  );
}

/** Permanent list deletion is owner-only. Collaborators leave instead. */
export function canDeleteChecklist(list: Checklist): boolean {
  return list.role === 'owner';
}

export function canLeaveChecklist(list: Checklist): boolean {
  return list.mode === 'shared' && list.role !== 'owner';
}

export function canCompleteChecklistTask(
  list: Checklist,
  task: ChecklistTask,
  actorUserId?: string,
): boolean {
  if (canEditChecklistContent(list)) return true;
  const assignees = task.assigneeUserIds ?? [];
  return Boolean(
    actorUserId &&
      (assignees.length === 0 || assignees.includes(actorUserId)),
  );
}

export function queuedMutation(
  list: Checklist | undefined,
  operation: ChecklistMutationOperation,
  payload: Record<string, unknown>,
): PendingChecklistMutation[] {
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
