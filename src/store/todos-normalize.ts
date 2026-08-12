import {
  type PendingTodoMutation,
  type TodoCategory,
  type TodoIngredientInput,
  type TodoInvite,
  type TodoList,
  type TodoMember,
  type TodoMutationOperation,
  type TodoPersistedState,
  type TodoRecipe,
  type TodoTask,
} from './todos-types';
import { newUuid } from '@/utils/id';
import {
  asFiniteNonNegative,
  asFiniteNumber,
  asNonEmptyString,
  asPositiveNumber,
} from '@/utils/parse';

export function nowIso() {
  return new Date().toISOString();
}

export function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function cleanTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 160);
}

export function cleanOptional(value: unknown, limit = 160) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, limit) || undefined
    : undefined;
}

/** Recipe source links must be https so synced lists cannot plant custom schemes. */
export function cleanHttpsUrl(value: unknown, limit = 2_000) {
  const cleaned = cleanOptional(value, limit);
  if (!cleaned) return undefined;
  try {
    return new URL(cleaned).protocol === 'https:' ? cleaned : undefined;
  } catch {
    return undefined;
  }
}

/** Prefer `assigneeUserIds`; migrate legacy single `assigneeUserId`. Empty = Anyone. */
export function normalizeAssigneeUserIds(candidate: {
  assigneeUserIds?: unknown;
  assigneeUserId?: unknown;
}): string[] | undefined {
  const fromArray = Array.isArray(candidate.assigneeUserIds)
    ? candidate.assigneeUserIds
        .map((value) => asNonEmptyString(value))
        .filter((value): value is string => Boolean(value))
    : [];
  if (fromArray.length > 0) return Array.from(new Set(fromArray));
  const legacy = asNonEmptyString(candidate.assigneeUserId);
  return legacy ? [legacy] : undefined;
}

export function isGroceryListName(name: string) {
  return /\b(grocer(?:y|ies)|supermarket)\b/i.test(name.trim());
}

export function canonicalIngredientKey(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function formatIngredientTitle(
  ingredient: Pick<
    TodoIngredientInput,
    'name' | 'quantityText' | 'unit' | 'preparation'
  >,
) {
  const amount = [cleanOptional(ingredient.quantityText, 40), cleanOptional(ingredient.unit, 40)]
    .filter(Boolean)
    .join(' ');
  const name = cleanOptional(ingredient.name, 100) ?? '';
  const preparation = cleanOptional(ingredient.preparation, 80);
  return cleanTitle(
    [amount, name, preparation ? `(${preparation})` : undefined]
      .filter(Boolean)
      .join(' '),
  );
}

export function normalizeList(
  value: unknown,
  upgradeRecognizedGroceryName = false,
): TodoList | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoList>;
  const id = asNonEmptyString(candidate.id);
  const name = typeof candidate.name === 'string' ? cleanName(candidate.name) : '';
  if (!id || !name) return undefined;
  const createdAt = asNonEmptyString(candidate.createdAt) ?? nowIso();
  return {
    id,
    name,
    kind:
      candidate.kind === 'grocery' ||
      (upgradeRecognizedGroceryName && isGroceryListName(name)) ||
      (candidate.kind !== 'checklist' && isGroceryListName(name))
        ? 'grocery'
        : 'checklist',
    mode: candidate.mode === 'shared' ? 'shared' : 'private',
    role:
      candidate.role === 'member'
        ? 'member'
        : candidate.role === 'editor'
          ? 'editor'
          : 'owner',
    ownerUserId: asNonEmptyString(candidate.ownerUserId),
    ownerName: asNonEmptyString(candidate.ownerName),
    shareCode: asNonEmptyString(candidate.shareCode),
    createdAt,
    updatedAt: asNonEmptyString(candidate.updatedAt) ?? createdAt,
  };
}

export function normalizeRecipe(value: unknown): TodoRecipe | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoRecipe>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  const name = typeof candidate.name === 'string' ? cleanName(candidate.name) : '';
  if (!id || !listId || !name) return undefined;
  const createdAt = asNonEmptyString(candidate.createdAt) ?? nowIso();
  return {
    id,
    listId,
    name,
    sourceKind: candidate.sourceKind === 'image' ? 'image' : 'url',
    sourceUrl: cleanHttpsUrl(candidate.sourceUrl, 2_000),
    sourceImageUri: cleanOptional(candidate.sourceImageUri, 6_000_000),
    sourceImagePath: cleanOptional(candidate.sourceImagePath, 500),
    originalServings: asPositiveNumber(candidate.originalServings),
    targetServings: asPositiveNumber(candidate.targetServings),
    position: asFiniteNumber(candidate.position),
    createdAt,
    updatedAt: asNonEmptyString(candidate.updatedAt) ?? createdAt,
  };
}

export function normalizeCategory(value: unknown): TodoCategory | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoCategory>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  const name = typeof candidate.name === 'string'
    ? cleanName(candidate.name).slice(0, 40)
    : '';
  if (!id || !listId || !name) return undefined;
  const createdAt = asNonEmptyString(candidate.createdAt) ?? nowIso();
  return {
    id,
    listId,
    name,
    position: asFiniteNonNegative(candidate.position) ?? 0,
    createdAt,
    updatedAt: asNonEmptyString(candidate.updatedAt) ?? createdAt,
  };
}

export function normalizeTask(value: unknown, fallbackListId?: string): TodoTask | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoTask>;
  const title = typeof candidate.title === 'string' ? cleanTitle(candidate.title) : '';
  const listId = asNonEmptyString(candidate.listId) ?? fallbackListId;
  if (!title || !listId) return undefined;
  const createdAt = asNonEmptyString(candidate.createdAt) ?? nowIso();
  const completed = candidate.completed === true;
  const recipeId = asNonEmptyString(candidate.recipeId);
  const ingredientName = recipeId
    ? cleanOptional(candidate.ingredientName, 100)
    : undefined;
  return {
    id: asNonEmptyString(candidate.id) ?? newUuid(),
    listId,
    categoryId: asNonEmptyString(candidate.categoryId),
    position:
      typeof candidate.position === 'number' && Number.isFinite(candidate.position)
        ? candidate.position
        : undefined,
    recipeId,
    ingredientPosition: recipeId
      ? asFiniteNonNegative(candidate.ingredientPosition)
      : undefined,
    ingredientName,
    canonicalKey: recipeId
      ? cleanOptional(candidate.canonicalKey, 120) ??
        (ingredientName ? canonicalIngredientKey(ingredientName) : undefined)
      : undefined,
    quantityValue: recipeId
      ? asFiniteNonNegative(candidate.quantityValue)
      : undefined,
    quantityText: recipeId
      ? cleanOptional(candidate.quantityText, 40)
      : undefined,
    unit: recipeId ? cleanOptional(candidate.unit, 40) : undefined,
    preparation: recipeId
      ? cleanOptional(candidate.preparation, 80)
      : undefined,
    originalText: recipeId
      ? cleanOptional(candidate.originalText, 240)
      : undefined,
    confidence:
      recipeId && typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : undefined,
    title,
    completed,
    important: candidate.important === true,
    assigneeUserIds: normalizeAssigneeUserIds(candidate),
    completedByUserId: completed ? asNonEmptyString(candidate.completedByUserId) : undefined,
    createdAt,
    updatedAt: asNonEmptyString(candidate.updatedAt) ?? createdAt,
    completedAt: completed ? asNonEmptyString(candidate.completedAt) : undefined,
    version:
      typeof candidate.version === 'number' && Number.isFinite(candidate.version)
        ? Math.max(0, Math.floor(candidate.version))
        : 0,
  };
}

export function normalizeMember(value: unknown): TodoMember | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoMember>;
  const listId = asNonEmptyString(candidate.listId);
  const userId = asNonEmptyString(candidate.userId);
  const displayName = asNonEmptyString(candidate.displayName);
  if (!listId || !userId || !displayName) return undefined;
  return {
    listId,
    userId,
    displayName,
    role:
      candidate.role === 'owner'
        ? 'owner'
        : candidate.role === 'editor'
          ? 'editor'
          : 'member',
    joinedAt: asNonEmptyString(candidate.joinedAt) ?? nowIso(),
  };
}

export function normalizeInvite(value: unknown): TodoInvite | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<TodoInvite>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  const listName = asNonEmptyString(candidate.listName);
  const inviterName = asNonEmptyString(candidate.inviterName);
  const inviteeEmail = asNonEmptyString(candidate.inviteeEmail);
  const code = asNonEmptyString(candidate.code);
  if (!id || !listId || !listName || !inviterName || !inviteeEmail || !code) {
    return undefined;
  }
  return {
    id,
    listId,
    listName,
    inviterName,
    inviteeEmail: inviteeEmail.toLowerCase(),
    code,
    createdAt: asNonEmptyString(candidate.createdAt) ?? nowIso(),
  };
}

export function normalizeMutation(value: unknown): PendingTodoMutation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<PendingTodoMutation>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  const operations: TodoMutationOperation[] = [
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
  ];
  if (
    !id ||
    !listId ||
    !candidate.operation ||
    !operations.includes(candidate.operation) ||
    !candidate.payload ||
    typeof candidate.payload !== 'object' ||
    Array.isArray(candidate.payload)
  ) {
    return undefined;
  }
  return {
    id,
    listId,
    operation: candidate.operation,
    payload: candidate.payload,
    createdAt: asNonEmptyString(candidate.createdAt) ?? nowIso(),
    attempts:
      typeof candidate.attempts === 'number'
        ? Math.max(0, Math.floor(candidate.attempts))
        : 0,
  };
}

export function normalizeTodoState(value: unknown): TodoPersistedState {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<TodoPersistedState>)
      : {};
  const upgradeRecognizedGroceryNames =
    source.groceryMigrationVersion !== 1;
  let lists = Array.isArray(source.lists)
    ? source.lists.flatMap((item) => {
        const list = normalizeList(item, upgradeRecognizedGroceryNames);
        return list ? [list] : [];
      })
    : [];

  const rawTasks = Array.isArray(source.tasks) ? source.tasks : [];
  const legacyTasks =
    rawTasks.length > 0 &&
    rawTasks.some(
      (item) => item && typeof item === 'object' && !asNonEmptyString((item as Partial<TodoTask>).listId),
    );
  let fallbackListId: string | undefined;
  if (legacyTasks) {
    const timestamps = rawTasks.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const createdAt = asNonEmptyString((item as Partial<TodoTask>).createdAt);
      return createdAt ? [createdAt] : [];
    });
    const createdAt = timestamps.sort()[0] ?? nowIso();
    fallbackListId = newUuid();
    lists = [
      {
        id: fallbackListId,
        name: 'To Do',
        kind: 'checklist',
        mode: 'private',
        role: 'owner',
        createdAt,
        updatedAt: nowIso(),
      },
      ...lists,
    ];
  }

  const listIds = new Set(lists.map((list) => list.id));
  const categories = Array.isArray(source.categories)
    ? source.categories.flatMap((item) => {
        const category = normalizeCategory(item);
        return category && listIds.has(category.listId) ? [category] : [];
      })
    : [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const recipes = Array.isArray(source.recipes)
    ? source.recipes.flatMap((item) => {
        const recipe = normalizeRecipe(item);
        return recipe && listIds.has(recipe.listId) ? [recipe] : [];
      })
    : [];
  const recipeListIds = new Set(recipes.map((recipe) => recipe.listId));
  lists = lists.map((list) =>
    recipeListIds.has(list.id) && list.kind !== 'grocery'
      ? { ...list, kind: 'grocery' }
      : list,
  );
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  let tasks = rawTasks.length > 0
    ? rawTasks.flatMap((item) => {
        const task = normalizeTask(item, fallbackListId);
        if (!task || !listIds.has(task.listId)) return [];
        const normalizedTask =
          task.recipeId && !recipeIds.has(task.recipeId)
            ? {
                ...task,
                recipeId: undefined,
                ingredientPosition: undefined,
                ingredientName: undefined,
                canonicalKey: undefined,
                quantityValue: undefined,
                quantityText: undefined,
                unit: undefined,
                preparation: undefined,
                originalText: undefined,
                confidence: undefined,
              }
            : task;
        return [{
          ...normalizedTask,
          categoryId: task.categoryId && categoryIds.has(task.categoryId)
            ? task.categoryId
            : undefined,
          id: legacyTasks ? newUuid() : task.id,
        }];
      })
    : [];

  if (lists.length === 0 && tasks.length === 0) {
    const createdAt = nowIso();
    const list: TodoList = {
      id: newUuid(),
      name: 'To Do',
      kind: 'checklist',
      mode: 'private',
      role: 'owner',
      createdAt,
      updatedAt: createdAt,
    };
    lists = [list];
  }

  const dedupedLists = new Map(lists.map((list) => [list.id, list]));
  const validListIds = new Set(dedupedLists.keys());
  tasks = tasks.filter((task) => validListIds.has(task.listId));

  return {
    groceryMigrationVersion: 1,
    lists: [...dedupedLists.values()],
    categories: [
      ...new Map(
        categories
          .filter((category) => validListIds.has(category.listId))
          .map((category) => [category.id, category]),
      ).values(),
    ],
    tasks: [...new Map(tasks.map((task) => [task.id, task])).values()],
    recipes: [
      ...new Map(
        recipes
          .filter((recipe) => validListIds.has(recipe.listId))
          .map((recipe) => [recipe.id, recipe]),
      ).values(),
    ],
    members: Array.isArray(source.members)
      ? source.members.flatMap((item) => {
          const member = normalizeMember(item);
          return member && validListIds.has(member.listId) ? [member] : [];
        })
      : [],
    invites: Array.isArray(source.invites)
      ? source.invites.flatMap((item) => {
          const invite = normalizeInvite(item);
          return invite ? [invite] : [];
        })
      : [],
    pendingMutations: Array.isArray(source.pendingMutations)
      ? source.pendingMutations.flatMap((item) => {
          const mutation = normalizeMutation(item);
          return mutation && validListIds.has(mutation.listId) ? [mutation] : [];
        })
      : [],
  };
}

export function normalizeTodoTasks(value: unknown): TodoTask[] {
  return normalizeTodoState({ tasks: value }).tasks;
}
