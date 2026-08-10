import {
  cleanupRecipeMutationMedia,
  prepareRecipeMutationMedia,
  resolveSharedRecipeMedia,
} from '@/services/todos/recipe-media';
import {
  type PendingTodoMutation,
  type TodoSharedSnapshot,
  useTodos,
} from '@/store/todos';
import { newUuid } from '@/utils/id';

import {
  authenticatedClient,
  messageFrom,
  sharedSnapshot,
  TodoCollaborationError,
} from './collaboration-core';

export async function loadTodoListSnapshot(
  listId: string,
  options?: { applyWhilePending?: boolean },
): Promise<TodoSharedSnapshot | undefined> {
  if (
    !options?.applyWhilePending &&
    useTodos
      .getState()
      .pendingMutations.some((mutation) => mutation.listId === listId)
  ) {
    // Keep optimistic local edits until the queue for this list drains.
    return undefined;
  }
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('todo_list_snapshot', {
    requested_list_id: listId,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The shared list could not be refreshed.'),
    );
  }
  const parsed = sharedSnapshot(data);
  const snapshot = parsed
    ? await resolveSharedRecipeMedia(client, parsed)
    : undefined;
  if (snapshot) useTodos.getState().replaceSharedSnapshot(snapshot);
  else useTodos.getState().removeSharedList(listId);
  return snapshot;
}

export async function ensureListMutationsFlushed(listId: string) {
  await flushTodoMutations();
  const stillPending = useTodos
    .getState()
    .pendingMutations.some((mutation) => mutation.listId === listId);
  if (stillPending) {
    throw new TodoCollaborationError(
      'Wait for your latest changes to sync before continuing.',
    );
  }
}

export async function publishTodoList(listId: string): Promise<TodoSharedSnapshot> {
  const state = useTodos.getState();
  const list = state.lists.find((item) => item.id === listId);
  if (!list || list.mode !== 'private' || list.role !== 'owner') {
    throw new TodoCollaborationError('Only a private list owner can share it.');
  }
  const client = await authenticatedClient();
  const recipes = state.recipes.filter((recipe) => recipe.listId === list.id);
  // Publish first so storage RLS recognizes list ownership, then upload images.
  const { error } = await client.rpc('publish_todo_list', {
    list_payload: {
      id: list.id,
      name: list.name,
      kind: list.kind,
      recipes: recipes.map((recipe) => ({
        ...recipe,
        sourceImagePath: recipe.sourceImagePath,
        sourceImageUri: undefined,
      })),
      tasks: state.tasks.filter((task) => task.listId === list.id),
    },
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The list could not be shared.'),
    );
  }

  const needingUpload = recipes.filter(
    (recipe) => recipe.sourceImageUri && !recipe.sourceImagePath,
  );
  // Queue thumbnail uploads before snapshot so a failed upload remains retryable
  // via flushTodoMutations after the list becomes shared.
  if (needingUpload.length) {
    const createdAt = new Date().toISOString();
    useTodos.setState((current) => ({
      pendingMutations: [
        ...current.pendingMutations,
        ...needingUpload.map((recipe) => ({
          id: newUuid(),
          listId: list.id,
          operation: 'update_recipe' as const,
          createdAt,
          attempts: 0,
          payload: { recipe },
        })),
      ],
    }));
  }

  // Reconcile local private → shared immediately so retries don't re-insert.
  // Image uploads are intentionally still pending — force-apply the shared shell.
  let snapshot = await loadTodoListSnapshot(listId, {
    applyWhilePending: true,
  });
  if (!snapshot) {
    throw new TodoCollaborationError('The shared list could not be loaded.');
  }

  if (needingUpload.length) {
    // Snapshot drops private file URIs — restore them for UI until upload acks.
    const localUriById = new Map(
      needingUpload.map((recipe) => [recipe.id, recipe.sourceImageUri] as const),
    );
    useTodos.setState((current) => ({
      recipes: current.recipes.map((recipe) => {
        const localUri = localUriById.get(recipe.id);
        return localUri && !recipe.sourceImagePath
          ? { ...recipe, sourceImageUri: localUri }
          : recipe;
      }),
    }));

    // flushTodoMutations swallows transient prep/RPC failures; check pending after.
    await flushTodoMutations();
    const stillPending = useTodos
      .getState()
      .pendingMutations.some(
        (mutation) =>
          mutation.listId === list.id && mutation.operation === 'update_recipe',
      );
    if (stillPending) {
      throw new TodoCollaborationError(
        'Recipe photos could not be shared yet. They will retry automatically.',
      );
    }
    snapshot = (await loadTodoListSnapshot(listId)) ?? snapshot;
  }

  return snapshot;
}

function permanentMutationError(message: string) {
  return /no longer have access|only the list owner|only an editor or owner|assigned to someone else|not a member|Recipes can only be added to Grocery lists/i.test(
    message,
  );
}

function permanentMediaPrepError(message: string) {
  return /recipe thumbnail could not be read/i.test(message);
}

const TODO_MUTATION_BATCH_SIZE = 50;

export async function flushTodoMutations(): Promise<void> {
  const client = await authenticatedClient();
  while (true) {
    const batch = useTodos
      .getState()
      .pendingMutations.slice(0, TODO_MUTATION_BATCH_SIZE);
    if (batch.length === 0) return;
    batch.forEach((mutation) => {
      useTodos.getState().markMutationAttempt(mutation.id);
    });

    // Prepare per mutation so one bad local image cannot stall the queue.
    const preparedResults = await Promise.all(
      batch.map(async (mutation) => {
        try {
          const prepared = await prepareRecipeMutationMedia(client, mutation);
          if (prepared !== mutation) {
            // Persist uploaded path so a later RPC failure does not re-upload.
            useTodos.setState((state) => ({
              pendingMutations: state.pendingMutations.map((item) =>
                item.id === mutation.id
                  ? { ...item, payload: prepared.payload }
                  : item,
              ),
            }));
          }
          return { mutation: prepared };
        } catch (error) {
          return {
            mutation,
            error:
              error instanceof Error
                ? error.message
                : 'Recipe media could not be prepared.',
          };
        }
      }),
    );

    let shouldRetryLater = false;
    const rejectedLists = new Set<string>();
    const ready: PendingTodoMutation[] = [];
    for (const result of preparedResults) {
      if (!result.error) {
        ready.push(result.mutation);
        continue;
      }
      if (permanentMediaPrepError(result.error)) {
        useTodos.getState().rejectMutation(result.mutation.id, result.error);
        rejectedLists.add(result.mutation.listId);
      } else {
        shouldRetryLater = true;
      }
    }

    if (ready.length === 0) {
      await Promise.all(
        [...rejectedLists].map((listId) =>
          // Force reconcile so a permanent reject cannot leave optimistic UI
          // stuck behind sibling soft-failing mutations.
          loadTodoListSnapshot(listId, { applyWhilePending: true }).catch(
            () => undefined,
          ),
        ),
      );
      return;
    }

    const { data, error } = await client.rpc('apply_todo_mutations', {
      mutations: ready.map((mutation) => ({
        id: mutation.id,
        listId: mutation.listId,
        operation: mutation.operation,
        payload: mutation.payload,
      })),
    });
    if (error || !Array.isArray(data)) return;

    const results = new Map<string, { ok: boolean; error?: string }>();
    for (const value of data) {
      if (!value || typeof value !== 'object') continue;
      const result = value as Record<string, unknown>;
      if (typeof result.id !== 'string' || typeof result.ok !== 'boolean') continue;
      results.set(result.id, {
        ok: result.ok,
        error: typeof result.error === 'string' ? result.error : undefined,
      });
    }

    const acknowledged = ready.filter(
      (mutation) => results.get(mutation.id)?.ok,
    );
    for (const mutation of ready) {
      const result = results.get(mutation.id);
      if (result?.ok) {
        useTodos.getState().acknowledgeMutation(mutation.id);
      } else if (result?.error && permanentMutationError(result.error)) {
        useTodos.getState().rejectMutation(mutation.id, result.error);
        rejectedLists.add(mutation.listId);
      } else {
        shouldRetryLater = true;
      }
    }
    await Promise.all(
      acknowledged.map((mutation) =>
        cleanupRecipeMutationMedia(client, mutation).catch(() => undefined),
      ),
    );
    await Promise.all(
      [...rejectedLists].map((listId) =>
        loadTodoListSnapshot(listId, { applyWhilePending: true }).catch(
          () => undefined,
        ),
      ),
    );
    if (shouldRetryLater) return;
  }
}
