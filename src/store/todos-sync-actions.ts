import {
  normalizeInvite,
  normalizeList,
  normalizeMember,
  normalizeRecipe,
  normalizeTask,
  normalizeTodoState,
} from './todos-normalize';
import type {
  TodoInvite,
  TodoPersistedState,
  TodoSharedSnapshot,
} from './todos-types';

type SyncSet = (
  partial:
    | Partial<TodoPersistedState & { syncError?: string }>
    | ((
        state: TodoPersistedState & { syncError?: string },
      ) => Partial<TodoPersistedState & { syncError?: string }>),
) => void;

export type TodoSyncActions = {
  replacePrivateData: (value: unknown) => void;
  replaceSharedSnapshot: (snapshot: TodoSharedSnapshot) => void;
  removeSharedList: (listId: string) => void;
  setShareCode: (listId: string, code?: string) => void;
  replaceInvites: (invites: TodoInvite[]) => void;
  markMutationAttempt: (id: string) => void;
  acknowledgeMutation: (id: string) => void;
  rejectMutation: (id: string, message: string) => void;
  clearSyncError: () => void;
  reset: () => void;
};

export function createTodoSyncActions(set: SyncSet): TodoSyncActions {
  return {
    replacePrivateData: (value) => {
      const incoming = normalizeTodoState(value);
      set((state) => {
        const sharedIds = new Set(
          state.lists.filter((list) => list.mode === 'shared').map((list) => list.id),
        );
        const incomingPrivate = incoming.lists.filter((list) => list.mode === 'private');
        const incomingById = new Map(incomingPrivate.map((list) => [list.id, list]));
        const retainedIds = new Set<string>();
        const lists = state.lists.flatMap((list) => {
          if (list.mode === 'shared') return [list];
          const replacement = incomingById.get(list.id);
          if (!replacement) return [];
          retainedIds.add(list.id);
          return [replacement];
        });
        return {
          lists: [
            ...lists,
            ...incomingPrivate.filter((list) => !retainedIds.has(list.id)),
          ],
          tasks: [
            ...incoming.tasks.filter((task) =>
              incoming.lists.some(
                (list) => list.id === task.listId && list.mode === 'private',
              ),
            ),
            ...state.tasks.filter((task) => sharedIds.has(task.listId)),
          ],
          recipes: [
            ...incoming.recipes.filter((recipe) =>
              incoming.lists.some(
                (list) =>
                  list.id === recipe.listId && list.mode === 'private',
              ),
            ),
            ...state.recipes.filter((recipe) => sharedIds.has(recipe.listId)),
          ],
        };
      });
    },

    replaceSharedSnapshot: (snapshot) => {
      const list = normalizeList(
        { ...snapshot.list, mode: 'shared' },
        false,
      );
      if (!list) return;
      const tasks = snapshot.tasks.flatMap((item) => {
        const task = normalizeTask(item, list.id);
        return task ? [task] : [];
      });
      const recipes = (snapshot.recipes ?? []).flatMap((item) => {
        const recipe = normalizeRecipe({ ...item, listId: list.id });
        return recipe ? [recipe] : [];
      });
      const members = snapshot.members.flatMap((item) => {
        const member = normalizeMember(item);
        return member ? [member] : [];
      });
      set((state) => {
        // Prefer server positions so collaborator reorders propagate. Pending
        // local mutations skip snapshot apply until flushed.
        const orderedTasks = tasks.map((task, index) => ({
          ...task,
          position: task.position ?? index,
        }));
        const existingIndex = state.lists.findIndex((item) => item.id === list.id);
        const nextList = {
          ...list,
          shareCode:
            list.shareCode ??
            state.lists.find((item) => item.id === list.id)?.shareCode,
        };
        const lists = [...state.lists];
        if (existingIndex >= 0) lists[existingIndex] = nextList;
        else lists.unshift(nextList);
        return {
          lists,
          tasks: [
            ...orderedTasks,
            ...state.tasks.filter((item) => item.listId !== list.id),
          ],
          recipes: [
            ...recipes,
            ...state.recipes.filter((item) => item.listId !== list.id),
          ],
          members: [
            ...members,
            ...state.members.filter((item) => item.listId !== list.id),
          ],
        };
      });
    },

    removeSharedList: (listId) =>
      set((state) => ({
        lists: state.lists.filter((list) => list.id !== listId),
        tasks: state.tasks.filter((task) => task.listId !== listId),
        recipes: state.recipes.filter((recipe) => recipe.listId !== listId),
        members: state.members.filter((member) => member.listId !== listId),
        pendingMutations: state.pendingMutations.filter(
          (mutation) => mutation.listId !== listId,
        ),
      })),

    setShareCode: (listId, shareCode) =>
      set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId ? { ...list, shareCode } : list,
        ),
      })),

    replaceInvites: (invites) =>
      set({
        invites: invites.flatMap((invite) => {
          const normalized = normalizeInvite(invite);
          return normalized ? [normalized] : [];
        }),
      }),

    markMutationAttempt: (id) =>
      set((state) => ({
        pendingMutations: state.pendingMutations.map((mutation) =>
          mutation.id === id
            ? { ...mutation, attempts: mutation.attempts + 1 }
            : mutation,
        ),
      })),

    acknowledgeMutation: (id) =>
      set((state) => ({
        pendingMutations: state.pendingMutations.filter(
          (mutation) => mutation.id !== id,
        ),
        syncError: undefined,
      })),

    rejectMutation: (id, message) =>
      set((state) => ({
        pendingMutations: state.pendingMutations.filter(
          (mutation) => mutation.id !== id,
        ),
        syncError: message,
      })),

    clearSyncError: () => set({ syncError: undefined }),

    reset: () => set({ ...normalizeTodoState(undefined), syncError: undefined }),
  };
}
