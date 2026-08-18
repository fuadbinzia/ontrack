import type { AddonEnabledState } from '@/addons/types';
import { isTrackerRouteEnabled } from '@/components/navigation/bottom-nav-tab-meta';
import { findCategory } from '@/constants/categories';
import { activityDetailPath } from '@/features/daily-tracking/activity-detail-route';
import { searchFinanceTransactions } from '@/features/finance/finance-transaction-search';
import { searchRecipes } from '@/features/food/recipe-filters';
import { journalPageHref } from '@/features/journal/model';
import { checklistDetailHref } from '@/features/todos/todo-list-href';
import { filterTravelPlansByQuery } from '@/features/travel/travel-home-plan-search';
import { vehicleDisplayTitle } from '@/features/vehicles/types';
import { useFinance } from '@/store/finance';
import { useRecipes } from '@/store/food-recipes';
import { useFriends } from '@/store/friends';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';
import { formatMinutes } from '@/utils/date';
import { haystackMatchesQuery } from '@/utils/search-text';

import { catalogSearchScreens } from './search-screens';
import {
  SEARCH_GROUP_LABEL,
  SEARCH_GROUP_LIMIT,
  type SearchDocument,
  type SearchDomain,
  type SearchGroup,
} from './search-types';

export interface AppSearchSnapshot {
  enabledAddons: AddonEnabledState;
  query: string;
}

function cap(items: SearchDocument[]): SearchDocument[] {
  return items.slice(0, SEARCH_GROUP_LIMIT);
}

function buildTodoDocuments(query: string): SearchDocument[] {
  const { lists, tasks } = useChecklists.getState();
  const listDocs = lists.flatMap((list) => {
    if (!haystackMatchesQuery([list.name], query)) return [];
    return [
      {
        kind: 'entity' as const,
        domain: 'todos' as const,
        id: `list:${list.id}`,
        title: list.name,
        href: checklistDetailHref(list.id),
        icon: 'tasks' as const,
      },
    ];
  });
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));
  const taskDocs = tasks.flatMap((task) => {
    const listName = listNameById.get(task.listId) ?? 'Checklist';
    if (!haystackMatchesQuery([task.title, listName], query)) return [];
    return [
      {
        kind: 'entity' as const,
        domain: 'todos' as const,
        id: `task:${task.id}`,
        title: task.title,
        subtitle: listName,
        href: checklistDetailHref(task.listId),
        icon: 'tasks' as const,
      },
    ];
  });
  return [...listDocs, ...taskDocs];
}

function buildCalendarDocuments(query: string): SearchDocument[] {
  const { activities, categories } = useSchedule.getState();
  return activities.flatMap((activity) => {
    if (!haystackMatchesQuery([activity.title, activity.notes, activity.summary, activity.date], query)) {
      return [];
    }
    const category = findCategory(categories, activity.categoryId);
    const when = activity.allDay
      ? activity.date
      : `${activity.date} · ${formatMinutes(activity.startMinutes)}`;
    return [
      {
        kind: 'entity' as const,
        domain: 'calendar' as const,
        id: `activity:${activity.id}`,
        title: activity.title,
        subtitle: when,
        href: { pathname: activityDetailPath(activity, category), params: { id: activity.id } },
        icon: 'calendar' as const,
      },
    ];
  });
}

function buildTravelDocuments(query: string): SearchDocument[] {
  const plans = filterTravelPlansByQuery(useTravel.getState().plans, query);
  return plans.map((plan) => ({
    kind: 'entity' as const,
    domain: 'travel' as const,
    id: `trip:${plan.id}`,
    title: plan.title,
    subtitle: plan.destination || plan.origin,
        href: { pathname: '/travel/[id]' as const, params: { id: plan.id } },
    icon: 'flight' as const,
  }));
}

function buildRecipeDocuments(query: string): SearchDocument[] {
  return searchRecipes(useRecipes.getState().recipes, query).map((recipe) => ({
    kind: 'entity' as const,
    domain: 'food' as const,
    id: `recipe:${recipe.id}`,
    title: recipe.title,
    subtitle: recipe.cuisine,
    href: `/(tabs)/food/recipes/${recipe.id}`,
    icon: 'food' as const,
  }));
}

function buildPlantDocuments(query: string): SearchDocument[] {
  return usePlants.getState().plants.flatMap((plant) => {
    if (
      !haystackMatchesQuery(
        [plant.nickname, plant.identity.commonName, plant.identity.scientificName, plant.health.summary],
        query,
      )
    ) {
      return [];
    }
    return [
      {
        kind: 'entity' as const,
        domain: 'plants' as const,
        id: `plant:${plant.id}`,
        title: plant.nickname || plant.identity.commonName,
        subtitle: plant.identity.scientificName,
        href: { pathname: '/plants/[id]' as const, params: { id: plant.id } },
        icon: 'plant' as const,
      },
    ];
  });
}

function buildFinanceDocuments(query: string): SearchDocument[] {
  const { dateDisplayFormat } = usePreferences.getState();
  return searchFinanceTransactions(
    useFinance.getState().transactions,
    query,
    dateDisplayFormat,
  ).map((transaction) => ({
    kind: 'entity' as const,
    domain: 'finance' as const,
    id: `txn:${transaction.id}`,
    title: transaction.merchant,
    subtitle: transaction.date,
    href: '/(tabs)/finance/transactions',
    icon: 'finance' as const,
  }));
}

function buildVehicleDocuments(query: string): SearchDocument[] {
  return useVehicles.getState().vehicles.flatMap((vehicle) => {
    const title = vehicleDisplayTitle(vehicle);
    if (
      !haystackMatchesQuery(
        [title, vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.plate, vehicle.vin],
        query,
      )
    ) {
      return [];
    }
    return [
      {
        kind: 'entity' as const,
        domain: 'vehicles' as const,
        id: `vehicle:${vehicle.id}`,
        title,
        subtitle: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '),
        href: { pathname: '/vehicles/[id]' as const, params: { id: vehicle.id } },
        icon: 'vehicles' as const,
      },
    ];
  });
}

function visionItemText(item: {
  kind: string;
  caption?: string;
  text?: string;
  attribution?: string;
  title?: string;
  note?: string;
}): string {
  if (item.kind === 'image') return item.caption ?? '';
  if (item.kind === 'affirmation') return `${item.text ?? ''} ${item.attribution ?? ''}`;
  return `${item.title ?? ''} ${item.note ?? ''}`;
}

function buildVisionDocuments(query: string): SearchDocument[] {
  const { categories, items } = useVisionBoard.getState();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return items.flatMap((item) => {
    const category = categoryById.get(item.categoryId);
    const title =
      item.kind === 'goal'
        ? item.title
        : item.kind === 'affirmation'
          ? item.text
          : (item.caption || category?.name || 'Vision Card');
    if (!haystackMatchesQuery([title, visionItemText(item), category?.name], query)) {
      return [];
    }
    return [
      {
        kind: 'entity' as const,
        domain: 'vision-board' as const,
        id: `vision:${item.id}`,
        title,
        subtitle: category?.name,
        href: `/vision-board/${item.categoryId}`,
        icon: 'vision-board' as const,
      },
    ];
  });
}

function buildPeopleDocuments(query: string): SearchDocument[] {
  return useFriends.getState().friends.flatMap((friend) => {
    if (!haystackMatchesQuery([friend.displayName], query)) return [];
    return [
      {
        kind: 'entity' as const,
        domain: 'people' as const,
        id: `person:${friend.userId}`,
        title: friend.displayName,
        href: '/(tabs)/social',
        icon: 'people' as const,
      },
    ];
  });
}

function buildJournalDocuments(query: string): SearchDocument[] {
  return useJournal.getState().pages.flatMap((page) => {
    const text = page.blocks
      .map((block) => {
        if (block.kind === 'text') return block.text;
        if (block.kind === 'link') return block.label;
        return '';
      })
      .join(' ');
    if (!haystackMatchesQuery([page.dateKey, text], query)) return [];
    return [
      {
        kind: 'entity' as const,
        domain: 'journal' as const,
        id: `journal:${page.dateKey}`,
        title: page.dateKey,
        subtitle: text.trim() || undefined,
        href: journalPageHref(page.dateKey),
        icon: 'journal' as const,
      },
    ];
  });
}

function buildHealthDocuments(query: string): SearchDocument[] {
  const { moodEntries, playbooks, emotions } = useHealth.getState();
  const emotionName = new Map(emotions.map((emotion) => [emotion.id, emotion.name]));
  const moodDocs = moodEntries.flatMap((entry) => {
    const labels = entry.emotions
      .map((rating) => emotionName.get(rating.emotionId))
      .filter(Boolean);
    if (!haystackMatchesQuery([entry.note, ...labels], query)) return [];
    return [
      {
        kind: 'entity' as const,
        domain: 'health' as const,
        id: `mood:${entry.id}`,
        title: labels[0] || 'Mood Check-In',
        subtitle: entry.note,
        href: { pathname: '/health/mood-check-in' as const, params: { entryId: entry.id } },
        icon: 'health' as const,
      },
    ];
  });
  const playbookDocs = playbooks.flatMap((playbook) => {
    if (!haystackMatchesQuery([playbook.name, ...(playbook.steps ?? [])], query)) {
      return [];
    }
    return [
      {
        kind: 'entity' as const,
        domain: 'health' as const,
        id: `playbook:${playbook.id}`,
        title: playbook.name,
        href: { pathname: '/health/playbook-editor' as const, params: { playbookId: playbook.id } },
        icon: 'health' as const,
      },
    ];
  });
  return [...moodDocs, ...playbookDocs];
}

function addonOn(enabledAddons: AddonEnabledState, routeName: string): boolean {
  return isTrackerRouteEnabled(routeName, enabledAddons);
}

/** Query-time documents. Empty query is screens only; typed query adds entities. */
export function buildSearchDocuments(input: AppSearchSnapshot): SearchDocument[] {
  const screens = catalogSearchScreens(input.enabledAddons, input.query);
  if (!input.query.trim()) return screens;

  const enabled = input.enabledAddons;
  const entities: SearchDocument[] = [
    ...buildTodoDocuments(input.query),
    ...buildCalendarDocuments(input.query),
    ...buildPeopleDocuments(input.query),
  ];
  if (addonOn(enabled, 'travel')) entities.push(...buildTravelDocuments(input.query));
  if (addonOn(enabled, 'food')) entities.push(...buildRecipeDocuments(input.query));
  if (addonOn(enabled, 'plants')) entities.push(...buildPlantDocuments(input.query));
  if (addonOn(enabled, 'finance')) entities.push(...buildFinanceDocuments(input.query));
  if (addonOn(enabled, 'vehicles')) entities.push(...buildVehicleDocuments(input.query));
  if (addonOn(enabled, 'vision-board')) entities.push(...buildVisionDocuments(input.query));
  if (addonOn(enabled, 'journal')) entities.push(...buildJournalDocuments(input.query));
  if (addonOn(enabled, 'health')) entities.push(...buildHealthDocuments(input.query));
  return [...screens, ...entities];
}

export function groupSearchDocuments(documents: SearchDocument[]): SearchGroup[] {
  const buckets = new Map<SearchDomain, SearchDocument[]>();
  for (const document of documents) {
    const items = buckets.get(document.domain) ?? [];
    items.push(document);
    buckets.set(document.domain, items);
  }
  const order: SearchDomain[] = [
    'screen',
    'todos',
    'calendar',
    'travel',
    'food',
    'plants',
    'finance',
    'vehicles',
    'vision-board',
    'people',
    'journal',
    'health',
  ];
  return order.flatMap((domain) => {
    const items = buckets.get(domain);
    if (!items?.length) return [];
    return [
      {
        domain,
        label: SEARCH_GROUP_LABEL[domain],
        items: cap(items),
      },
    ];
  });
}
