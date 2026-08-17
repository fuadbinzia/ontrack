import { getSupabaseClient } from '@/services/cloud/supabase';
import {
  normalizeChecklistState,
  type ChecklistSharedSnapshot,
} from '@/store/todos';

export class ChecklistCollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChecklistCollaborationError';
  }
}

export function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

export async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new ChecklistCollaborationError(
      'Shared lists are not configured for this build.',
    );
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new ChecklistCollaborationError('Sign in to share or join a list.');
  }
  return client;
}

export function sharedSnapshot(value: unknown): ChecklistSharedSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as {
    list?: unknown;
    tasks?: unknown;
    members?: unknown;
    recipes?: unknown;
    categories?: unknown;
  };
  const includesCategories = Array.isArray(candidate.categories);
  const includesRecipes = Array.isArray(candidate.recipes);
  const normalized = normalizeChecklistState({
    groceryMigrationVersion: 1,
    lists: candidate.list ? [candidate.list] : [],
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    recipes: Array.isArray(candidate.recipes) ? candidate.recipes : [],
    categories: Array.isArray(candidate.categories) ? candidate.categories : [],
    members: Array.isArray(candidate.members) ? candidate.members : [],
  });
  const list = normalized.lists.find((item) => item.mode === 'shared');
  if (!list) return undefined;
  return {
    list,
    categories: includesCategories
      ? normalized.categories.filter((category) => category.listId === list.id)
      : undefined,
    tasks: normalized.tasks.filter((task) => task.listId === list.id),
    // Absent = unchanged; only an explicit array replaces recipe groups.
    recipes: includesRecipes
      ? normalized.recipes.filter((recipe) => recipe.listId === list.id)
      : undefined,
    members: normalized.members.filter((member) => member.listId === list.id),
  };
}
