import type { TodoList, TodoListKind } from '@/store/todos';
import { cleanName } from '@/store/todos-normalize';

import { tripHeroPlaceName } from './trip-hero-place';
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
  return name.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase();
}

function legacyPackingListNameForTrip(title: string): string {
  const tripTitle = title.trim().replace(/\s+/g, ' ');
  return tripTitle ? `${tripTitle} Packing List` : 'Packing List';
}

function tripPackingListLabels(plan: TravelPlan): string[] {
  const labels = [plan.title, plan.destination, tripHeroPlaceName(plan.destination, plan.title)];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const key = normalizedListName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

/** Names this trip's checklist may already have, including legacy packing-list titles. */
export function packingListNameCandidatesForTrip(plan: TravelPlan): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const push = (name: string) => {
    const stored = cleanName(name);
    if (!stored) return;
    const key = normalizedListName(stored);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(stored);
  };
  for (const label of tripPackingListLabels(plan)) {
    push(packingListNameForTrip(label));
    push(legacyPackingListNameForTrip(label));
  }
  return names;
}

function findChecklistByTripName(
  lists: readonly TodoList[],
  plan: TravelPlan,
): TodoList | undefined {
  for (const name of packingListNameCandidatesForTrip(plan)) {
    const key = normalizedListName(name);
    const match = lists.find(
      (list) =>
        list.kind === 'checklist' && normalizedListName(list.name) === key,
    );
    if (match) return match;
  }
  return undefined;
}

function isLegacyGeneratedPackingList(list: TodoList, plan: TravelPlan): boolean {
  const legacyNames = new Set(
    tripPackingListLabels(plan).map((label) =>
      normalizedListName(legacyPackingListNameForTrip(label)),
    ),
  );
  return legacyNames.has(normalizedListName(list.name));
}

/** Keep a local trip→checklist link when a cloud/sync payload omits it. */
export function preserveTravelPackingListIds(
  incoming: readonly TravelPlan[],
  previous: readonly TravelPlan[],
): TravelPlan[] {
  const previousById = new Map(previous.map((plan) => [plan.id, plan]));
  return incoming.map((plan) => {
    if (plan.packingListId) return plan;
    const prior = previousById.get(plan.id)?.packingListId;
    return prior ? { ...plan, packingListId: prior } : plan;
  });
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
  const existingByName = findChecklistByTripName(lists, plan);
  const existing = plan.packingListId
    ? lists.find(
        (list) => list.id === plan.packingListId && list.kind === 'checklist',
      )
    : undefined;
  if (existing) {
    const shouldMigrateLegacy =
      isLegacyGeneratedPackingList(existing, plan) &&
      existingByName &&
      existingByName.id !== existing.id;
    if (!shouldMigrateLegacy) return existing;
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
