/** Checklist domain types — kept separate from the Zustand store for agent locality. */

export type ChecklistMode = 'private' | 'shared';
export type ChecklistRole = 'owner' | 'editor' | 'member';
export type ChecklistKind = 'checklist' | 'grocery';
export type ChecklistRecipeSourceKind = 'url' | 'image';

export interface Checklist {
  id: string;
  name: string;
  kind: ChecklistKind;
  mode: ChecklistMode;
  role: ChecklistRole;
  ownerUserId?: string;
  ownerName?: string;
  shareCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistCategory {
  id: string;
  listId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistRecipe {
  id: string;
  listId: string;
  name: string;
  sourceKind: ChecklistRecipeSourceKind;
  sourceUrl?: string;
  sourceImageUri?: string;
  sourceImagePath?: string;
  originalServings?: number;
  targetServings?: number;
  position?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistIngredientInput {
  name: string;
  canonicalKey?: string;
  quantityValue?: number;
  quantityText?: string;
  unit?: string;
  preparation?: string;
  originalText?: string;
  confidence?: number;
}

export interface ChecklistRecipeInput {
  name: string;
  sourceKind: ChecklistRecipeSourceKind;
  sourceUrl?: string;
  sourceImageUri?: string;
  originalServings?: number;
  targetServings?: number;
  ingredients: ChecklistIngredientInput[];
}

export interface ChecklistTask {
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

export interface ChecklistMember {
  listId: string;
  userId: string;
  displayName: string;
  role: ChecklistRole;
  joinedAt: string;
}

export interface ChecklistInvite {
  id: string;
  listId: string;
  listName: string;
  inviterName: string;
  code: string;
  createdAt: string;
}

export const CHECKLIST_MUTATION_OPERATIONS = [
  'rename_list',
  'set_list_kind',
  'add_category',
  'delete_category',
  'set_task_category',
  'add_task',
  'add_recipe',
  'update_recipe',
  'delete_recipe',
  'update_ingredient',
  'reorder_tasks',
  'reorder_recipes',
  'update_task',
  'delete_task',
  'set_completion',
  'set_tasks_completion',
  'set_assignee',
  'clear_completed',
] as const;

export type ChecklistMutationOperation =
  (typeof CHECKLIST_MUTATION_OPERATIONS)[number];

export interface PendingChecklistMutation {
  id: string;
  listId: string;
  operation: ChecklistMutationOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

export interface ChecklistPersistedState {
  groceryMigrationVersion: 1;
  lists: Checklist[];
  categories: ChecklistCategory[];
  tasks: ChecklistTask[];
  recipes: ChecklistRecipe[];
  members: ChecklistMember[];
  invites: ChecklistInvite[];
  pendingMutations: PendingChecklistMutation[];
  /** Local-only; opening a list does not sync as an edit. */
  listOpenedAt: Record<string, string>;
  /**
   * Catalog order (all list ids) from the last cloud payload. Restored lists
   * — including shared ones that reload after a wipe — reclaim their old
   * position instead of appending at the end.
   */
  listOrderHint?: string[];
}

export interface ChecklistSharedSnapshot {
  list: Checklist;
  categories?: ChecklistCategory[];
  tasks: ChecklistTask[];
  recipes?: ChecklistRecipe[];
  members: ChecklistMember[];
}
