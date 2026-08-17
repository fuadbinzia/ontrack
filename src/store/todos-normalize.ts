import { newUuid } from '@/utils/id';
import {
    asFiniteNonNegative,
    asFiniteNumber,
    asNonEmptyString,
    asPositiveNumber,
} from '@/utils/parse';
import {
    CHECKLIST_MUTATION_OPERATIONS,
    type Checklist,
    type ChecklistCategory,
    type ChecklistIngredientInput,
    type ChecklistInvite,
    type ChecklistMember,
    type ChecklistPersistedState,
    type ChecklistRecipe,
    type ChecklistTask,
    type PendingChecklistMutation,
} from './todos-types';

export const DEFAULT_CHECKLIST_NAME = 'To Do';
export const DEFAULT_GROCERY_LIST_NAME = 'Groceries';

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
    ChecklistIngredientInput,
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
): Checklist | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Checklist>;
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

export function normalizeRecipe(value: unknown): ChecklistRecipe | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ChecklistRecipe>;
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

export function normalizeCategory(value: unknown): ChecklistCategory | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ChecklistCategory>;
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

export function normalizeTask(value: unknown, fallbackListId?: string): ChecklistTask | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ChecklistTask>;
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

export function normalizeMember(value: unknown): ChecklistMember | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ChecklistMember>;
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

export function normalizeInvite(value: unknown): ChecklistInvite | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ChecklistInvite>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  const listName = asNonEmptyString(candidate.listName);
  const inviterName = asNonEmptyString(candidate.inviterName);
  const code = asNonEmptyString(candidate.code);
  if (!id || !listId || !listName || !inviterName || !code) {
    return undefined;
  }
  return {
    id,
    listId,
    listName,
    inviterName,
    code,
    createdAt: asNonEmptyString(candidate.createdAt) ?? nowIso(),
  };
}

export function normalizeMutation(value: unknown): PendingChecklistMutation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<PendingChecklistMutation>;
  const id = asNonEmptyString(candidate.id);
  const listId = asNonEmptyString(candidate.listId);
  if (
    !id ||
    !listId ||
    !candidate.operation ||
    !CHECKLIST_MUTATION_OPERATIONS.includes(candidate.operation) ||
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

export function omitListOpenedAt(
  openedAt: Record<string, string>,
  listId: string,
): Record<string, string> {
  if (!(listId in openedAt)) return openedAt;
  const { [listId]: _removed, ...rest } = openedAt;
  return rest;
}

export function sameChecklist(a: Checklist, b: Checklist): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.kind === b.kind &&
    a.mode === b.mode &&
    a.role === b.role &&
    a.ownerUserId === b.ownerUserId &&
    a.ownerName === b.ownerName &&
    a.shareCode === b.shareCode &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  );
}

function normalizeListOrderHint(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      ),
    ),
  ];
  return ids.length > 0 ? ids : undefined;
}

/**
 * Place a newly arrived list at its remembered catalog position. Lists not in
 * the hint (created since the last cloud push) rank ahead, mirroring
 * createList's prepend; without a hint (or for unknown ids) this appends,
 * matching the old behavior.
 */
export function insertListByOrderHint(
  lists: Checklist[],
  next: Checklist,
  hint?: readonly string[],
): Checklist[] {
  const rank = hint ? hint.indexOf(next.id) : -1;
  if (rank < 0) return [...lists, next];
  let index = lists.length;
  for (let i = 0; i < lists.length; i += 1) {
    if ((hint as readonly string[]).indexOf(lists[i].id) > rank) {
      index = i;
      break;
    }
  }
  return [...lists.slice(0, index), next, ...lists.slice(index)];
}

function normalizeListOpenedAt(
  value: unknown,
  validListIds: Set<string>,
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!validListIds.has(id)) continue;
    const at = asNonEmptyString(raw);
    if (!at) continue;
    next[id] = at;
  }
  return next;
}

export function normalizeChecklistState(value: unknown): ChecklistPersistedState {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<ChecklistPersistedState>)
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
      (item) => item && typeof item === 'object' && !asNonEmptyString((item as Partial<ChecklistTask>).listId),
    );
  let fallbackListId: string | undefined;
  if (legacyTasks) {
    const timestamps = rawTasks.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const createdAt = asNonEmptyString((item as Partial<ChecklistTask>).createdAt);
      return createdAt ? [createdAt] : [];
    });
    const createdAt = timestamps.sort()[0] ?? nowIso();
    fallbackListId = newUuid();
    lists = [
      {
        id: fallbackListId,
        name: DEFAULT_CHECKLIST_NAME,
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
  const categoryListIds = new Map(
    categories.map((category) => [category.id, category.listId]),
  );
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
          categoryId:
            task.categoryId &&
            categoryListIds.get(task.categoryId) === task.listId
            ? task.categoryId
            : undefined,
          id: legacyTasks ? newUuid() : task.id,
        }];
      })
    : [];

  if (lists.length === 0 && tasks.length === 0) {
    const createdAt = nowIso();
    const list: Checklist = {
      id: newUuid(),
      name: DEFAULT_CHECKLIST_NAME,
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
  const listOrderHint = normalizeListOrderHint(source.listOrderHint);
  // Hinted ids cover shared lists that have not reloaded yet — keep their
  // open recency so a restore does not forget them.
  const listOpenedAt = normalizeListOpenedAt(
    source.listOpenedAt,
    listOrderHint ? new Set([...validListIds, ...listOrderHint]) : validListIds,
  );

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
    listOpenedAt,
    listOrderHint,
  };
}

export function normalizeChecklistTasks(value: unknown): ChecklistTask[] {
  return normalizeChecklistState({ tasks: value }).tasks;
}
