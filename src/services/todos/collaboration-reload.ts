import { useChecklists } from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  ChecklistCollaborationError,
} from './collaboration-core';
import { loadChecklistInvites } from './collaboration-invites';
import {
  flushChecklistMutations,
  fetchChecklistSnapshot,
} from './collaboration-mutations';

let sharedCatalogLoad: Promise<void> | null = null;

export async function loadAllSharedChecklists(): Promise<void> {
  if (sharedCatalogLoad) return sharedCatalogLoad;
  sharedCatalogLoad = loadSharedTodoCatalog().finally(() => {
    sharedCatalogLoad = null;
  });
  return sharedCatalogLoad;
}

async function loadSharedTodoCatalog(): Promise<void> {
  const client = await authenticatedClient();
  await flushChecklistMutations();
  const { data, error } = await client.rpc('todo_shared_list_ids');
  if (error) {
    throw new ChecklistCollaborationError(
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
  const pendingListIds = new Set(
    useChecklists
      .getState()
      .pendingMutations.map((mutation) => mutation.listId),
  );
  const dropIds = useChecklists
    .getState()
    .lists.filter(
      (list) =>
        list.mode === 'shared' &&
        !remoteIds.has(list.id) &&
        !pendingListIds.has(list.id),
    )
    .map((list) => list.id);
  const fetched = await Promise.all(
    ids.map((id) =>
      pendingListIds.has(id) ? Promise.resolve('skipped' as const) : fetchChecklistSnapshot(id),
    ),
  );
  const snapshots = fetched.flatMap((snapshot) =>
    snapshot && snapshot !== 'skipped' ? [snapshot] : [],
  );
  const missingIds = ids.filter((id, index) => {
    if (pendingListIds.has(id)) return false;
    return fetched[index] !== 'skipped' && !fetched[index];
  });
  useChecklists.getState().replaceSharedSnapshots(snapshots, {
    dropIds: [...dropIds, ...missingIds],
  });
  await loadChecklistInvites();
}
