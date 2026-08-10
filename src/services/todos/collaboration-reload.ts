import { useTodos } from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  TodoCollaborationError,
} from './collaboration-core';
import { loadTodoInvites } from './collaboration-invites';
import {
  flushTodoMutations,
  loadTodoListSnapshot,
} from './collaboration-mutations';

export async function loadAllSharedTodoLists(): Promise<void> {
  const client = await authenticatedClient();
  await flushTodoMutations();
  const { data, error } = await client.rpc('todo_shared_list_ids');
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'Shared lists could not be loaded.'),
    );
  }
  const ids = Array.isArray(data)
    ? data.flatMap((row) =>
        row && typeof row === 'object' && typeof row.list_id === 'string'
          ? [row.list_id]
          : [],
      )
    : [];
  const remoteIds = new Set(ids);
  for (const list of useTodos.getState().lists) {
    if (list.mode === 'shared' && !remoteIds.has(list.id)) {
      useTodos.getState().removeSharedList(list.id);
    }
  }
  const pendingListIds = new Set(
    useTodos
      .getState()
      .pendingMutations.map((mutation) => mutation.listId),
  );
  await Promise.all(
    ids.map((id) =>
      // Keep optimistic local edits when flush could not clear the queue.
      pendingListIds.has(id) ? Promise.resolve() : loadTodoListSnapshot(id),
    ),
  );
  await loadTodoInvites();
}
