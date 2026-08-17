import type { Checklist, ChecklistKind } from '@/store/todos';
import { cleanName } from '@/store/todos-normalize';

import { tripHeroPlaceName } from './trip-hero-place';
import type { TravelPlan } from './types';

export type TravelPackingListDependencies = {
  lists: readonly Checklist[];
  /** Fresh read right before create, so a stale snapshot cannot duplicate. */
  getLists?: () => readonly Checklist[];
  createList: (name: string, kind?: ChecklistKind) => Checklist | undefined;
  savePlan: (plan: TravelPlan) => boolean;
  /** Put a remembered list back when sync/rehydrate dropped it. */
  ensureList?: (list: Checklist) => void;
  /** Rename a leftover Packing List in place after the Checklist label change. */
  renameList?: (id: string, name: string) => void;
  /** List ids that already have tasks — prefer these over empty duplicates. */
  listsWithItems?: ReadonlySet<string>;
  now?: () => string;
};

const linkedPackingListByPlanId = new Map<string, Checklist>();

/** Test helper — drop session memory between cases. */
export function resetTravelPackingListMemory() {
  linkedPackingListByPlanId.clear();
}

function collapseWhitespace(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function labeledListName(
  title: string,
  suffix: 'Checklist' | 'Packing List',
): string {
  const tripTitle = collapseWhitespace(title);
  return tripTitle ? `${tripTitle} ${suffix}` : suffix;
}

export function packingListNameForTrip(title: string): string {
  return labeledListName(title, 'Checklist');
}

function normalizedListName(name: string): string {
  return collapseWhitespace(name).normalize('NFC').toLocaleLowerCase();
}

function legacyPackingListNameForTrip(title: string): string {
  return labeledListName(title, 'Packing List');
}

function isChecklistList(list: Checklist): boolean {
  return list.kind !== 'grocery';
}

function tripPackingListLabels(plan: TravelPlan): string[] {
  const labels = [plan.title, plan.destination, tripHeroPlaceName(plan.destination, plan.title)];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const label of labels) {
    const trimmed = collapseWhitespace(label);
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

function findChecklistById(
  lists: readonly Checklist[],
  listId: string | undefined,
): Checklist | undefined {
  if (!listId) return undefined;
  return lists.find((list) => list.id === listId && isChecklistList(list));
}

function tripChecklistNameKeys(plan: TravelPlan): Set<string> {
  return new Set(
    packingListNameCandidatesForTrip(plan).map((name) => normalizedListName(name)),
  );
}

function findAllTripChecklists(
  lists: readonly Checklist[],
  plan: TravelPlan,
): Checklist[] {
  const wanted = tripChecklistNameKeys(plan);
  return lists.filter(
    (list) => isChecklistList(list) && wanted.has(normalizedListName(list.name)),
  );
}

function isLegacyGeneratedPackingList(list: Checklist, plan: TravelPlan): boolean {
  const legacyNames = new Set(
    tripPackingListLabels(plan).map((label) =>
      normalizedListName(legacyPackingListNameForTrip(label)),
    ),
  );
  return legacyNames.has(normalizedListName(list.name));
}

function pickOldestList(lists: readonly Checklist[]): Checklist {
  return [...lists].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  )[0]!;
}

/** Prefer the original Packing List over a later empty Checklist duplicate. */
function pickBestTripChecklist(
  plan: TravelPlan,
  lists: readonly Checklist[],
  listsWithItems?: ReadonlySet<string>,
): Checklist | undefined {
  const matches = findAllTripChecklists(lists, plan);
  const linked = findChecklistById(lists, plan.packingListId);
  const linkedIsGenerated = Boolean(
    linked && matches.some((list) => list.id === linked.id),
  );
  if (linked && !linkedIsGenerated) return linked;

  const withItems = matches.filter((list) => listsWithItems?.has(list.id));
  if (withItems.length > 0) return pickOldestList(withItems);

  const legacy = matches.filter((list) => isLegacyGeneratedPackingList(list, plan));
  if (legacy.length > 0) return pickOldestList(legacy);
  if (matches.length > 0) return pickOldestList(matches);
  return linked;
}

function adoptLegacyPackingListName(
  plan: TravelPlan,
  list: Checklist,
  lists: readonly Checklist[],
  renameList?: (id: string, name: string) => void,
): Checklist {
  if (!renameList || !isLegacyGeneratedPackingList(list, plan)) return list;
  const nextName = packingListNameForTrip(plan.title);
  const stored = cleanName(nextName);
  if (!stored || normalizedListName(list.name) === normalizedListName(stored)) {
    return list;
  }
  const collision = lists.some(
    (item) =>
      item.id !== list.id &&
      isChecklistList(item) &&
      normalizedListName(item.name) === normalizedListName(stored),
  );
  if (collision) return list;
  renameList(list.id, stored);
  return { ...list, name: stored };
}

function remember(planId: string, list: Checklist): Checklist {
  linkedPackingListByPlanId.set(planId, list);
  return list;
}

function resolveExisting(
  plan: TravelPlan,
  lists: readonly Checklist[],
  listsWithItems?: ReadonlySet<string>,
): Checklist | undefined {
  const best = pickBestTripChecklist(plan, lists, listsWithItems);
  const remembered = linkedPackingListByPlanId.get(plan.id);
  if (
    remembered &&
    isLegacyGeneratedPackingList(remembered, plan) &&
    (!best || !isLegacyGeneratedPackingList(best, plan))
  ) {
    return findChecklistById(lists, remembered.id) ?? remembered;
  }
  if (best) return best;
  if (remembered) return findChecklistById(lists, remembered.id) ?? remembered;
  return undefined;
}

function linkToPlan(
  plan: TravelPlan,
  list: Checklist,
  savePlan: (plan: TravelPlan) => boolean,
  now: () => string,
  ensureList?: (list: Checklist) => void,
): Checklist {
  remember(plan.id, list);
  ensureList?.(list);
  if (plan.packingListId !== list.id) {
    savePlan({
      ...plan,
      packingListId: list.id,
      updatedAt: now(),
    });
  }
  return list;
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
    getLists,
    createList,
    savePlan,
    ensureList,
    renameList,
    listsWithItems,
    now = () => new Date().toISOString(),
  }: TravelPackingListDependencies,
): Checklist | undefined {
  const adopt = (found: Checklist, from: readonly Checklist[]) =>
    linkToPlan(
      plan,
      adoptLegacyPackingListName(plan, found, from, renameList),
      savePlan,
      now,
      ensureList,
    );

  const existing = resolveExisting(plan, lists, listsWithItems);
  if (existing) return adopt(existing, lists);

  const latestLists = getLists?.() ?? lists;
  const existingFresh = resolveExisting(plan, latestLists, listsWithItems);
  if (existingFresh) return adopt(existingFresh, latestLists);

  const created = createList(packingListNameForTrip(plan.title), 'checklist');
  if (!created) return undefined;
  return linkToPlan(plan, created, savePlan, now, ensureList);
}
