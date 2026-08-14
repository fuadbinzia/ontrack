import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeOutLeft,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import {
  isTrackerRouteEnabled,
  TAB_META,
} from '@/components/navigation/bottom-nav-tab-meta';
import {
  AppText,
  GlassIconWell,
  GlassPlate,
  IconButton,
  Screen,
  ScreenHeader,
  Symbol,
} from '@/components/primitives';
import { motion, radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useFinance } from '@/store/finance';
import { useMealPlan } from '@/store/food-meal-plan';
import { useHealth } from '@/store/health';
import { useOverviewAttention } from '@/store/overview-attention';
import { usePlants } from '@/store/plants';
import { useSchedule } from '@/store/schedule';
import { useTodos } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useUI } from '@/store/ui';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';
import {
  formatDateKeyMedium,
  formatMinutes,
  formatTripDateRangeLabel,
  nowMinutes,
  todayKey,
} from '@/utils/date';
import { getNumberFormatter } from '@/utils/intl-cache';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatCount, formatCountWithVerb } from '@/utils/grammar';

import { OverviewSummaryRow, type OverviewRow } from './overview-summary-row';
import {
  maintenanceDueCount,
  nextTravelPlan,
  overviewAttentionItems,
  plantsDue,
  remainingActivities,
  upcomingBills,
} from './overview-summary';

function formatMoney(amount: number, currency: string) {
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

export function OverviewScreen() {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const enabledAddons = useAddons((state) => state.enabled);
  const activities = useSchedule((state) => state.activities);
  const categories = useSchedule((state) => state.categories);
  const lists = useTodos((state) => state.lists);
  const tasks = useTodos((state) => state.tasks);
  const plans = useTravel((state) => state.plans);
  const bills = useFinance((state) => state.bills);
  const plants = usePlants((state) => state.plants);
  const healthSummaries = useHealth((state) => state.dailySummaries);
  const moodEntries = useHealth((state) => state.moodEntries);
  const vehicles = useVehicles((state) => state.vehicles);
  const mealEntries = useMealPlan((state) => state.entries);
  const visionCategories = useVisionBoard((state) => state.categories);
  const visionItems = useVisionBoard((state) => state.items);
  const acknowledgedAttentionKeys = useOverviewAttention(
    (state) => state.acknowledgedKeys,
  );
  const acknowledgeAttention = useOverviewAttention(
    (state) => state.acknowledge,
  );
  const setSelectedDate = useUI((state) => state.setSelectedDate);

  const summary = useMemo(() => {
    const today = todayKey();
    const remaining = remainingActivities(activities, today, nowMinutes());
    const nextTrip = nextTravelPlan(plans, today);
    const openTasks = tasks.filter((task) => !task.completed);
    const nextBills = upcomingBills(bills, today);
    const overdueBills = bills.filter(
      (bill) => bill.active && bill.nextDue <= today,
    );
    const duePlants = plantsDue(plants, today);
    const dueMaintenance = maintenanceDueCount(vehicles, today);
    const mealsToday = mealEntries.filter((entry) => entry.dateKey === today);
    const todayHealth = healthSummaries.find(
      (entry) => entry.dateKey === today,
    );
    const gymCategoryIds = new Set(
      categories
        .filter((category) => category.detailKind === 'gym')
        .map((category) => category.id),
    );
    const workoutsToday = activities.filter(
      (activity) =>
        activity.date === today && gymCategoryIds.has(activity.categoryId),
    );
    const activeGoals = visionItems.filter((item) => item.kind === 'goal');
    const acknowledged = new Set(acknowledgedAttentionKeys);
    const attentionItems = overviewAttentionItems({
      activities: remaining,
      overdueBills,
      duePlants,
      vehicles,
      dateKey: today,
    }).filter((item) => !acknowledged.has(item.key));
    const nextTodayActivity =
      remaining.find((activity) => !activity.allDay) ?? remaining[0];
    const rows: OverviewRow[] = [
      {
        routeName: '(today)',
        label: 'Today',
        icon: TAB_META['(today)'].icon,
        headline: remaining.length
          ? `${formatCount(remaining.length, 'item')} still in motion`
          : 'Your day is clear',
        detail: nextTodayActivity
          ? `${nextTodayActivity.allDay ? 'All day' : formatMinutes(nextTodayActivity.startMinutes)} · ${nextTodayActivity.title}`
          : 'Open the timeline to plan what comes next.',
        href: TAB_META['(today)'].href,
        beforeNavigate: () => setSelectedDate(todayKey()),
      },
      {
        routeName: 'travel',
        label: 'Travel',
        icon: TAB_META.travel.icon,
        headline: nextTrip ? nextTrip.destination : 'No upcoming trip',
        detail: nextTrip
          ? formatTripDateRangeLabel(nextTrip.startDate, nextTrip.endDate)
          : 'Build your next itinerary when inspiration hits.',
        href: TAB_META.travel.href,
      },
      {
        routeName: 'to-do',
        label: 'Checklists',
        icon: TAB_META['to-do'].icon,
        headline: openTasks.length
          ? `${formatCount(openTasks.length, 'item')} open`
          : 'Everything checked off',
        detail: lists.length
          ? `Across ${formatCount(lists.length, 'list')}.`
          : 'Create a checklist or grocery list.',
        href: TAB_META['to-do'].href,
      },
      {
        routeName: 'finance',
        label: 'Finance',
        icon: TAB_META.finance.icon,
        headline: overdueBills.length
          ? `${formatCount(overdueBills.length, 'bill')} due now`
          : nextBills.length
            ? `${formatCount(nextBills.length, 'bill')} coming up`
            : 'No upcoming bills',
        detail: nextBills[0]
          ? `${nextBills[0].name} · ${formatMoney(nextBills[0].amount, nextBills[0].currency)} · ${formatDateKeyMedium(nextBills[0].nextDue)}`
          : 'Accounts, savings, and spending are one tap away.',
        href: TAB_META.finance.href,
      },
      {
        routeName: 'plants',
        label: 'Plants',
        icon: TAB_META.plants.icon,
        headline: duePlants.length
          ? `${formatCountWithVerb(duePlants.length, 'plant', 'needs', 'need')} care`
          : 'Care is on track',
        detail: plants.length
          ? `${formatCount(plants.length, 'plant')} in your collection.`
          : 'Add a plant to begin a care plan.',
        href: TAB_META.plants.href,
      },
      {
        routeName: 'workouts',
        label: 'Fitness',
        icon: TAB_META.workouts.icon,
        headline: workoutsToday.length
          ? `${formatCount(workoutsToday.length, 'workout')} today`
          : 'No workout scheduled',
        detail:
          workoutsToday[0]?.title ?? 'Explore muscles or build a session.',
        href: TAB_META.workouts.href,
      },
      {
        routeName: 'health',
        label: 'Health',
        icon: TAB_META.health.icon,
        headline:
          todayHealth?.steps !== undefined
            ? `${todayHealth.steps.toLocaleString()} steps today`
            : 'Your health pulse',
        detail:
          todayHealth?.exerciseMinutes !== undefined
            ? `${formatCount(todayHealth.exerciseMinutes, 'active minute')}.`
            : moodEntries.length
              ? `${formatCount(moodEntries.length, 'mind check-in')} recorded.`
              : 'Review body metrics or check in with your mind.',
        href: TAB_META.health.href,
      },
      {
        routeName: 'vehicles',
        label: 'Vehicles',
        icon: TAB_META.vehicles.icon,
        headline: dueMaintenance
          ? `${formatCount(dueMaintenance, 'service item')} due`
          : 'Maintenance looks good',
        detail: vehicles.length
          ? `${formatCount(vehicles.length, 'vehicle')} tracked.`
          : 'Add a vehicle to track service and costs.',
        href: TAB_META.vehicles.href,
      },
      {
        routeName: 'food',
        label: 'Food',
        icon: TAB_META.food.icon,
        headline: mealsToday.length
          ? `${formatCount(mealsToday.length, 'meal')} planned today`
          : 'Today’s menu is open',
        detail:
          mealsToday[0]?.freeformTitle ??
          'Plan a meal, explore recipes, or check your pantry.',
        href: TAB_META.food.href,
      },
      {
        routeName: 'vision-board',
        label: 'Vision Board',
        icon: TAB_META['vision-board'].icon,
        headline: activeGoals.length
          ? `${formatCount(activeGoals.length, 'goal')} in view`
          : 'Make the future visible',
        detail: `${formatCount(visionItems.length, 'idea')} across ${formatCount(visionCategories.length, 'board')}.`,
        href: TAB_META['vision-board'].href,
      },
      {
        routeName: 'calendar',
        label: 'Calendar',
        icon: TAB_META.calendar.icon,
        headline: 'See the wider rhythm',
        detail: 'Move from today into the days and weeks ahead.',
        href: TAB_META.calendar.href,
      },
      {
        routeName: 'insights',
        label: 'Insights',
        icon: TAB_META.insights.icon,
        headline: 'Patterns across your life',
        detail: 'See how your routines and follow-through are trending.',
        href: TAB_META.insights.href,
      },
      {
        routeName: 'social',
        label: 'Social',
        icon: TAB_META.social.icon,
        headline: 'Your people, together',
        detail: 'Open shared activity and connections.',
        href: TAB_META.social.href,
      },
      {
        routeName: 'games',
        label: 'Games',
        icon: TAB_META.games.icon,
        headline: 'Take a playful break',
        detail: 'Jump into your games collection.',
        href: TAB_META.games.href,
      },
      {
        routeName: 'profile',
        label: 'Profile',
        icon: TAB_META.profile.icon,
        headline: 'Make onTrack yours',
        detail: 'Manage add-ons, preferences, and your account.',
        href: TAB_META.profile.href,
      },
    ];

    return {
      attentionCount: attentionItems.length,
      attentionItems,
      rows: rows.filter((row) =>
        isTrackerRouteEnabled(row.routeName, enabledAddons),
      ),
    };
  }, [
    acknowledgedAttentionKeys,
    activities,
    bills,
    categories,
    enabledAddons,
    healthSummaries,
    lists.length,
    mealEntries,
    moodEntries.length,
    plans,
    plants,
    setSelectedDate,
    tasks,
    vehicles,
    visionCategories.length,
    visionItems,
  ]);

  const heroTitle = summary.attentionCount
    ? `${formatCountWithVerb(summary.attentionCount, 'thing', 'needs', 'need')} your attention`
    : 'Everything is moving smoothly';

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.overview.screen} label="Overview screen">
        <ScreenHeader
          eyebrow="Your onTrack pulse"
          title="Overview"
          subtitle="The important parts of your life, together in one place."
        />
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.overview.hero} label="Overview pulse">
        <GlassPlate
          intensity={64}
          style={[
            styles.hero,
            {
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: theme.success,
              padding: spacing.lg,
              gap: spacing.sm,
            },
          ]}>
          <View style={[styles.heroTop, { gap: spacing.sm }]}>
            <View style={styles.heroCopy}>
              <AppText variant="overline" color="success" fit>
                Right now
              </AppText>
              <AppText variant="heading">{heroTitle}</AppText>
            </View>
            <GlassIconWell size={s(48)} borderRadius={radii.lg}>
              <Symbol name="habit" size={s(22)} color={theme.success} />
            </GlassIconWell>
          </View>
          {summary.attentionItems.length ? (
            <View style={{ gap: spacing.xxs }}>
              {summary.attentionItems.slice(0, 3).map((item) => (
                <Animated.View
                  key={item.key}
                  exiting={FadeOutLeft.duration(motion.fade).reduceMotion(
                    ReduceMotion.System,
                  )}
                  layout={LinearTransition.duration(motion.layout).reduceMotion(
                    ReduceMotion.System,
                  )}
                  style={[styles.attentionRow, { gap: spacing.xs }]}>
                  <AppText
                    variant="callout"
                    color="primary"
                    style={styles.attentionLabel}>
                    • {item.label}
                  </AppText>
                  <IconButton
                    icon="check"
                    size={s(34)}
                    iconSize="sm"
                    color={theme.success}
                    accessibilityLabel={`Acknowledge ${item.label}`}
                    testID={AgentUiIds.overview.acknowledge(item.key)}
                    onPress={() => acknowledgeAttention(item.key)}
                  />
                </Animated.View>
              ))}
              {summary.attentionItems.length > 3 ? (
                <AppText variant="caption" color="secondary">
                  +{summary.attentionItems.length - 3} more across your sections
                </AppText>
              ) : null}
            </View>
          ) : null}
        </GlassPlate>
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.overview.section} label="Across onTrack">
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHeading}>
            <AppText variant="heading" fit style={styles.sectionTitle}>
              Across onTrack
            </AppText>
            <AppText variant="caption" color="secondary" fit>
              Live from your sections
            </AppText>
          </View>
          <GlassPlate
            style={[
              styles.summaryPlate,
              {
                borderRadius: radii.xl,
                paddingHorizontal: spacing.md,
              },
            ]}>
            {summary.rows.map((row, index) => (
              <OverviewSummaryRow
                key={row.routeName}
                row={row}
                isLast={index === summary.rows.length - 1}
              />
            ))}
          </GlassPlate>
        </View>
      </AgentTestId>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  attentionRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attentionLabel: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  summaryPlate: {
    overflow: 'hidden',
  },
});
