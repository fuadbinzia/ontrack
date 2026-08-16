import {
  isTrackerRouteEnabled,
  TAB_META,
} from '@/components/navigation/bottom-nav-tab-meta';
import { gymCategoryIds } from '@/constants/categories';
import type { EventCalendarArtwork } from '@/features/events/event-calendar-artwork';
import type { FinanceRecurringBill } from '@/features/finance/types';
import type { TravelPlan } from '@/features/travel/types';
import type { Vehicle } from '@/features/vehicles/types';
import type { EventDetails, EventFollow } from '@/services/events';
import type { Activity, ActivityCategory, Plant } from '@/types/models';
import {
  formatDateKeyMedium,
  formatMinutes,
  formatTripDateRangeLabel,
  todayKey,
} from '@/utils/date';
import { getNumberFormatter } from '@/utils/intl-cache';
import { formatCount, formatCountWithVerb } from '@/utils/grammar';

import {
  findCalendarEventExcitement,
  resolveExcitementArtwork,
  type CalendarEventExcitement,
} from './calendar-event-excitement';
import {
  sortOverviewRowsByAffinity,
  type OverviewAffinityEntry,
} from './overview-affinity';
import type { OverviewRow } from './overview-summary-row';
import {
  maintenanceDueCount,
  nextTravelPlan,
  overviewAttentionItems,
  plantsDue,
  remainingActivities,
  upcomingBills,
  type OverviewAttentionItem,
} from './overview-summary';

export function formatOverviewMoney(amount: number, currency: string) {
  try {
    return getNumberFormatter(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export type OverviewSummaryInput = {
  today: string;
  currentMinutes: number;
  activities: readonly Activity[];
  categories: readonly ActivityCategory[];
  eventDetails: readonly EventDetails[];
  eventFollows: readonly EventFollow[];
  listsCount: number;
  openTaskCount: number;
  plans: readonly TravelPlan[];
  bills: readonly FinanceRecurringBill[];
  plants: readonly Plant[];
  healthSummaries: readonly {
    dateKey: string;
    steps?: number;
    exerciseMinutes?: number;
  }[];
  moodEntryCount: number;
  vehicles: readonly Vehicle[];
  mealEntries: readonly { dateKey: string; freeformTitle?: string }[];
  visionCategoryCount: number;
  visionItems: readonly { kind: string }[];
  acknowledgedAttentionKeys: readonly string[];
  enabledAddons: Record<string, boolean>;
  setSelectedDate: (date: string) => void;
  affinities?: Readonly<Record<string, OverviewAffinityEntry>>;
  now?: number;
};

export type OverviewSummary = {
  dateLabel: string;
  attentionCount: number;
  attentionItems: OverviewAttentionItem[];
  eventExcitement: CalendarEventExcitement | undefined;
  eventArtwork: EventCalendarArtwork | undefined;
  rows: OverviewRow[];
};

export function buildOverviewSummary(input: OverviewSummaryInput): OverviewSummary {
  const remaining = remainingActivities(
    input.activities,
    input.today,
    input.currentMinutes,
  );
  const nextTrip = nextTravelPlan(input.plans, input.today);
  const nextBills = upcomingBills(input.bills, input.today);
  const overdueBills = input.bills.filter(
    (bill) => bill.active && bill.nextDue <= input.today,
  );
  const duePlants = plantsDue(input.plants, input.today);
  const dueMaintenance = maintenanceDueCount(input.vehicles, input.today);
  const mealsToday = input.mealEntries.filter(
    (entry) => entry.dateKey === input.today,
  );
  const todayHealth = input.healthSummaries.find(
    (entry) => entry.dateKey === input.today,
  );
  const gymIds = gymCategoryIds(input.categories);
  const workoutsToday = input.activities.filter(
    (activity) =>
      activity.date === input.today && gymIds.has(activity.categoryId),
  );
  const activeGoals = input.visionItems.filter((item) => item.kind === 'goal');
  const acknowledged = new Set(input.acknowledgedAttentionKeys);
  const attentionItems = overviewAttentionItems({
    activities: remaining,
    overdueBills,
    duePlants,
    vehicles: input.vehicles,
    dateKey: input.today,
  }).filter((item) => !acknowledged.has(item.key));
  const nextTodayActivity =
    remaining.find((activity) => !activity.allDay) ?? remaining[0];
  const eventExcitement = findCalendarEventExcitement({
    activities: input.activities,
    categories: input.categories,
    eventDetails: input.eventDetails,
    today: input.today,
    currentMinutes: input.currentMinutes,
  });
  const eventArtwork = resolveExcitementArtwork(
    eventExcitement,
    input.eventDetails,
    input.eventFollows,
  );
  const rows: OverviewRow[] = [
    {
      routeName: '(today)',
      label: 'Today',
      headline: remaining.length
        ? `${formatCount(remaining.length, 'item')} still in motion`
        : 'Your day is clear',
      detail: nextTodayActivity
        ? `${nextTodayActivity.allDay ? 'All day' : formatMinutes(nextTodayActivity.startMinutes)} · ${nextTodayActivity.title}`
        : 'Open the timeline to plan what comes next.',
      href: TAB_META['(today)'].href,
      tone: remaining.length ? 'accent' : 'success',
      beforeNavigate: () => input.setSelectedDate(todayKey()),
    },
    {
      routeName: 'travel',
      label: 'Travel',
      headline: nextTrip ? nextTrip.destination : 'No upcoming trip',
      detail: nextTrip
        ? formatTripDateRangeLabel(nextTrip.startDate, nextTrip.endDate)
        : 'Build your next itinerary when inspiration hits.',
      href: TAB_META.travel.href,
      tone: 'accent',
    },
    {
      routeName: 'to-do',
      label: 'Checklists',
      headline: input.openTaskCount
        ? `${formatCount(input.openTaskCount, 'item')} open`
        : 'Everything checked off',
      detail: input.listsCount
        ? `Across ${formatCount(input.listsCount, 'list')}.`
        : 'Create a checklist or grocery list.',
      href: TAB_META['to-do'].href,
      tone: input.openTaskCount ? 'accent' : 'success',
    },
    {
      routeName: 'finance',
      label: 'Finance',
      headline: overdueBills.length
        ? `${formatCount(overdueBills.length, 'bill')} due now`
        : nextBills.length
          ? `${formatCount(nextBills.length, 'bill')} coming up`
          : 'No upcoming bills',
      detail: nextBills[0]
        ? `${nextBills[0].name} · ${formatOverviewMoney(nextBills[0].amount, nextBills[0].currency)} · ${formatDateKeyMedium(nextBills[0].nextDue)}`
        : 'Accounts, savings, and spending are one tap away.',
      href: TAB_META.finance.href,
      tone: overdueBills.length
        ? 'danger'
        : nextBills.length
          ? 'warning'
          : 'secondary',
    },
    {
      routeName: 'plants',
      label: 'Plants',
      headline: duePlants.length
        ? `${formatCountWithVerb(duePlants.length, 'plant', 'needs', 'need')} care`
        : 'Care is on track',
      detail: input.plants.length
        ? `${formatCount(input.plants.length, 'plant')} in your collection.`
        : 'Add a plant to begin a care plan.',
      href: TAB_META.plants.href,
      tone: duePlants.length ? 'warning' : 'success',
    },
    {
      routeName: 'workouts',
      label: 'Fitness',
      headline: workoutsToday.length
        ? `${formatCount(workoutsToday.length, 'workout')} today`
        : 'No workout scheduled',
      detail: workoutsToday[0]?.title ?? 'Explore muscles or build a session.',
      href: TAB_META.workouts.href,
      tone: workoutsToday.length ? 'success' : 'secondary',
    },
    {
      routeName: 'health',
      label: 'Health',
      headline:
        todayHealth?.steps !== undefined
          ? `${todayHealth.steps.toLocaleString()} steps today`
          : 'Your health pulse',
      detail:
        todayHealth?.exerciseMinutes !== undefined
          ? `${formatCount(todayHealth.exerciseMinutes, 'active minute')}.`
          : input.moodEntryCount
            ? `${formatCount(input.moodEntryCount, 'mind check-in')} recorded.`
            : 'Review body metrics or check in with your mind.',
      href: TAB_META.health.href,
      tone: todayHealth ? 'success' : 'secondary',
    },
    {
      routeName: 'vehicles',
      label: 'Vehicles',
      headline: dueMaintenance
        ? `${formatCount(dueMaintenance, 'service item')} due`
        : 'Maintenance looks good',
      detail: input.vehicles.length
        ? `${formatCount(input.vehicles.length, 'vehicle')} tracked.`
        : 'Add a vehicle to track service and costs.',
      href: TAB_META.vehicles.href,
      tone: dueMaintenance ? 'warning' : 'success',
    },
    {
      routeName: 'food',
      label: 'Food',
      headline: mealsToday.length
        ? `${formatCount(mealsToday.length, 'meal')} planned today`
        : 'Today’s menu is open',
      detail:
        mealsToday[0]?.freeformTitle ??
        'Plan a meal, explore recipes, or check your pantry.',
      href: TAB_META.food.href,
      tone: mealsToday.length ? 'success' : 'secondary',
    },
    {
      routeName: 'vision-board',
      label: 'Vision Board',
      headline: activeGoals.length
        ? `${formatCount(activeGoals.length, 'goal')} in view`
        : 'Make the future visible',
      detail: `${formatCount(input.visionItems.length, 'idea')} across ${formatCount(input.visionCategoryCount, 'board')}.`,
      href: TAB_META['vision-board'].href,
      tone: 'accent',
    },
    {
      routeName: 'calendar',
      label: 'Calendar',
      headline: 'See the wider rhythm',
      detail: 'Move from today into the days and weeks ahead.',
      href: TAB_META.calendar.href,
      tone: 'secondary',
    },
    {
      routeName: 'insights',
      label: 'Insights',
      headline: 'Patterns across your life',
      detail: 'See how your routines and follow-through are trending.',
      href: TAB_META.insights.href,
      tone: 'accent',
    },
    {
      routeName: 'social',
      label: 'Social',
      headline: 'Your people, together',
      detail: 'Open shared activity and connections.',
      href: TAB_META.social.href,
      tone: 'success',
    },
    {
      routeName: 'games',
      label: 'Games',
      headline: 'Take a playful break',
      detail: 'Jump into your games collection.',
      href: TAB_META.games.href,
      tone: 'accent',
    },
    {
      routeName: 'profile',
      label: 'Profile',
      headline: 'Make onTrack yours',
      detail: 'Manage add-ons, preferences, and your account.',
      href: TAB_META.profile.href,
      tone: 'secondary',
    },
  ];

  return {
    dateLabel: formatDateKeyMedium(input.today),
    attentionCount: attentionItems.length,
    attentionItems,
    eventExcitement,
    eventArtwork,
    rows: sortOverviewRowsByAffinity(
      rows.filter((row) =>
        isTrackerRouteEnabled(row.routeName, input.enabledAddons),
      ),
      input.affinities ?? {},
      input.now ?? Date.now(),
    ),
  };
}
