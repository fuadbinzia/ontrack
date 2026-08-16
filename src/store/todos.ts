import { persist } from 'zustand/middleware';
import { createWithEqualityFn as create } from 'zustand/traditional';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { createTodoCategoryActions } from './todos-category-actions';
import { createTodoListActions } from './todos-list-actions';
import { normalizeTodoState } from './todos-normalize';
import { createTodoRecipeActions } from './todos-recipe-actions';
import { createTodoSyncActions } from './todos-sync-actions';
import { createTodoTaskActions } from './todos-task-actions';
import type {
  TodoCategory,
  TodoIngredientInput,
  TodoInvite,
  TodoList,
  TodoListKind,
  TodoPersistedState,
  TodoRecipe,
  TodoRecipeInput,
  TodoSharedSnapshot,
  TodoTask,
} from './todos-types';

export {
  DEFAULT_CHECKLIST_NAME,
  DEFAULT_GROCERY_LIST_NAME,
  canonicalIngredientKey,
  formatIngredientTitle,
  isGroceryListName,
  normalizeTodoState,
  normalizeTodoTasks,
} from './todos-normalize';

export {
  canCompleteTodo,
  canDeleteTodoList,
  canEditTodoContent,
  canLeaveTodoList,
  privateTodoPayload,
} from './todos-helpers';

export type {
  PendingTodoMutation,
  TodoCategory,
  TodoIngredientInput,
  TodoInvite,
  TodoList,
  TodoListKind,
  TodoListMode,
  TodoListRole,
  TodoMember,
  TodoMutationOperation,
  TodoPersistedState,
  TodoRecipe,
  TodoRecipeInput,
  TodoRecipeSourceKind,
  TodoSharedSnapshot,
  TodoTask,
} from './todos-types';

interface TodoState extends TodoPersistedState {
  syncError?: string;
  createList: (name: string, kind?: TodoListKind) => TodoList | undefined;
  reorderLists: (orderedIds: string[]) => void;
  reorderTasks: (listId: string, orderedIds: string[]) => void;
  reorderRecipes: (listId: string, orderedIds: string[]) => void;
  renameList: (id: string, name: string) => void;
  setListKind: (id: string, kind: TodoListKind) => boolean;
  deleteList: (id: string) => void;
  touchList: (id: string, at?: string) => void;
  addCategory: (listId: string, name: string) => TodoCategory | undefined;
  deleteCategory: (id: string) => void;
  setTaskCategory: (taskId: string, categoryId?: string) => void;
  addTask: (listId: string, title?: string, categoryId?: string) => TodoTask | undefined;
  addRecipe: (listId: string, input: TodoRecipeInput) => TodoRecipe | undefined;
  updateRecipe: (
    id: string,
    patch: Partial<Pick<TodoRecipe, 'name' | 'sourceUrl' | 'targetServings'>>,
  ) => void;
  deleteRecipe: (id: string) => void;
  updateIngredient: (id: string, patch: Partial<TodoIngredientInput>) => void;
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
}

const initialState = normalizeTodoState(undefined);

export const useTodos = create<TodoState>()(
  persist(
    (set, get) => ({
      ...initialState,
      syncError: undefined,
      ...createTodoListActions(set, get),
      ...createTodoCategoryActions(set, get),
      ...createTodoTaskActions(set, get),
      ...createTodoRecipeActions(set, get),
      ...createTodoSyncActions(set),
    }),
    {
      name: STORAGE_KEYS.todos,
      storage: createPersistStorage(),
      version: 4,
      migrate: (persistedState) => normalizeTodoState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeTodoState(persistedState),
      }),
      partialize: (state) =>
        ({
          groceryMigrationVersion: state.groceryMigrationVersion,
          lists: state.lists,
          categories: state.categories,
          tasks: state.tasks,
          recipes: state.recipes,
          members: state.members,
          invites: state.invites,
          pendingMutations: state.pendingMutations,
          listOpenedAt: state.listOpenedAt,
        }) as TodoState,
    },
  ),
);
