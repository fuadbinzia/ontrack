import type { TodoList, TodoListKind } from '@/store/todos';

import type { TravelPlan } from './types';

type PackingListDependencies = {
  lists: readonly TodoList[];
  createList: (name: string, kind?: TodoListKind) => TodoList | undefined;
  savePlan: (plan: TravelPlan) => boolean;
  now?: () => string;
};

export function packingListNameForTrip(title: string): string {
  const tripTitle = title.trim();
  return tripTitle ? `${tripTitle} Packing List` : 'Packing List';
}

/** Returns the existing linked list, or creates and links one exactly once. */
export function getOrCreateTravelPackingList(
  plan: TravelPlan,
  {
    lists,
    createList,
    savePlan,
    now = () => new Date().toISOString(),
  }: PackingListDependencies,
): TodoList | undefined {
  const existing = plan.packingListId
    ? lists.find((list) => list.id === plan.packingListId)
    : undefined;
  if (existing) return existing;

  const created = createList(packingListNameForTrip(plan.title), 'checklist');
  if (!created) return undefined;

  const linked = savePlan({
    ...plan,
    packingListId: created.id,
    updatedAt: now(),
  });
  return linked ? created : undefined;
}
