import { newUuid } from '@/utils/id';
import {
  canEditTodoContent,
  markGuestEdit,
  queuedMutation,
} from './todos-helpers';
import { cleanName, nowIso } from './todos-normalize';
import type {
  TodoList,
  TodoListKind,
  TodoPersistedState,
} from './todos-types';

type ListSet = (
  partial:
    | Partial<TodoPersistedState>
    | ((state: TodoPersistedState) => Partial<TodoPersistedState>),
) => void;

type ListGet = () => TodoPersistedState;

export type TodoListActions = {
  createList: (name: string, kind?: TodoListKind) => TodoList | undefined;
  reorderLists: (orderedIds: string[]) => void;
  reorderTasks: (listId: string, orderedIds: string[]) => void;
  reorderRecipes: (listId: string, orderedIds: string[]) => void;
  renameList: (id: string, name: string) => void;
  setListKind: (id: string, kind: TodoListKind) => boolean;
  deleteList: (id: string) => void;
};

export function createTodoListActions(set: ListSet, get: ListGet): TodoListActions {
  return {
    createList: (name, kind = 'checklist') => {
      const clean = cleanName(name);
      if (!clean) return undefined;
      const now = nowIso();
      const list: TodoList = {
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
      const now = Date.now();
      const reordered = orderedIds.flatMap((id, index) => {
        const list = listsById.get(id);
        if (!list || seen.has(id)) return [];
        seen.add(id);
        return [{ ...list, updatedAt: new Date(now - index).toISOString() }];
      });
      const unchanged = get().lists.filter((list) => !seen.has(list.id));
      if (reordered.length === 0) return;
      markGuestEdit();
      set({ lists: [...reordered, ...unchanged] });
    },

    reorderTasks: (listId, orderedIds) => {
      const list = get().lists.find((item) => item.id === listId);
      if (!list || !canEditTodoContent(list)) return;
      const positions = new Map(orderedIds.map((id, index) => [id, index]));
      if (positions.size === 0) return;
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((task) => {
          const position = positions.get(task.id);
          return task.listId === listId && position !== undefined
            ? { ...task, position }
            : task;
        }),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'reorder_tasks', {
            orderedIds: [...positions.keys()],
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
      if (!list || list.role !== 'owner' || list.mode === 'shared') return;
      markGuestEdit();
      set((state) => ({
        lists: state.lists.filter((item) => item.id !== id),
        categories: state.categories.filter((category) => category.listId !== id),
        tasks: state.tasks.filter((task) => task.listId !== id),
        recipes: state.recipes.filter((recipe) => recipe.listId !== id),
        members: state.members.filter((member) => member.listId !== id),
      }));
    },

  };
}
