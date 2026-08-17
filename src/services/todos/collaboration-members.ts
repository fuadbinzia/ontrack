import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/cloud/supabase';
import { removeSharedRecipeImages } from '@/services/todos/recipe-media';
import { canDeleteChecklist } from '@/store/todos-helpers';
import {
  type Checklist,
  type ChecklistSharedSnapshot,
  useChecklists,
} from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  ChecklistCollaborationError,
} from './collaboration-core';
import {
  ensureListMutationsFlushed,
  loadChecklistSnapshot,
} from './collaboration-mutations';

export async function removeChecklistMember(listId: string, userId: string) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('remove_todo_member', {
    requested_list_id: listId,
    requested_user_id: userId,
  });
  if (error) throw new ChecklistCollaborationError(error.message);
  await loadChecklistSnapshot(listId);
}

export async function setChecklistMemberRole(
  listId: string,
  userId: string,
  role: 'editor' | 'member',
) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('set_todo_member_role', {
    requested_list_id: listId,
    requested_user_id: userId,
    requested_role: role,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'That member role could not be updated.'),
    );
  }
  await loadChecklistSnapshot(listId);
}

export async function addChecklistFriendEditors(
  listId: string,
  userIds: string[],
) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('add_todo_friend_editors', {
    requested_list_id: listId,
    requested_user_ids: userIds,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'Friends could not be added as editors.'),
    );
  }
  await loadChecklistSnapshot(listId);
}

export async function transferChecklistOwnership(
  listId: string,
  newOwnerUserId: string,
) {
  await ensureListMutationsFlushed(listId);
  const client = await authenticatedClient();
  const { error } = await client.rpc('transfer_todo_list_ownership', {
    requested_list_id: listId,
    new_owner_user_id: newOwnerUserId,
  });
  if (error) throw new ChecklistCollaborationError(error.message);
  // Former owner's plaintext join code is no longer valid after transfer.
  useChecklists.getState().setShareCode(listId, undefined);
  await loadChecklistSnapshot(listId);
}

function restoreSharedListRollback(
  listId: string,
  rollback:
    | {
        list: Checklist;
        categories: ChecklistSharedSnapshot['categories'];
        tasks: ChecklistSharedSnapshot['tasks'];
        recipes: ChecklistSharedSnapshot['recipes'];
        members: ChecklistSharedSnapshot['members'];
      }
    | undefined,
  pendingRollback: ReturnType<typeof useChecklists.getState>['pendingMutations'],
) {
  if (!rollback) return;
  useChecklists.getState().replaceSharedSnapshot(rollback);
  if (!pendingRollback.length) return;
  useChecklists.setState((state) => ({
    pendingMutations: [
      ...state.pendingMutations.filter((mutation) => mutation.listId !== listId),
      ...pendingRollback,
    ],
  }));
}

export async function leaveChecklist(listId: string) {
  await ensureListMutationsFlushed(listId);
  const state = useChecklists.getState();
  const list = state.lists.find((item) => item.id === listId);
  const pendingRollback = state.pendingMutations.filter(
    (mutation) => mutation.listId === listId,
  );
  const rollback = list
    ? {
        list,
        categories: state.categories.filter((category) => category.listId === listId),
        tasks: state.tasks.filter((task) => task.listId === listId),
        recipes: state.recipes.filter((recipe) => recipe.listId === listId),
        members: state.members.filter((member) => member.listId === listId),
      }
    : undefined;
  useChecklists.getState().removeSharedList(listId);
  try {
    const client = await authenticatedClient();
    const { error } = await client.rpc('leave_todo_list', {
      requested_list_id: listId,
    });
    if (error) throw new ChecklistCollaborationError(error.message);
  } catch (error) {
    restoreSharedListRollback(listId, rollback, pendingRollback);
    throw error;
  }
}

export async function deleteSharedChecklist(listId: string) {
  await ensureListMutationsFlushed(listId);
  const state = useChecklists.getState();
  const list = state.lists.find((item) => item.id === listId);
  const pendingRollback = state.pendingMutations.filter(
    (mutation) => mutation.listId === listId,
  );
  const rollback = list
    ? {
        list,
        categories: state.categories.filter((category) => category.listId === listId),
        tasks: state.tasks.filter((task) => task.listId === listId),
        recipes: state.recipes.filter((recipe) => recipe.listId === listId),
        members: state.members.filter((member) => member.listId === listId),
      }
    : undefined;
  if (list && !canDeleteChecklist(list)) {
    throw new ChecklistCollaborationError('Only the owner can delete this list.');
  }
  useChecklists.getState().removeSharedList(listId);
  let client: Awaited<ReturnType<typeof authenticatedClient>>;
  try {
    client = await authenticatedClient();
    const { error } = await client.rpc('delete_todo_list', {
      requested_list_id: listId,
    });
    if (error) throw new ChecklistCollaborationError(error.message);
  } catch (error) {
    restoreSharedListRollback(listId, rollback, pendingRollback);
    throw error;
  }
  // The list is permanently gone after the RPC succeeds. Storage cleanup is
  // best-effort and must never restore a local ghost list on failure.
  if (rollback?.recipes?.length) {
    await removeSharedRecipeImages(client, rollback.recipes).catch(() => undefined);
  }
}

export function subscribeToChecklist(
  list: Pick<Checklist, 'id'>,
  onChange: () => void,
): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  return client
    .channel(`todo:list:${list.id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, onChange)
    .subscribe();
}
