import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  EmptyState,
  IconButton,
  ScreenHeader,
  SectionHeader,
} from '@/components/primitives';
import { NutritionStat } from '@/features/food/components';
import { FoodHeaderBackButton } from '@/features/food/food-header-back-button';
import { FoodScreen } from '@/features/food/food-screen';
import { ScheduledMealRow } from '@/features/food/scheduled-meal-row';
import { useResponsive } from '@/hooks/use-responsive';
import {
  selectScheduledMealsByType,
  sumScheduledMealNutrition,
  type ScheduledMeal,
} from '@/store/food-selectors';
import { useSchedule } from '@/store/schedule';
import type { MealType } from '@/types/models';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { addDays, formatDateLong, formatWeekday, isToday, todayKey } from '@/utils/date';

/** Tracker sections; pre/post-workout meals roll up under Snacks. */
const MEAL_SECTIONS: readonly {
  id: string;
  title: string;
  mealTypes: readonly MealType[];
}[] = [
  { id: 'breakfast', title: 'Breakfast', mealTypes: ['breakfast'] },
  { id: 'lunch', title: 'Lunch', mealTypes: ['lunch'] },
  { id: 'dinner', title: 'Dinner', mealTypes: ['dinner'] },
  { id: 'snacks', title: 'Snacks', mealTypes: ['snack', 'pre-workout', 'post-workout'] },
];

/** Meal tracker — reads the EXISTING schedule meals; storage is never forked. */
export default function FoodTrackerScreen() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const activities = useSchedule((state) => state.activities);
  const meals = useSchedule((state) => state.meals);
  const [dateKey, setDateKey] = useState(todayKey());

  const grouped = useMemo(
    () => selectScheduledMealsByType({ activities, meals }, dateKey),
    [activities, meals, dateKey],
  );
  const sections = useMemo(
    () =>
      MEAL_SECTIONS.map((section) => ({
        ...section,
        entries: section.mealTypes.flatMap((mealType) => grouped[mealType] ?? []),
      })),
    [grouped],
  );
  const dayMeals = useMemo(
    () => sections.flatMap((section) => section.entries),
    [sections],
  );
  const totals = useMemo(() => sumScheduledMealNutrition(dayMeals), [dayMeals]);
  const onToday = isToday(dateKey);

  // Existing meal-entry path: activity form pre-set to the Food category.
  const addMeal = () =>
    router.push({ pathname: '/activity-form', params: { date: dateKey, category: 'food' } });
  const openMeal = (entry: ScheduledMeal) =>
    router.push(`/detail/food/${entry.activity.id}` as never);

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="Meal Tracker"
        leading={<FoodHeaderBackButton />}
      />

      <Card padded={false}>
        <View style={[styles.dateRow, { padding: spacing.sm, gap: spacing.sm }]}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Previous day"
            testID={AgentUiIds.food.tracker.prevDay}
            onPress={() => setDateKey((key) => addDays(key, -1))}
          />
          <View style={styles.dateCopy}>
            <AppText variant="subheading" align="center" fit>
              {onToday ? 'Today' : formatWeekday(dateKey)}
            </AppText>
            <AppText variant="caption" color="secondary" align="center" fit>
              {formatDateLong(dateKey)}
            </AppText>
          </View>
          <IconButton
            icon="chevron-right"
            accessibilityLabel="Next day"
            testID={AgentUiIds.food.tracker.nextDay}
            onPress={() => setDateKey((key) => addDays(key, 1))}
          />
        </View>
      </Card>
      {!onToday ? (
        <View style={styles.todayChipRow}>
          <ActionChip
            label="Back to today"
            icon="today"
            testID={AgentUiIds.food.tracker.today}
            onPress={() => setDateKey(todayKey())}
          />
        </View>
      ) : null}

      <AgentTestId
        testID={AgentUiIds.food.tracker.mealsSection}
        label="Meals for the day"
        style={{ gap: spacing.lg }}>
        {dayMeals.length === 0 ? (
          <EmptyState
            icon="food"
            title="No meals on this day"
            message="Add breakfast, lunch, or dinner and it shows up on your timeline too."
            actionLabel="Add Meal"
            actionTestID={AgentUiIds.food.tracker.emptyAdd}
            onAction={addMeal}
          />
        ) : (
          sections.map((section) => (
            <AgentTestId
              key={section.id}
              testID={AgentUiIds.food.tracker.section(section.id)}
              label={section.title}
              style={{ gap: spacing.sm }}>
              <SectionHeader
                flush
                title={section.title}
                actionLabel="Add"
                actionTestID={AgentUiIds.food.tracker.add(section.id)}
                onAction={addMeal}
              />
              {section.entries.length === 0 ? (
                <AppText variant="caption" color="tertiary">
                  Nothing logged.
                </AppText>
              ) : (
                <Card
                  padded={false}
                  style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                  {section.entries.map((entry) => (
                    <ScheduledMealRow
                      key={entry.activity.id}
                      entry={entry}
                      testID={AgentUiIds.food.tracker.row(entry.activity.id)}
                      onPress={() => openMeal(entry)}
                    />
                  ))}
                </Card>
              )}
            </AgentTestId>
          ))
        )}
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.food.tracker.nutritionSection}
        label="Nutrition summary"
        style={{ gap: spacing.sm }}>
        <SectionHeader flush title="Nutrition" />
        {totals.loggedItemCount === 0 ? (
          <AppText variant="callout" color="secondary">
            Analyze or edit a meal and its macros total up here.
          </AppText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}>
            <NutritionStat value={`${Math.round(totals.calories)}`} label="Calories" />
            <NutritionStat value={`${Math.round(totals.proteinG)}g`} label="Protein" />
            <NutritionStat value={`${Math.round(totals.carbsG)}g`} label="Carbs" />
            <NutritionStat value={`${Math.round(totals.fatG)}g`} label="Fat" />
          </ScrollView>
        )}
      </AgentTestId>
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayChipRow: {
    flexDirection: 'row',
  },
});
