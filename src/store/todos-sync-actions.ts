import {
    insertListByOrderHint,
    normalizeCategory,
    normalizeChecklistState,
    normalizeInvite,
    normalizeList,
    normalizeMember,
    normalizeRecipe,
    normalizeTask,
    omitListOpenedAt,
    sameChecklist,
} from './todos-normalize';
import type {
    ChecklistInvite,
    ChecklistPersistedState,
    ChecklistSharedSnapshot,
} from './todos-types';

type SyncSet = (
  partial:
    | Partial<ChecklistPersistedState & { syncError?: string }>
    | ((
        state: ChecklistPersistedState & { syncError?: string },
      ) => Partial<ChecklistPersistedState & { syncError?: string }>),
) => void;

export type ChecklistSyncActions = {
  replacePrivateData: (value: unknown) => void;
  replaceSharedSnapshot: (snapshot: ChecklistSharedSnapshot) => void;
  replaceSharedSnapshots: (
    snapshots: ChecklistSharedSnapshot[],
    options?: { dropIds?: readonly string[] },
  ) => void;
  removeSharedList: (listId: string) => void;
  setShareCode: (listId: string, code?: string) => void;
  replaceInvites: (invites: ChecklistInvite[]) => void;
  markMutationAttempt: (id: string) => void;
  acknowledgeMutation: (id: string) => void;
  rejectMutation: (id: string, message: string) => void;
  clearSyncError: () => void;
  reset: () => void;
};

function linkedTravelPackingListIds(): Set<string> {
  try {
    // Lazy require: importing travel at module load also pulls sync-session
    // (and its supabase client) into todo-only tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
    return new Set(
      useTravel.getState().plans.flatMap((plan) =>
        plan.packingListId ? [plan.packingListId] : [],
      ),
    );
  } catch {
    return new Set();
  }
}

function keepSharedOrLocal(
  listId: string,
  sharedIds: Set<string>,
  keptLocalOnlyIds: Set<string>,
): boolean {
  return sharedIds.has(listId) || keptLocalOnlyIds.has(listId);
}

function dropSharedList(
  state: ChecklistPersistedState,
  listId: string,
): ChecklistPersistedState {
  return {
    ...state,
    lists: state.lists.filter((list) => list.id !== listId),
    categories: state.categories.filter((category) => category.listId !== listId),
    tasks: state.tasks.filter((task) => task.listId !== listId),
    recipes: state.recipes.filter((recipe) => recipe.listId !== listId),
    members: state.members.filter((member) => member.listId !== listId),
    pendingMutations: state.pendingMutations.filter(
      (mutation) => mutation.listId !== listId,
    ),
    listOpenedAt: omitListOpenedAt(state.listOpenedAt, listId),
  };
}

function mergeSharedSnapshot(
  state: ChecklistPersistedState,
  snapshot: ChecklistSharedSnapshot,
): ChecklistPersistedState {
  const list = normalizeList({ ...snapshot.list, mode: 'shared' }, false);
  if (!list) return state;
  const tasks = snapshot.tasks.flatMap((item) => {
    const task = normalizeTask({ ...item, listId: list.id }, list.id);
    return task ? [task] : [];
  });
  const categories = (snapshot.categories ?? []).flatMap((item) => {
    const category = normalizeCategory({ ...item, listId: list.id });
    return category ? [category] : [];
  });
  const recipes = (snapshot.recipes ?? []).flatMap((item) => {
    const recipe = normalizeRecipe({ ...item, listId: list.id });
    return recipe ? [recipe] : [];
  });
  const members = snapshot.members.flatMap((item) => {
    const member = normalizeMember({ ...item, listId: list.id });
    return member ? [member] : [];
  });
  const existingIndex = state.lists.findIndex((item) => item.id === list.id);
  const nextList = {
    ...list,
    shareCode:
      list.shareCode ??
      state.lists.find((item) => item.id === list.id)?.shareCode,
  };
  const existing = existingIndex >= 0 ? state.lists[existingIndex] : undefined;
  const lists =
    existing && sameChecklist(existing, nextList)
      ? state.lists
      : existingIndex >= 0
        ? state.lists.map((item, index) =>
            index === existingIndex ? nextList : item,
          )
        : insertListByOrderHint(state.lists, nextList, state.listOrderHint);
  const nextCategories = snapshot.categories === undefined
    ? state.categories.filter((item) => item.listId === list.id)
    : categories;
  const categoryIds = new Set(nextCategories.map((category) => category.id));
  const orderedTasks = tasks.map((task, index) => ({
    ...task,
    categoryId:
      task.categoryId && categoryIds.has(task.categoryId)
        ? task.categoryId
        : undefined,
    position: task.position ?? index,
  }));
  return {
    ...state,
    lists,
    tasks: [
      ...orderedTasks,
      ...state.tasks.filter((item) => item.listId !== list.id),
    ],
    categories: [
      ...nextCategories,
      ...state.categories.filter((item) => item.listId !== list.id),
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
}

export function createChecklistSyncActions(set: SyncSet): ChecklistSyncActions {
  return {
    replacePrivateData: (value) => {
      const incoming = normalizeChecklistState(value);
      set((state) => {
        const sharedIds = new Set(
          state.lists.filter((list) => list.mode === 'shared').map((list) => list.id),
        );
        const packingListIds = linkedTravelPackingListIds();
        const incomingPrivate = incoming.lists.filter((list) => list.mode === 'private');
        const incomingById = new Map(incomingPrivate.map((list) => [list.id, list]));
        const retainedIds = new Set<string>();
        const keptLocalOnlyIds = new Set<string>();
        const lists = state.lists.flatMap((list) => {
          if (list.mode === 'shared') return [list];
          const replacement = incomingById.get(list.id);
          if (!replacement) {
            // A trip checklist created this session may not be in the cloud
            // blob yet — dropping it makes Trip Tools mint a duplicate.
            if (packingListIds.has(list.id)) {
              keptLocalOnlyIds.add(list.id);
              retainedIds.add(list.id);
              return [list];
            }
            return [];
          }
          retainedIds.add(list.id);
          return [sameChecklist(list, replacement) ? list : replacement];
        });
        let nextLists = lists;
        for (const list of incomingPrivate) {
          if (retainedIds.has(list.id)) continue;
          nextLists = insertListByOrderHint(
            nextLists,
            list,
            incoming.listOrderHint,
          );
        }
        const listsUnchanged =
          nextLists.length === state.lists.length &&
          nextLists.every((list, index) => list === state.lists[index]);
        const restoredOpenedAt = Object.fromEntries(
          Object.entries(incoming.listOpenedAt).filter(
            ([id]) => !(id in state.listOpenedAt),
          ),
        );
        return {
          lists: listsUnchanged ? state.lists : nextLists,
          listOrderHint: incoming.listOrderHint ?? state.listOrderHint,
          listOpenedAt:
            Object.keys(restoredOpenedAt).length === 0
              ? state.listOpenedAt
              : { ...restoredOpenedAt, ...state.listOpenedAt },
          tasks: [
            ...incoming.tasks.filter((task) =>
              incoming.lists.some(
                (list) => list.id === task.listId && list.mode === 'private',
              ),
            ),
            ...state.tasks.filter((task) =>
              keepSharedOrLocal(task.listId, sharedIds, keptLocalOnlyIds),
            ),
          ],
          categories: [
            ...incoming.categories.filter((category) =>
              incoming.lists.some(
                (list) => list.id === category.listId && list.mode === 'private',
              ),
            ),
            ...state.categories.filter((category) =>
              keepSharedOrLocal(category.listId, sharedIds, keptLocalOnlyIds),
            ),
          ],
          recipes: [
            ...incoming.recipes.filter((recipe) =>
              incoming.lists.some(
                (list) =>
                  list.id === recipe.listId && list.mode === 'private',
              ),
            ),
            ...state.recipes.filter((recipe) =>
              keepSharedOrLocal(recipe.listId, sharedIds, keptLocalOnlyIds),
            ),
          ],
        };
      });
    },

    replaceSharedSnapshot: (snapshot) => {
      set((state) => mergeSharedSnapshot(state, snapshot));
    },

    replaceSharedSnapshots: (snapshots, options) => {
      set((state) => {
        let next = state;
        for (const listId of options?.dropIds ?? []) {
          next = dropSharedList(next, listId);
        }
        for (const snapshot of snapshots) {
          next = mergeSharedSnapshot(next, snapshot);
        }
        return next;
      });
    },

    removeSharedList: (listId) =>
      set((state) => dropSharedList(state, listId)),

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

    reset: () => set({ ...normalizeChecklistState(undefined), syncError: undefined }),
  };
}
