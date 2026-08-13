import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ActionChip,
  AppText,
  Button,
  GlassPrimaryAction,
  IconButton,
  SegmentedControl,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { FoodSheet } from '@/features/food/food-sheet';
import {
  FOOD_MEAL_TYPE_OPTIONS,
  planDayRelativeLabel,
} from '@/services/food/labels';
import { useMealPlan } from '@/store/food-meal-plan';
import type { MealType, Recipe } from '@/types/food';
import { AgentUiIds } from '@/utils/agent-ui';
import { addDays, formatDateLong, formatWeekday, todayKey } from '@/utils/date';
import { formatCount } from '@/utils/grammar';
import { haptics } from '@/utils/haptics';

const PLAN_DAY_COUNT = 7;
const MAX_SERVINGS = 12;
const PROGRESS_MS = 220;

function planDayLabel(dateKey: string, offset: number): string {
  return planDayRelativeLabel(
    offset,
    () => `${formatWeekday(dateKey).slice(0, 3)} ${formatDateLong(dateKey)}`,
  );
}

/** Day + meal slot + servings → `useMealPlan.addEntry`. */
export function AddToPlanSheet({
  visible,
  recipe,
  onClose,
}: {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}) {
  const { spacing, s } = useResponsive();
  const addEntry = useMealPlan((state) => state.addEntry);
  const today = todayKey();
  const [dateKey, setDateKey] = useState(today);
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [servings, setServings] = useState(Math.max(1, recipe.servings));

  useEffect(() => {
    if (!visible) return;
    setDateKey(todayKey());
    setMealType('dinner');
    setServings(Math.max(1, recipe.servings));
  }, [visible, recipe.servings, recipe.id]);

  const confirm = () => {
    addEntry({ dateKey, mealType, recipeId: recipe.id, servings });
    haptics.select();
    onClose();
  };

  return (
    <FoodSheet
      visible={visible}
      name="addToPlan"
      title="Add to Meal Plan"
      subtitle={recipe.title}
      subtitleIcon="meal-plan"
      onClose={onClose}
      doneLabel="Add to Plan"
      doneIcon="calendar-add"
      onDone={confirm}
      contentContainerStyle={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" color="tertiary" fit>
          Day
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}>
          {Array.from({ length: PLAN_DAY_COUNT }, (_, offset) => {
            const key = addDays(today, offset);
            return (
              <ActionChip
                key={key}
                label={planDayLabel(key, offset)}
                selected={dateKey === key}
                testID={AgentUiIds.food.recipeDetail.planDay(key)}
                onPress={() => setDateKey(key)}
              />
            );
          })}
        </ScrollView>
      </View>

      <SegmentedControl
        label="Meal"
        value={mealType}
        onChange={(value) => setMealType(value)}
        options={FOOD_MEAL_TYPE_OPTIONS.map((option) => ({
          ...option,
          testID: AgentUiIds.food.recipeDetail.planMealType(option.value),
        }))}
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
            testID={AgentUiIds.food.recipeDetail.planServingsMinus}
            onPress={() => setServings((value) => Math.max(1, value - 1))}
          />
          <AppText
            variant="heading"
            fit
            style={{ minWidth: s(44), textAlign: 'center' }}
            accessibilityLabel={formatCount(servings, 'serving')}>
            {`${servings}`}
          </AppText>
          <IconButton
            icon="plus-circle"
            accessibilityLabel="More servings"
            disabled={servings >= MAX_SERVINGS}
            testID={AgentUiIds.food.recipeDetail.planServingsPlus}
            onPress={() => setServings((value) => Math.min(MAX_SERVINGS, value + 1))}
          />
        </View>
      </View>
    </FoodSheet>
  );
}

/** Step-by-step cook mode: one instruction at a time with eased progress. */
export function CookingSheet({
  visible,
  recipe,
  onClose,
}: {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const steps = recipe.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const progress = useSharedValue(0);
  const stepCount = Math.max(1, steps.length);
  const lastStep = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    progress.value = withTiming(1 / stepCount, { duration: PROGRESS_MS });
  }, [visible, stepCount, progress]);

  useEffect(() => {
    // Eased fill — discrete step changes still animate (smooth-transitions).
    progress.value = withTiming((stepIndex + 1) / stepCount, {
      duration: PROGRESS_MS,
    });
  }, [stepIndex, stepCount, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const advance = () => {
    if (lastStep) {
      haptics.select();
      onClose();
      return;
    }
    setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  };

  const step = steps[stepIndex];

  return (
    <FoodSheet
      visible={visible}
      name="cooking"
      eyebrow={`Step ${Math.min(stepIndex + 1, stepCount)} of ${stepCount}`}
      title={recipe.title}
      onClose={onClose}
      contentContainerStyle={{ gap: spacing.lg }}
      footer={
        <View style={[styles.cookFooter, { gap: spacing.sm }]}>
          <Button
            variant="ghost"
            icon="chevron-left"
            disabled={stepIndex === 0}
            accessibilityLabel="Previous step"
            testID={AgentUiIds.food.recipeDetail.cookPrev}
            onPress={() => setStepIndex((value) => Math.max(0, value - 1))}>
            Back
          </Button>
          <View style={styles.grow}>
            <GlassPrimaryAction
              label={lastStep ? 'Finish' : 'Next Step'}
              icon={lastStep ? 'check' : 'chevron-right'}
              onPress={advance}
              testID={AgentUiIds.food.sheet.done('cooking')}
            />
          </View>
        </View>
      }>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.progressTrack,
          {
            height: Math.max(4, s(5)),
            borderRadius: radii.pill,
            backgroundColor: theme.separator,
          },
        ]}>
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: theme.accentPrimary, borderRadius: radii.pill },
            fillStyle,
          ]}
        />
      </View>
      {step ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{step.instruction}</AppText>
          {step.durationMinutes ? (
            <AppText variant="callout" color="secondary">
              {`About ${step.durationMinutes} min`}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="callout" color="secondary">
          No steps written for this recipe yet.
        </AppText>
      )}
    </FoodSheet>
  );
}

/**
 * Share Recipe (BOTTOM_SHEETS.md): community post (hands off to the
 * Community composer) or a system share. Only the recipe's own title/link
 * leaves the app — profile data never rides along.
 */
export function ShareRecipeSheet({
  visible,
  recipe,
  onShareToCommunity,
  onShareExternal,
  onClose,
}: {
  visible: boolean;
  recipe: Recipe;
  onShareToCommunity: () => void;
  onShareExternal: () => void;
  onClose: () => void;
}) {
  const { spacing } = useResponsive();

  return (
    <FoodSheet
      visible={visible}
      name="shareRecipe"
      title="Share Recipe"
      subtitle={recipe.title}
      subtitleIcon="share"
      onClose={onClose}
      contentContainerStyle={{ gap: spacing.lg }}
      footer={
        <View style={{ gap: spacing.sm }}>
          <GlassPrimaryAction
            label="Share to Community"
            icon="send"
            onPress={onShareToCommunity}
            testID={AgentUiIds.food.sheet.done('shareRecipe')}
          />
          <Button
            variant="ghost"
            icon="share"
            accessibilityLabel="Share outside onTrack"
            testID={AgentUiIds.food.recipeDetail.shareExternal}
            onPress={onShareExternal}>
            Share Outside onTrack
          </Button>
        </View>
      }>
      <AppText variant="callout" color="secondary">
        Community posts show the recipe and your caption. Sharing outside
        onTrack sends only the recipe name and link — never your profile.
      </AppText>
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cookFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  progressTrack: {
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
