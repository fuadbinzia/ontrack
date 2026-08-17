import { newUuid } from '@/utils/id';
import {
    canDeleteChecklist,
    canEditChecklistContent,
    markGuestEdit,
    queuedMutation,
} from './todos-helpers';
import { cleanName, nowIso, omitListOpenedAt } from './todos-normalize';
import type {
    Checklist,
    ChecklistKind,
    ChecklistPersistedState,
} from './todos-types';

type ListSet = (
  partial:
    | Partial<ChecklistPersistedState>
    | ((state: ChecklistPersistedState) => Partial<ChecklistPersistedState>),
) => void;

type ListGet = () => ChecklistPersistedState;

export type ChecklistListActions = {
  createList: (name: string, kind?: ChecklistKind) => Checklist | undefined;
  reorderLists: (orderedIds: string[]) => void;
  reorderTasks: (listId: string, orderedIds: string[]) => void;
  reorderRecipes: (listId: string, orderedIds: string[]) => void;
  renameList: (id: string, name: string) => void;
  setListKind: (id: string, kind: ChecklistKind) => boolean;
  deleteList: (id: string) => void;
  /** Returns true when the open was recorded (callers flush it to the cloud). */
  touchList: (id: string, at?: string) => boolean;
};

export function createChecklistListActions(set: ListSet, get: ListGet): ChecklistListActions {
  return {
    createList: (name, kind = 'checklist') => {
      const clean = cleanName(name);
      if (!clean) return undefined;
      const now = nowIso();
      const list: Checklist = {
        id: newUuid(),
        name: clean,
        kind,
        mode: 'private',
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      };
      markGuestEdit();
      set((state) => ({ lists: [list, ...state.lists] }));
      return list;
    },

    reorderLists: (orderedIds) => {
      const listsById = new Map(get().lists.map((list) => [list.id, list]));
      const seen = new Set<string>();
      const reordered = orderedIds.flatMap((id) => {
        const list = listsById.get(id);
        if (!list || seen.has(id)) return [];
        seen.add(id);
        return [{ ...list }];
      });
      const unchanged = get().lists.filter((list) => !seen.has(list.id));
      if (reordered.length === 0) return;
      markGuestEdit();
      set({ lists: [...reordered, ...unchanged] });
    },

    reorderTasks: (listId, orderedIds) => {
      const list = get().lists.find((item) => item.id === listId);
      if (!list || !canEditChecklistContent(list)) return;
      const currentOrder = get()
        .tasks.filter((task) => task.listId === listId)
        .sort(
          (left, right) =>
            (left.position ?? Number.MAX_SAFE_INTEGER) -
              (right.position ?? Number.MAX_SAFE_INTEGER) ||
            right.createdAt.localeCompare(left.createdAt) ||
            left.id.localeCompare(right.id),
        );
      const tasksById = new Map(currentOrder.map((task) => [task.id, task]));
      const reorderedIdSet = new Set<string>();
      const reorderedIds = orderedIds.filter((id) => {
        if (!tasksById.has(id) || reorderedIdSet.has(id)) return false;
        reorderedIdSet.add(id);
        return true;
      });
      if (reorderedIds.length === 0) return;
      let reorderedIndex = 0;
      const completeOrder = currentOrder.map((task) =>
        reorderedIdSet.has(task.id)
          ? reorderedIds[reorderedIndex++]
          : task.id,
      );
      const positions = new Map(completeOrder.map((id, index) => [id, index]));
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((task) => {
          const position = positions.get(task.id);
          return task.listId === listId && position !== undefined
            ? { ...task, position, updatedAt }
            : task;
        }),
        lists: state.lists.map((item) =>
          item.id === listId ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'reorder_tasks', {
            orderedIds: completeOrder,
          }),
        ],
      }));
    },

    reorderRecipes: (listId, orderedIds) => {
      const list = get().lists.find((item) => item.id === listId);
      if (!list || list.role !== 'owner') return;
      const positions = new Map(orderedIds.map((id, index) => [id, index]));
      if (positions.size === 0) return;
      markGuestEdit();
      set((state) => ({
        recipes: state.recipes.map((recipe) => {
          const position = positions.get(recipe.id);
          return recipe.listId === listId && position !== undefined
            ? { ...recipe, position }
            : recipe;
        }),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'reorder_recipes', {
            orderedIds: [...positions.keys()],
          }),
        ],
      }));
    },

    renameList: (id, name) => {
      const clean = cleanName(name);
      const list = get().lists.find((item) => item.id === id);
      if (!clean || !list || list.role !== 'owner') return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        lists: state.lists.map((item) =>
          item.id === id ? { ...item, name: clean, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'rename_list', { name: clean }),
        ],
      }));
    },

    setListKind: (id, kind) => {
      const list = get().lists.find((item) => item.id === id);
      if (!list || list.role !== 'owner') return false;
      if (
        kind === 'checklist' &&
        get().recipes.some((recipe) => recipe.listId === id)
      ) {
        return false;
      }
      if (list.kind === kind) return true;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        lists: state.lists.map((item) =>
          item.id === id ? { ...item, kind, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'set_list_kind', { kind }),
        ],
      }));
      return true;
    },

    deleteList: (id) => {
      const list = get().lists.find((item) => item.id === id);
      if (!list || !canDeleteChecklist(list) || list.mode === 'shared') return;
      markGuestEdit();
      set((state) => ({
        lists: state.lists.filter((item) => item.id !== id),
        categories: state.categories.filter((category) => category.listId !== id),
        tasks: state.tasks.filter((task) => task.listId !== id),
        recipes: state.recipes.filter((recipe) => recipe.listId !== id),
        members: state.members.filter((member) => member.listId !== id),
        listOpenedAt: omitListOpenedAt(state.listOpenedAt, id),
      }));
    },

    touchList: (id, at = nowIso()) => {
      const list = get().lists.find((item) => item.id === id);
      if (!list || !at) return false;
      const previous = get().listOpenedAt[id];
      if (previous) {
        if (at <= previous) return false;
        const previousMs = Date.parse(previous);
        const nextMs = Date.parse(at);
        if (
          Number.isFinite(previousMs) &&
          Number.isFinite(nextMs) &&
          nextMs - previousMs < 750
        ) {
          return false;
        }
      }
      set((state) => {
        const index = state.lists.findIndex((item) => item.id === id);
        const listOpenedAt = { ...state.listOpenedAt, [id]: at };
        if (index <= 0) return { listOpenedAt };
        const lists = [...state.lists];
        const [moved] = lists.splice(index, 1);
        lists.unshift(moved);
        return { lists, listOpenedAt };
      });
      return true;
    },

  };
}
