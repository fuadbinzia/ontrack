import type { SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
    PendingChecklistMutation,
    ChecklistRecipe,
    ChecklistSharedSnapshot,
} from '@/store/todos';

const BUCKET = 'todo-recipe-images';
const MARKER = 'ontrack-todo-recipe-media:';

function extensionAndType(uri: string) {
  const match = /\.(png|webp|jpe?g)(?:$|[?#])/i.exec(uri);
  const extension = match?.[1]?.toLocaleLowerCase();
  if (extension === 'png') return { extension: 'png', contentType: 'image/png' };
  if (extension === 'webp') {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return { extension: 'jpg', contentType: 'image/jpeg' };
}

async function imageBytes(uri: string) {
  if (Platform.OS !== 'web' && uri.startsWith('file://')) {
    return new File(uri).arrayBuffer();
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The recipe thumbnail could not be read.');
  return response.arrayBuffer();
}

export function recipeMediaPath(value?: string) {
  return value?.startsWith(MARKER) ? value.slice(MARKER.length) : undefined;
}

export async function uploadSharedRecipeImage(
  client: SupabaseClient,
  recipe: ChecklistRecipe,
) {
  const uri = recipe.sourceImageUri;
  if (recipe.sourceImagePath) return recipe.sourceImagePath;
  if (!uri) return undefined;
  const existing = recipeMediaPath(uri);
  if (existing) return existing;
  const { extension, contentType } = extensionAndType(uri);
  const path = `${recipe.listId}/${recipe.id}.${extension}`;
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, await imageBytes(uri), {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });
  if (error) throw error;
  return path;
}

function recipeImageCandidates(
  listId: string,
  recipe: { id?: unknown; sourceImagePath?: unknown },
): string[] {
  if (typeof recipe.sourceImagePath === 'string') {
    return [recipe.sourceImagePath];
  }
  if (typeof recipe.id !== 'string') return [];
  return ['jpg', 'png', 'webp'].map(
    (extension) => `${listId}/${recipe.id}.${extension}`,
  );
}

/** Upload-only prep. Deletes happen in cleanupRecipeMutationMedia after ack. */
export async function prepareRecipeMutationMedia(
  client: SupabaseClient,
  mutation: PendingChecklistMutation,
) {
  if (
    mutation.operation !== 'add_recipe' &&
    mutation.operation !== 'update_recipe'
  ) {
    return mutation;
  }
  const recipe =
    mutation.payload.recipe &&
    typeof mutation.payload.recipe === 'object' &&
    !Array.isArray(mutation.payload.recipe)
      ? (mutation.payload.recipe as ChecklistRecipe)
      : undefined;
  if (!recipe?.sourceImageUri) return mutation;
  return {
    ...mutation,
    payload: {
      ...mutation.payload,
      recipe: {
        ...recipe,
        sourceImagePath: await uploadSharedRecipeImage(client, recipe),
      },
    },
  };
}

/** Returns remaining recipe ids, or null when the snapshot is unavailable. */
async function remainingRecipeIds(
  client: SupabaseClient,
  listId: string,
): Promise<Set<string> | null> {
  const { data, error } = await client.rpc('todo_list_snapshot', {
    requested_list_id: listId,
  });
  if (error || data == null) return null;
  const remainingIds = new Set<string>();
  const recipes =
    typeof data === 'object' &&
    Array.isArray((data as { recipes?: unknown }).recipes)
      ? (data as { recipes: unknown[] }).recipes
      : [];
  for (const row of recipes) {
    if (
      row &&
      typeof row === 'object' &&
      typeof (row as { id?: unknown }).id === 'string'
    ) {
      remainingIds.add((row as { id: string }).id);
    }
  }
  return remainingIds;
}

/** Remove storage objects only after the matching mutation is acknowledged. */
export async function cleanupRecipeMutationMedia(
  client: SupabaseClient,
  mutation: PendingChecklistMutation,
): Promise<void> {
  if (mutation.operation === 'clear_completed') {
    const deletedRecipes = Array.isArray(mutation.payload.deletedRecipes)
      ? mutation.payload.deletedRecipes
      : [];
    if (!deletedRecipes.length) return;
    // Confirm the recipe is actually gone — a concurrent edit may have kept it.
    // Fail closed when the snapshot cannot be loaded (never delete on uncertainty).
    const remainingIds = await remainingRecipeIds(client, mutation.listId);
    if (!remainingIds) return;
    const candidates = deletedRecipes.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const recipe = value as { id?: unknown; sourceImagePath?: unknown };
      if (typeof recipe.id === 'string' && remainingIds.has(recipe.id)) {
        return [];
      }
      return recipeImageCandidates(mutation.listId, recipe);
    });
    if (candidates.length) {
      await client.storage
        .from(BUCKET)
        .remove(candidates)
        .catch(() => undefined);
    }
    return;
  }
  if (
    mutation.operation === 'delete_recipe' ||
    mutation.operation === 'delete_task'
  ) {
    const recipeId =
      typeof mutation.payload.recipeId === 'string'
        ? mutation.payload.recipeId
        : typeof mutation.payload.deleteRecipeId === 'string'
          ? mutation.payload.deleteRecipeId
          : undefined;
    if (mutation.operation === 'delete_task' && !recipeId) return;
    // Confirm the recipe is gone — fail closed if the snapshot is unavailable.
    if (recipeId) {
      const remainingIds = await remainingRecipeIds(client, mutation.listId);
      if (!remainingIds || remainingIds.has(recipeId)) return;
    }
    const path =
      typeof mutation.payload.sourceImagePath === 'string'
        ? mutation.payload.sourceImagePath
        : undefined;
    const candidates = path
      ? [path]
      : recipeId
        ? recipeImageCandidates(mutation.listId, { id: recipeId })
        : [];
    if (candidates.length) {
      await client.storage
        .from(BUCKET)
        .remove(candidates)
        .catch(() => undefined);
    }
  }
}

export async function resolveSharedRecipeMedia(
  client: SupabaseClient,
  snapshot: ChecklistSharedSnapshot,
): Promise<ChecklistSharedSnapshot> {
  // Absent recipes means "unchanged" — do not materialize an empty array that
  // the merge would treat as a full replace.
  if (!snapshot.recipes) return snapshot;
  const recipes = await Promise.all(
    snapshot.recipes.map(async (recipe) => {
      const path = recipeMediaPath(recipe.sourceImageUri);
      const storedPath = recipe.sourceImagePath ?? path;
      if (!storedPath) return recipe;
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(storedPath, 60 * 60);
      if (error || !data?.signedUrl) {
        return { ...recipe, sourceImageUri: undefined, sourceImagePath: storedPath };
      }
      return {
        ...recipe,
        sourceImageUri: data.signedUrl,
        sourceImagePath: storedPath,
      };
    }),
  );
  return { ...snapshot, recipes };
}

export async function removeSharedRecipeImages(
  client: SupabaseClient,
  recipes: ChecklistRecipe[],
) {
  const candidates = recipes.flatMap((recipe) => {
    const path = recipe.sourceImagePath ?? recipeMediaPath(recipe.sourceImageUri);
    if (path) return [path];
    return ['jpg', 'png', 'webp'].map(
      (extension) => `${recipe.listId}/${recipe.id}.${extension}`,
    );
  });
  if (!candidates.length) return;
  const { error } = await client.storage.from(BUCKET).remove(candidates);
  if (error) throw error;
}
