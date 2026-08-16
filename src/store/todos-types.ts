/** Todo domain types — kept separate from the Zustand store for agent locality. */

export type TodoListMode = 'private' | 'shared';
export type TodoListRole = 'owner' | 'editor' | 'member';
export type TodoListKind = 'checklist' | 'grocery';
export type TodoRecipeSourceKind = 'url' | 'image';

export interface TodoList {
  id: string;
  name: string;
  kind: TodoListKind;
  mode: TodoListMode;
  role: TodoListRole;
  ownerUserId?: string;
  ownerName?: string;
  shareCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoCategory {
  id: string;
  listId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoRecipe {
  id: string;
  listId: string;
  name: string;
  sourceKind: TodoRecipeSourceKind;
  sourceUrl?: string;
  sourceImageUri?: string;
  sourceImagePath?: string;
  originalServings?: number;
  targetServings?: number;
  position?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoIngredientInput {
  name: string;
  canonicalKey?: string;
  quantityValue?: number;
  quantityText?: string;
  unit?: string;
  preparation?: string;
  originalText?: string;
  confidence?: number;
}

export interface TodoRecipeInput {
  name: string;
  sourceKind: TodoRecipeSourceKind;
  sourceUrl?: string;
  sourceImageUri?: string;
  originalServings?: number;
  targetServings?: number;
  ingredients: TodoIngredientInput[];
}

export interface TodoTask {
  id: string;
  listId: string;
  position?: number;
  categoryId?: string;
  recipeId?: string;
  ingredientPosition?: number;
  ingredientName?: string;
  canonicalKey?: string;
  quantityValue?: number;
  quantityText?: string;
  unit?: string;
  preparation?: string;
  originalText?: string;
  confidence?: number;
  title: string;
  completed: boolean;
  important: boolean;
  /** Empty / omitted = Anyone. Multiple members may share a task. */
  assigneeUserIds?: string[];
  completedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  version: number;
}

export interface TodoMember {
  listId: string;
  userId: string;
  displayName: string;
  role: TodoListRole;
  joinedAt: string;
}

export interface TodoInvite {
  id: string;
  listId: string;
  listName: string;
  inviterName: string;
  code: string;
  createdAt: string;
}

export type TodoMutationOperation =
  | 'rename_list'
  | 'set_list_kind'
  | 'add_category'
  | 'delete_category'
  | 'set_task_category'
  | 'add_task'
  | 'add_recipe'
  | 'update_recipe'
  | 'delete_recipe'
  | 'update_ingredient'
  | 'reorder_tasks'
  | 'reorder_recipes'
  | 'update_task'
  | 'delete_task'
  | 'set_completion'
  | 'set_tasks_completion'
  | 'set_assignee'
  | 'clear_completed';

export interface PendingTodoMutation {
  id: string;
  listId: string;
  operation: TodoMutationOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

export interface TodoPersistedState {
  groceryMigrationVersion: 1;
  lists: TodoList[];
  categories: TodoCategory[];
  tasks: TodoTask[];
  recipes: TodoRecipe[];
  members: TodoMember[];
  invites: TodoInvite[];
  pendingMutations: PendingTodoMutation[];
  /** Local-only; opening a list does not sync as an edit. */
  listOpenedAt: Record<string, string>;
}

export interface TodoSharedSnapshot {
  list: TodoList;
  categories?: TodoCategory[];
  tasks: TodoTask[];
  recipes?: TodoRecipe[];
  members: TodoMember[];
}
