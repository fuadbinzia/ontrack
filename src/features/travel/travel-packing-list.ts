import type { TodoList, TodoListKind } from '@/store/todos';

import type { TravelPlan } from './types';

type PackingListDependencies = {
  lists: readonly TodoList[];
  createList: (name: string, kind?: TodoListKind) => TodoList | undefined;
  savePlan: (plan: TravelPlan) => boolean;
  now?: () => string;
};

export function packingListNameForTrip(title: string): string {
  const tripTitle = title.trim().replace(/\s+/g, ' ');
  return tripTitle ? `${tripTitle} Checklist` : 'Checklist';
}

function normalizedListName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function legacyPackingListNameForTrip(title: string): string {
  const tripTitle = title.trim().replace(/\s+/g, ' ');
  return tripTitle ? `${tripTitle} Packing List` : 'Packing List';
}

/** Returns and links the trip's existing checklist, or creates one exactly once. */
export function getOrCreateTravelPackingList(
  plan: TravelPlan,
  {
    lists,
    createList,
    savePlan,
    now = () => new Date().toISOString(),
  }: PackingListDependencies,
): TodoList | undefined {
  const expectedName = packingListNameForTrip(plan.title);
  const existingByName = lists.find(
    (list) =>
      list.kind === 'checklist' &&
      normalizedListName(list.name) === normalizedListName(expectedName),
  );
  const existing = plan.packingListId
    ? lists.find(
        (list) => list.id === plan.packingListId && list.kind === 'checklist',
      )
    : undefined;
  if (existing) {
    const isLegacyGeneratedList =
      normalizedListName(existing.name) ===
      normalizedListName(legacyPackingListNameForTrip(plan.title));
    if (!existingByName || !isLegacyGeneratedList) return existing;
    if (existingByName.id === existing.id) return existing;
  }

  if (existingByName) {
    const linked = savePlan({
      ...plan,
      packingListId: existingByName.id,
      updatedAt: now(),
    });
    return linked ? existingByName : undefined;
  }

  const created = createList(expectedName, 'checklist');
  if (!created) return undefined;

  const linked = savePlan({
    ...plan,
    packingListId: created.id,
    updatedAt: now(),
  });
  return linked ? created : undefined;
}
