import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  IconButton,
  Input,
  SectionHeader,
  SegmentedControl,
} from '@/components/primitives';
import { FoodSheet } from '@/features/food/food-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  FOOD_MEAL_TYPE_OPTIONS,
  mealTypeLabel,
  planDayRelativeLabel,
} from '@/services/food/labels';
import { selectEntriesForDate, useMealPlan } from '@/store/food-meal-plan';
import { useRecipes } from '@/store/food-recipes';
import type { MealPlanEntry, MealType, Recipe } from '@/types/food';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { addDays, formatDateLong, formatWeekday, todayKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';

const WEEK_DAYS = 7;
const MAX_SERVINGS = 12;

function dayTitle(dateKey: string, offset: number): string {
  return planDayRelativeLabel(offset, () => formatWeekday(dateKey));
}

/** This week's meal plan — SCREENS.md §10 top panel. Add/remove via `useMealPlan`. */
export function PlanWeekPanel() {
  const router = useRouter();
  const theme = useTheme();
  const { spacing } = useResponsive();
  const entries = useMealPlan((state) => state.entries);
  const removeEntry = useMealPlan((state) => state.removeEntry);
  const recipes = useRecipes((state) => state.recipes);
  const [sheetDateKey, setSheetDateKey] = useState<string | undefined>();

  const today = todayKey();
  const days = useMemo(
    () =>
      Array.from({ length: WEEK_DAYS }, (_, offset) => {
        const dateKey = addDays(today, offset);
        return { dateKey, offset, entries: selectEntriesForDate(entries, dateKey) };
      }),
    [entries, today],
  );

  const recipeTitle = (entry: MealPlanEntry): string => {
    if (entry.recipeId) {
      const recipe = recipes.find((item) => item.id === entry.recipeId);
      if (recipe) return recipe.title;
    }
    return entry.freeformTitle?.trim() || 'Planned meal';
  };

  return (
    <AgentTestId
      testID={AgentUiIds.food.plan.weekSection}
      label="This week"
      style={{ gap: spacing.sm }}>
      <SectionHeader flush title="This Week" />
      <Card padded={false}>
        {days.map((day, index) => (
          <View
            key={day.dateKey}
            style={[
              { padding: spacing.md, gap: spacing.sm },
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
              },
            ]}>
            <View style={[styles.dayHeader, { gap: spacing.sm }]}>
              <View style={styles.dayCopy}>
                <AppText variant="callout" fit>
                  {dayTitle(day.dateKey, day.offset)}
                </AppText>
                <AppText variant="caption" color="tertiary" fit>
                  {formatDateLong(day.dateKey)}
                </AppText>
              </View>
              <IconButton
                icon="add"
                size={36}
                iconSize="sm"
                accessibilityLabel={`Plan a meal for ${dayTitle(day.dateKey, day.offset)}`}
                testID={AgentUiIds.food.plan.dayAdd(day.dateKey)}
                onPress={() => setSheetDateKey(day.dateKey)}
              />
            </View>
            {day.entries.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                {day.entries.map((entry) => (
                  <PlanEntryRow
                    key={entry.id}
                    entry={entry}
                    title={recipeTitle(entry)}
                    onOpenRecipe={
                      entry.recipeId
                        ? () =>
                            router.push(`/(tabs)/food/recipes/${entry.recipeId}` as never)
                        : undefined
                    }
                    onRemove={() => {
                      haptics.select();
                      removeEntry(entry.id);
                    }}
                  />
                ))}
              </View>
            ) : (
              <AppText variant="caption" color="tertiary">
                Nothing planned
              </AppText>
            )}
          </View>
        ))}
      </Card>

      <PlanEntrySheet
        visible={sheetDateKey != null}
        dateKey={sheetDateKey ?? today}
        recipes={recipes}
        onClose={() => setSheetDateKey(undefined)}
      />
    </AgentTestId>
  );
}

function PlanEntryRow({
  entry,
  title,
  onOpenRecipe,
  onRemove,
}: {
  entry: MealPlanEntry;
  title: string;
  onOpenRecipe?: () => void;
  onRemove: () => void;
}) {
  const { spacing, layout } = useResponsive();
  const agent = useAgentUiTarget(AgentUiIds.food.plan.entry(entry.id), {
    label: title,
    onPress: onOpenRecipe,
  });

  return (
    <View style={[styles.entryRow, { gap: spacing.sm }]}>
      <Pressable
        ref={agent.ref}
        testID={agent.testID}
        onLayout={agent.onLayout}
        accessibilityRole={onOpenRecipe ? 'button' : 'text'}
        accessibilityLabel={`${mealTypeLabel(entry.mealType)}: ${title}`}
        disabled={!onOpenRecipe}
        onPress={onOpenRecipe}
        style={({ pressed }) => [
          styles.entryCopy,
          { minHeight: layout.minTapTarget, opacity: pressed ? 0.72 : 1 },
        ]}>
        <AppText variant="overline" color="tertiary" fit>
          {mealTypeLabel(entry.mealType)}
        </AppText>
        <AppText variant="body" fit numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          {`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'}`}
        </AppText>
      </Pressable>
      <IconButton
        icon="close"
        size={36}
        iconSize="sm"
        background="transparent"
        accessibilityLabel={`Remove ${title} from the plan`}
        testID={AgentUiIds.food.plan.entryRemove(entry.id)}
        onPress={onRemove}
      />
    </View>
  );
}

/** Add a meal to a specific day: saved recipe OR a freeform title. */
function PlanEntrySheet({
  visible,
  dateKey,
  recipes,
  onClose,
}: {
  visible: boolean;
  dateKey: string;
  recipes: readonly Recipe[];
  onClose: () => void;
}) {
  const { spacing, s } = useResponsive();
  const addEntry = useMealPlan((state) => state.addEntry);
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [recipeId, setRecipeId] = useState<string | undefined>();
  const [customTitle, setCustomTitle] = useState('');
  const [servings, setServings] = useState(2);

  useEffect(() => {
    if (!visible) return;
    setMealType('dinner');
    setRecipeId(undefined);
    setCustomTitle('');
    setServings(2);
  }, [visible, dateKey]);

  const selectedRecipe = recipeId
    ? recipes.find((item) => item.id === recipeId)
    : undefined;
  const canAdd = Boolean(selectedRecipe || customTitle.trim());

  const confirm = () => {
    addEntry({
      dateKey,
      mealType,
      recipeId: selectedRecipe?.id,
      freeformTitle: selectedRecipe ? undefined : customTitle.trim(),
      servings,
    });
    haptics.select();
    onClose();
  };

  return (
    <FoodSheet
      visible={visible}
      name="planEntry"
      title="Plan a Meal"
      subtitle={`${formatWeekday(dateKey)}, ${formatDateLong(dateKey)}`}
      subtitleIcon="meal-plan"
      onClose={onClose}
      doneLabel="Add to Plan"
      doneIcon="calendar-add"
      doneDisabled={!canAdd}
      onDone={confirm}
      contentContainerStyle={{ gap: spacing.lg }}>
      <SegmentedControl
        label="Meal"
        value={mealType}
        onChange={setMealType}
        options={FOOD_MEAL_TYPE_OPTIONS.map((option) => ({
          ...option,
          testID: AgentUiIds.food.plan.addMealType(option.value),
        }))}
      />

      {recipes.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="overline" color="tertiary" fit>
            From your recipes
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}>
            {recipes.map((recipe) => (
              <ActionChip
                key={recipe.id}
                label={recipe.title}
                selected={recipeId === recipe.id}
                testID={AgentUiIds.food.plan.addRecipe(recipe.id)}
                onPress={() =>
                  setRecipeId((current) =>
                    current === recipe.id ? undefined : recipe.id,
                  )
                }
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Input
        stackedLabel="Or Something Else"
        placeholder="Dinner with friends, leftovers…"
        value={customTitle}
        onChangeText={(value) => {
          setCustomTitle(value);
          if (value.trim()) setRecipeId(undefined);
        }}
        maxLength={80}
        testID={AgentUiIds.food.plan.addCustomTitle}
      />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" color="tertiary" fit>
          Servings
        </AppText>
        <View style={[styles.servingsRow, { gap: spacing.lg }]}>
          <IconButton
            icon="minus-circle"
            accessibilityLabel="Fewer servings"
            disabled={servings <= 1}
            testID={AgentUiIds.food.plan.addServingsMinus}
            onPress={() => setServings((value) => Math.max(1, value - 1))}
          />
          <AppText
            variant="heading"
            fit
            style={{ minWidth: s(44), textAlign: 'center' }}
            accessibilityLabel={`${servings} servings`}>
            {`${servings}`}
          </AppText>
          <IconButton
            icon="plus-circle"
            accessibilityLabel="More servings"
            disabled={servings >= MAX_SERVINGS}
            testID={AgentUiIds.food.plan.addServingsPlus}
            onPress={() => setServings((value) => Math.min(MAX_SERVINGS, value + 1))}
          />
        </View>
      </View>

      {selectedRecipe ? (
        <AppText variant="caption" color="secondary">
          {`Planning ${selectedRecipe.title} — the recipe makes ${selectedRecipe.servings}.`}
        </AppText>
      ) : null}
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCopy: {
    flex: 1,
    minWidth: 0,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
