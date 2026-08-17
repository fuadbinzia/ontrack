import { newUuid } from '@/utils/id';
import {
  canCompleteChecklistTask,
  canEditChecklistContent,
  markGuestEdit,
  queuedMutation,
  resolveListCategoryId,
} from './todos-helpers';
import { cleanTitle, nowIso } from './todos-normalize';
import type {
  ChecklistPersistedState,
  ChecklistTask,
} from './todos-types';

type TaskSet = (
  partial:
    | Partial<ChecklistPersistedState>
    | ((state: ChecklistPersistedState) => Partial<ChecklistPersistedState>),
) => void;

type TaskGet = () => ChecklistPersistedState & {
  setTaskCompletion: (
    id: string,
    completed: boolean,
    actorUserId?: string,
  ) => void;
};

export type ChecklistTaskActions = {
  addTask: (listId: string, title?: string, categoryId?: string) => ChecklistTask | undefined;
  updateTask: (id: string, title: string) => void;
  setTaskCompletion: (id: string, completed: boolean, actorUserId?: string) => void;
  setTasksCompletion: (
    ids: string[],
    completed: boolean,
    actorUserId?: string,
  ) => void;
  toggleTask: (id: string, actorUserId?: string) => void;
  toggleImportant: (id: string) => void;
  setAssignee: (id: string, assigneeUserIds?: string[]) => void;
  deleteTask: (id: string) => void;
  clearCompleted: (listId?: string) => void;
};

export function createChecklistTaskActions(set: TaskSet, get: TaskGet): ChecklistTaskActions {
  const actions: ChecklistTaskActions = {
    addTask: (listId, maybeTitle, categoryId) => {
      const legacyCall = maybeTitle === undefined;
      const list = legacyCall ? get().lists[0] : get().lists.find((item) => item.id === listId);
      const clean = cleanTitle(legacyCall ? listId : maybeTitle);
      if (!list || !canEditChecklistContent(list) || !clean) return undefined;
      const resolvedCategoryId = resolveListCategoryId(
        get().categories,
        list.id,
        categoryId,
      );
      const now = nowIso();
      const positions = get().tasks
        .filter((task) => task.listId === list.id)
        .flatMap((task) =>
          typeof task.position === 'number' ? [task.position] : [],
        );
      const task: ChecklistTask = {
        id: newUuid(),
        listId: list.id,
        categoryId: resolvedCategoryId,
        position: positions.length ? Math.min(...positions) - 1 : 0,
        title: clean,
        completed: false,
        important: false,
        createdAt: now,
        updatedAt: now,
        version: 0,
      };
      markGuestEdit();
      set((state) => ({
        tasks: [task, ...state.tasks],
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt: now } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'add_task', { task }),
          ...(resolvedCategoryId
            ? queuedMutation(list, 'set_task_category', {
                taskId: task.id,
                categoryId: resolvedCategoryId,
              })
            : []),
        ],
      }));
      return task;
    },

    updateTask: (id, title) => {
      const clean = cleanTitle(title);
      const task = get().tasks.find((item) => item.id === id);
      const list = task ? get().lists.find((item) => item.id === task.listId) : undefined;
      if (!clean || !task || !list || !canEditChecklistContent(list)) return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) =>
          item.id === id ? { ...item, title: clean, updatedAt } : item,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'update_task', { taskId: id, title: clean }),
        ],
      }));
    },

    setTaskCompletion: (id, completed, actorUserId) => {
      const task = get().tasks.find((item) => item.id === id);
      const list = task ? get().lists.find((item) => item.id === task.listId) : undefined;
      if (!task || !list || !canCompleteChecklistTask(list, task, actorUserId)) return;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) =>
          item.id === id
            ? {
                ...item,
                completed,
                completedAt: completed ? updatedAt : undefined,
                completedByUserId: completed ? actorUserId : undefined,
                updatedAt,
              }
            : item,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'set_completion', {
            taskId: id,
            completed,
          }),
        ],
      }));
    },

    setTasksCompletion: (ids, completed, actorUserId) => {
      const requestedIds = new Set(ids);
      if (requestedIds.size === 0) return;
      const listsById = new Map(get().lists.map((list) => [list.id, list]));
      const allowedTasks = get().tasks.filter((task) => {
        const list = listsById.get(task.listId);
        return (
          requestedIds.has(task.id) &&
          Boolean(list && canCompleteChecklistTask(list, task, actorUserId))
        );
      });
      if (allowedTasks.length === 0) return;

      const updatedAt = nowIso();
      const allowedIds = new Set(allowedTasks.map((task) => task.id));
      const groupedIds = new Map<string, string[]>();
      for (const task of allowedTasks) {
        groupedIds.set(task.listId, [
          ...(groupedIds.get(task.listId) ?? []),
          task.id,
        ]);
      }
      const mutations = [...groupedIds.entries()].flatMap(
        ([listId, taskIds]) =>
          queuedMutation(
            listsById.get(listId),
            'set_tasks_completion',
            { taskIds, completed },
          ),
      );

      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((task) =>
          allowedIds.has(task.id)
            ? {
                ...task,
                completed,
                completedAt: completed ? updatedAt : undefined,
                completedByUserId: completed ? actorUserId : undefined,
                updatedAt,
              }
            : task,
        ),
        lists: state.lists.map((list) =>
          groupedIds.has(list.id) ? { ...list, updatedAt } : list,
        ),
        pendingMutations: [...state.pendingMutations, ...mutations],
      }));
    },

    toggleTask: (id, actorUserId) => {
      const task = get().tasks.find((item) => item.id === id);
      if (task) actions.setTaskCompletion(id, !task.completed, actorUserId);
    },

    toggleImportant: (id) => {
      const task = get().tasks.find((item) => item.id === id);
      const list = task ? get().lists.find((item) => item.id === task.listId) : undefined;
      if (!task || !list || !canEditChecklistContent(list)) return;
      const important = !task.important;
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) =>
          item.id === id ? { ...item, important, updatedAt } : item,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'update_task', { taskId: id, important }),
        ],
      }));
    },

    setAssignee: (id, assigneeUserIds) => {
      const task = get().tasks.find((item) => item.id === id);
      const list = task ? get().lists.find((item) => item.id === task.listId) : undefined;
      if (!task || !list || !canEditChecklistContent(list)) return;
      const nextAssignees = Array.from(
        new Set(
          (assigneeUserIds ?? []).filter(
            (userId): userId is string => Boolean(userId),
          ),
        ),
      );
      const updatedAt = nowIso();
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.map((item) =>
          item.id === id
            ? {
                ...item,
                assigneeUserIds:
                  nextAssignees.length > 0 ? nextAssignees : undefined,
                updatedAt,
              }
            : item,
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'set_assignee', {
            taskId: id,
            assigneeUserIds: nextAssignees,
            // Legacy single field for in-flight clients during rollout.
            assigneeUserId: nextAssignees[0] ?? null,
          }),
        ],
      }));
    },

    deleteTask: (id) => {
      const task = get().tasks.find((item) => item.id === id);
      const list = task ? get().lists.find((item) => item.id === task.listId) : undefined;
      if (!task || !list || !canEditChecklistContent(list)) return;
      const updatedAt = nowIso();
      const deleteRecipeId =
        task.recipeId &&
        !get().tasks.some(
          (item) => item.recipeId === task.recipeId && item.id !== task.id,
        )
          ? task.recipeId
          : undefined;
      const deleteRecipeImagePath = deleteRecipeId
        ? get().recipes.find((recipe) => recipe.id === deleteRecipeId)
            ?.sourceImagePath
        : undefined;
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.filter((item) => item.id !== id),
        recipes: deleteRecipeId
          ? state.recipes.filter((recipe) => recipe.id !== deleteRecipeId)
          : state.recipes,
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'delete_task', {
            taskId: id,
            deleteRecipeId,
            ...(deleteRecipeImagePath
              ? { sourceImagePath: deleteRecipeImagePath }
              : {}),
          }),
        ],
      }));
    },

    clearCompleted: (listId) => {
      const list = listId
        ? get().lists.find((item) => item.id === listId)
        : get().lists[0];
      if (!list || !canEditChecklistContent(list)) return;
      const completedIds = get().tasks
        .filter((task) => task.listId === list.id && task.completed)
        .map((task) => task.id);
      if (completedIds.length === 0) return;
      const updatedAt = nowIso();
      const completedIdSet = new Set(completedIds);
      const remainingRecipeIds = new Set(
        get().tasks
          .filter(
            (task) =>
              task.listId === list.id &&
              !completedIdSet.has(task.id) &&
              task.recipeId,
          )
          .map((task) => task.recipeId as string),
      );
      const deletedRecipes = get().recipes
        .filter(
          (recipe) =>
            recipe.listId === list.id && !remainingRecipeIds.has(recipe.id),
        )
        .map((recipe) => ({
          id: recipe.id,
          sourceImagePath: recipe.sourceImagePath,
        }));
      markGuestEdit();
      set((state) => ({
        tasks: state.tasks.filter((task) => !completedIds.includes(task.id)),
        recipes: state.recipes.filter(
          (recipe) =>
            recipe.listId !== list.id || remainingRecipeIds.has(recipe.id),
        ),
        lists: state.lists.map((item) =>
          item.id === list.id ? { ...item, updatedAt } : item,
        ),
        pendingMutations: [
          ...state.pendingMutations,
          ...queuedMutation(list, 'clear_completed', { deletedRecipes }),
        ],
      }));
    },

  };
  return actions;
}
