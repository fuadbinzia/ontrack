import {
    cleanupRecipeMutationMedia,
    prepareRecipeMutationMedia,
} from '@/services/todos/recipe-media';
import type { PendingChecklistMutation } from '@/store/todos';

describe('recipe mutation media lifecycle', () => {
  const remove = jest.fn(async () => ({ data: null, error: null }));
  const rpc = jest.fn(async () => ({ data: { recipes: [] }, error: null }));
  const client = {
    rpc,
    storage: {
      from: () => ({
        remove,
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
      }),
    },
  } as never;

  beforeEach(() => {
    remove.mockClear();
    rpc.mockClear();
    rpc.mockResolvedValue({ data: { recipes: [] }, error: null });
  });

  it('uploads thumbnails for update_recipe when only a local URI exists', async () => {
    const upload = jest.fn(async () => ({ data: { path: 'list-1/r1.jpg' }, error: null }));
    const uploadClient = {
      storage: {
        from: () => ({
          remove,
          upload,
          createSignedUrl: jest.fn(),
        }),
      },
    } as never;
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    try {
      const prepared = await prepareRecipeMutationMedia(uploadClient, {
        id: 'm0',
        listId: 'list-1',
        operation: 'update_recipe',
        createdAt: '2026-08-05T00:00:00.000Z',
        payload: {
          recipe: {
            id: 'r1',
            listId: 'list-1',
            name: 'Soup',
            sourceImageUri: 'https://example.com/soup.jpg',
            createdAt: '2026-08-05T00:00:00.000Z',
            updatedAt: '2026-08-05T00:00:00.000Z',
          },
        },
      });
      expect(upload).toHaveBeenCalled();
      expect(
        (prepared.payload.recipe as { sourceImagePath?: string }).sourceImagePath,
      ).toBe('list-1/r1.jpg');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not delete thumbnails while preparing clear/delete mutations', async () => {
    const clearMutation: PendingChecklistMutation = {
      id: 'm1',
      listId: 'list-1',
      operation: 'clear_completed',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        deletedRecipes: [
          { id: 'recipe-1', sourceImagePath: 'list-1/recipe-1.jpg' },
        ],
      },
    };
    const deleteMutation: PendingChecklistMutation = {
      id: 'm2',
      listId: 'list-1',
      operation: 'delete_recipe',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        recipeId: 'recipe-2',
        sourceImagePath: 'list-1/recipe-2.jpg',
      },
    };

    await expect(
      prepareRecipeMutationMedia(client, clearMutation),
    ).resolves.toBe(clearMutation);
    await expect(
      prepareRecipeMutationMedia(client, deleteMutation),
    ).resolves.toBe(deleteMutation);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes thumbnails only during post-ack cleanup', async () => {
    await cleanupRecipeMutationMedia(client, {
      id: 'm1',
      listId: 'list-1',
      operation: 'delete_recipe',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        recipeId: 'recipe-2',
        sourceImagePath: 'list-1/recipe-2.jpg',
      },
    });
    expect(remove).toHaveBeenCalledWith(['list-1/recipe-2.jpg']);
  });

  it('cleans up orphaned recipe media after last-ingredient delete_task', async () => {
    await cleanupRecipeMutationMedia(client, {
      id: 'm3',
      listId: 'list-1',
      operation: 'delete_task',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        taskId: 'task-1',
        deleteRecipeId: 'recipe-3',
        sourceImagePath: 'list-1/recipe-3.jpg',
      },
    });
    expect(rpc).toHaveBeenCalledWith('todo_list_snapshot', {
      requested_list_id: 'list-1',
    });
    expect(remove).toHaveBeenCalledWith(['list-1/recipe-3.jpg']);
  });

  it('does not delete media when delete_task left the recipe alive', async () => {
    rpc.mockResolvedValue({
      data: { recipes: [{ id: 'recipe-3' }] },
      error: null,
    });
    await cleanupRecipeMutationMedia(client, {
      id: 'm4',
      listId: 'list-1',
      operation: 'delete_task',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        taskId: 'task-1',
        deleteRecipeId: 'recipe-3',
        sourceImagePath: 'list-1/recipe-3.jpg',
      },
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not delete media when the recipe snapshot cannot be loaded', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'timeout' },
    });
    await cleanupRecipeMutationMedia(client, {
      id: 'm5',
      listId: 'list-1',
      operation: 'delete_task',
      createdAt: '2026-08-05T00:00:00.000Z',
      payload: {
        taskId: 'task-1',
        deleteRecipeId: 'recipe-3',
        sourceImagePath: 'list-1/recipe-3.jpg',
      },
    });
    expect(remove).not.toHaveBeenCalled();
  });
});
