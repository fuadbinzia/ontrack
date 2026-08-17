import { persist } from 'zustand/middleware';
import { createWithEqualityFn as create } from 'zustand/traditional';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { createChecklistCategoryActions } from './todos-category-actions';
import { createChecklistListActions } from './todos-list-actions';
import { normalizeChecklistState } from './todos-normalize';
import { createChecklistRecipeActions } from './todos-recipe-actions';
import { createChecklistSyncActions } from './todos-sync-actions';
import { createChecklistTaskActions } from './todos-task-actions';
import type {
    Checklist,
    ChecklistCategory,
    ChecklistIngredientInput,
    ChecklistInvite,
    ChecklistKind,
    ChecklistPersistedState,
    ChecklistRecipe,
    ChecklistRecipeInput,
    ChecklistSharedSnapshot,
    ChecklistTask,
} from './todos-types';

export {
    canonicalIngredientKey, DEFAULT_CHECKLIST_NAME,
    DEFAULT_GROCERY_LIST_NAME, formatIngredientTitle,
    isGroceryListName,
    normalizeChecklistState,
    normalizeChecklistTasks
} from './todos-normalize';

export {
    canCompleteChecklistTask,
    canDeleteChecklist,
    canEditChecklistContent,
    canLeaveChecklist,
    privateChecklistPayload
} from './todos-helpers';

export type {
    Checklist, ChecklistCategory,
    ChecklistIngredientInput,
    ChecklistInvite, ChecklistKind, ChecklistMember, ChecklistMode, ChecklistMutationOperation,
    ChecklistPersistedState,
    ChecklistRecipe,
    ChecklistRecipeInput,
    ChecklistRecipeSourceKind, ChecklistRole, ChecklistSharedSnapshot,
    ChecklistTask, PendingChecklistMutation
} from './todos-types';

interface ChecklistState extends ChecklistPersistedState {
  syncError?: string;
  createList: (name: string, kind?: ChecklistKind) => Checklist | undefined;
  reorderLists: (orderedIds: string[]) => void;
  reorderTasks: (listId: string, orderedIds: string[]) => void;
  reorderRecipes: (listId: string, orderedIds: string[]) => void;
  renameList: (id: string, name: string) => void;
  setListKind: (id: string, kind: ChecklistKind) => boolean;
  deleteList: (id: string) => void;
  touchList: (id: string, at?: string) => boolean;
  addCategory: (listId: string, name: string) => ChecklistCategory | undefined;
  deleteCategory: (id: string) => void;
  setTaskCategory: (taskId: string, categoryId?: string) => void;
  addTask: (listId: string, title?: string, categoryId?: string) => ChecklistTask | undefined;
  addRecipe: (listId: string, input: ChecklistRecipeInput) => ChecklistRecipe | undefined;
  updateRecipe: (
    id: string,
    patch: Partial<Pick<ChecklistRecipe, 'name' | 'sourceUrl' | 'targetServings'>>,
  ) => void;
  deleteRecipe: (id: string) => void;
  updateIngredient: (id: string, patch: Partial<ChecklistIngredientInput>) => void;
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
}

const initialState = normalizeChecklistState(undefined);

export const useChecklists = create<ChecklistState>()(
  persist(
    (set, get) => ({
      ...initialState,
      syncError: undefined,
      ...createChecklistListActions(set, get),
      ...createChecklistCategoryActions(set, get),
      ...createChecklistTaskActions(set, get),
      ...createChecklistRecipeActions(set, get),
      ...createChecklistSyncActions(set),
    }),
    {
      name: STORAGE_KEYS.checklists,
      storage: createPersistStorage(),
      version: 4,
      migrate: (persistedState) => normalizeChecklistState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeChecklistState(persistedState),
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
          listOrderHint: state.listOrderHint,
        }) as ChecklistState,
    },
  ),
);
