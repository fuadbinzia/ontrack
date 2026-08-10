import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/cloud/supabase';
import { removeSharedRecipeImages } from '@/services/todos/recipe-media';
import {
  type TodoList,
  type TodoSharedSnapshot,
  useTodos,
} from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  TodoCollaborationError,
} from './collaboration-core';
import {
  ensureListMutationsFlushed,
  loadTodoListSnapshot,
} from './collaboration-mutations';

export async function removeTodoMember(listId: string, userId: string) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('remove_todo_member', {
    requested_list_id: listId,
    requested_user_id: userId,
  });
  if (error) throw new TodoCollaborationError(error.message);
  await loadTodoListSnapshot(listId);
}

export async function setTodoMemberRole(
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
    throw new TodoCollaborationError(
      messageFrom(error, 'That member role could not be updated.'),
    );
  }
  await loadTodoListSnapshot(listId);
}

export async function addTodoFriendEditors(
  listId: string,
  userIds: string[],
) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('add_todo_friend_editors', {
    requested_list_id: listId,
    requested_user_ids: userIds,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'Friends could not be added as editors.'),
    );
  }
  await loadTodoListSnapshot(listId);
}

export async function transferTodoListOwnership(
  listId: string,
  newOwnerUserId: string,
) {
  await ensureListMutationsFlushed(listId);
  const client = await authenticatedClient();
  const { error } = await client.rpc('transfer_todo_list_ownership', {
    requested_list_id: listId,
    new_owner_user_id: newOwnerUserId,
  });
  if (error) throw new TodoCollaborationError(error.message);
  // Former owner's plaintext join code is no longer valid after transfer.
  useTodos.getState().setShareCode(listId, undefined);
  await loadTodoListSnapshot(listId);
}

function restoreSharedListRollback(
  listId: string,
  rollback:
    | {
        list: TodoList;
        tasks: TodoSharedSnapshot['tasks'];
        recipes: TodoSharedSnapshot['recipes'];
        members: TodoSharedSnapshot['members'];
      }
    | undefined,
  pendingRollback: ReturnType<typeof useTodos.getState>['pendingMutations'],
) {
  if (!rollback) return;
  useTodos.getState().replaceSharedSnapshot(rollback);
  if (!pendingRollback.length) return;
  useTodos.setState((state) => ({
    pendingMutations: [
      ...state.pendingMutations.filter((mutation) => mutation.listId !== listId),
      ...pendingRollback,
    ],
  }));
}

export async function leaveTodoList(listId: string) {
  await ensureListMutationsFlushed(listId);
  const state = useTodos.getState();
  const list = state.lists.find((item) => item.id === listId);
  const pendingRollback = state.pendingMutations.filter(
    (mutation) => mutation.listId === listId,
  );
  const rollback = list
    ? {
        list,
        tasks: state.tasks.filter((task) => task.listId === listId),
        recipes: state.recipes.filter((recipe) => recipe.listId === listId),
        members: state.members.filter((member) => member.listId === listId),
      }
    : undefined;
  useTodos.getState().removeSharedList(listId);
  try {
    const client = await authenticatedClient();
    const { error } = await client.rpc('leave_todo_list', {
      requested_list_id: listId,
    });
    if (error) throw new TodoCollaborationError(error.message);
  } catch (error) {
    restoreSharedListRollback(listId, rollback, pendingRollback);
    throw error;
  }
}

export async function deleteSharedTodoList(listId: string) {
  await ensureListMutationsFlushed(listId);
  const state = useTodos.getState();
  const list = state.lists.find((item) => item.id === listId);
  const pendingRollback = state.pendingMutations.filter(
    (mutation) => mutation.listId === listId,
  );
  const rollback = list
    ? {
        list,
        tasks: state.tasks.filter((task) => task.listId === listId),
        recipes: state.recipes.filter((recipe) => recipe.listId === listId),
        members: state.members.filter((member) => member.listId === listId),
      }
    : undefined;
  useTodos.getState().removeSharedList(listId);
  let client: Awaited<ReturnType<typeof authenticatedClient>>;
  try {
    client = await authenticatedClient();
    const { error } = await client.rpc('delete_todo_list', {
      requested_list_id: listId,
    });
    if (error) throw new TodoCollaborationError(error.message);
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

export function subscribeToTodoList(
  list: Pick<TodoList, 'id'>,
  onChange: () => void,
): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  return client
    .channel(`todo:list:${list.id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, onChange)
    .subscribe();
}
