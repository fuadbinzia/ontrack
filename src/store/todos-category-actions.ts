import { newUuid } from '@/utils/id';
import {
  canEditChecklistContent,
  markGuestEdit,
  queuedMutation,
  resolveListCategoryId,
} from './todos-helpers';
import { cleanName, nowIso } from './todos-normalize';
import type { ChecklistCategory, ChecklistPersistedState } from './todos-types';

type CategorySet = (
  partial:
    | Partial<ChecklistPersistedState>
    | ((state: ChecklistPersistedState) => Partial<ChecklistPersistedState>),
) => void;

type CategoryGet = () => ChecklistPersistedState;

export type ChecklistCategoryActions = {
  addCategory: (listId: string, name: string) => ChecklistCategory | undefined;
  deleteCategory: (id: string) => void;
  setTaskCategory: (taskId: string, categoryId?: string) => void;
};

export function createChecklistCategoryActions(
  set: CategorySet,
  get: CategoryGet,
): ChecklistCategoryActions {
  return {
    addCategory: (listId, name) => {
      const list = get().lists.find((item) => item.id === listId);
      const clean = cleanName(name).slice(0, 40);
      if (!list || !canEditChecklistContent(list) || !clean) return undefined;
      if (
        get().categories.some(
          (category) =>
            category.listId === listId &&
            category.name.localeCompare(clean, undefined, {
              sensitivity: 'base',
            }) === 0,
        )
      )
        return undefined;
      const now = nowIso();
      const positions = get()
        .categories.filter((category) => category.listId === listId)
        .map((category) => category.position);
      const category: ChecklistCategory = {
        id: newUuid(),
        listId,
        name: clean,
        position: positions.length ? Math.max(...positions) + 1 : 0,
        createdAt: now,
        updatedAt: now,
      };
      markGuestEdit();
      set((state) => ({
        categories: [...state.categories, category],
        lists: state.lists.map((item) =>
          item.id === listId ? { ...item, updatedAt: now } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'add_category', { category }),
        ],
      }));
      return category;
    },

    deleteCategory: (id) => {
      const category = get().categories.find((item) => item.id === id);
      const list = category
        ? get().lists.find((item) => item.id === category.listId)
        : undefined;
      if (!category || !list || !canEditChecklistContent(list)) return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        categories: state.categories.filter((item) => item.id !== id),
        tasks: state.tasks.map((task) =>
          task.categoryId === id
            ? { ...task, categoryId: undefined, updatedAt }
            : task,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'delete_category', { categoryId: id }),
        ],
      }));
    },

    setTaskCategory: (taskId, categoryId) => {
      const task = get().tasks.find((item) => item.id === taskId);
      const list = task
        ? get().lists.find((item) => item.id === task.listId)
        : undefined;
      const resolvedCategoryId = resolveListCategoryId(
        get().categories,
        task?.listId ?? '',
        categoryId,
      );
      if (
        !task ||
        !list ||
        !canEditChecklistContent(list) ||
        (categoryId && !resolvedCategoryId)
      )
        return;
      if (task.categoryId === categoryId) return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) =>
          item.id === taskId ? { ...item, categoryId, updatedAt } : item,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'set_task_category', {
            taskId,
            categoryId: categoryId ?? null,
          }),
        ],
      }));
    },
  };
}
