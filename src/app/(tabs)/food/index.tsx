import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, CollapsibleSection, IconButton, SectionHeader } from '@/components/primitives';
import {
  FoodHomeCommunity,
  FoodHomeLeftoverCard,
  FoodHomeNutrition,
  FoodHomePantryCard,
  FoodHomeTodayCard,
} from '@/features/food/food-home-cards';
import { FoodHomeHero } from '@/features/food/food-home-hero';
import { FoodHomeQuickActions } from '@/features/food/food-home-quick-actions';
import { FoodScreen } from '@/features/food/food-screen';
import { filterRecipesForSevereAllergies } from '@/services/food/safety';
import { useResponsive } from '@/hooks/use-responsive';
import {
  selectScheduledMealsForDate,
  sumScheduledMealNutrition,
} from '@/store/food-selectors';
import { selectExpiringSoon, usePantry } from '@/store/food-pantry';
import { useFoodProfile } from '@/store/food-profile';
import { useRecipes } from '@/store/food-recipes';
import { useFriends } from '@/store/friends';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import type { Recipe } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { useWarmHrefs } from '@/utils/warm-navigation';

const PANTRY_USE_SOON_DAYS = 3;

/** Time-of-day greeting; first name only when the user has set one. */
export function foodGreeting(hour: number, name: string): string {
  const base = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = name.trim().split(/\s+/)[0];
  return first && !/^you$/i.test(first) ? `${base}, ${first}` : base;
}

/** Favorites first, then quickest — the "what should I eat" shortlist. */
function rankSuggestions(recipes: readonly Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return (a.totalMinutes ?? Number.MAX_SAFE_INTEGER) - (b.totalMinutes ?? Number.MAX_SAFE_INTEGER);
  });
}

/** Food home — SCREENS.md §1: hero, today, quick actions, pantry, leftovers, nutrition, friends. */
export default function FoodHomeScreen() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const name = usePreferences((state) => state.name);
  const recipes = useRecipes((state) => state.recipes);
  const allergies = useFoodProfile((state) => state.profile.allergies);
  const pantryItems = usePantry((state) => state.items);
  const activities = useSchedule((state) => state.activities);
  const meals = useSchedule((state) => state.meals);
  const friends = useFriends((state) => state.friends);
  const friendsLoading = useFriends((state) => state.loading);

  const today = todayKey();
  useWarmHrefs([
    '/(tabs)/food/recipes',
    '/(tabs)/food/tracker',
    '/(tabs)/food/plan',
    '/(tabs)/food/scan',
  ]);
  const suggestions = useMemo(
    () => rankSuggestions(filterRecipesForSevereAllergies(recipes, allergies)),
    [recipes, allergies],
  );
  const useSoon = useMemo(
    () => selectExpiringSoon(pantryItems, PANTRY_USE_SOON_DAYS, today),
    [pantryItems, today],
  );
  const todayMeals = useMemo(
    () => selectScheduledMealsForDate({ activities, meals }, today),
    [activities, meals, today],
  );
  const totals = useMemo(() => sumScheduledMealNutrition(todayMeals), [todayMeals]);
  const friendPeople = useMemo(
    () =>
      friends.map((friend) => ({
        id: friend.userId,
        displayName: friend.displayName,
        userId: friend.userId,
        avatar: friend.avatar,
      })),
    [friends],
  );

  const openAiIdeas = () => router.push('/(tabs)/food/ai-ideas' as never);
  const addMeal = () =>
    router.push({ pathname: '/activity-form', params: { date: today, category: 'food' } });

  return (
    <FoodScreen contentStyle={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.headerRow, { gap: spacing.sm }]}>
          <AppText variant="overline" color="accent" fit style={styles.headerEyebrow}>
            Food
          </AppText>
          <View style={[styles.headerActions, { gap: spacing.xs }]}>
            <IconButton
              icon="search"
              accessibilityLabel="Search recipes"
              testID={AgentUiIds.food.home.search}
              onPress={() => router.push('/(tabs)/food/recipes' as never)}
            />
            <IconButton
              icon="settings"
              accessibilityLabel="Diet and preferences"
              testID={AgentUiIds.food.home.preferences}
              onPress={() => router.push('/(tabs)/food/preferences' as never)}
            />
          </View>
        </View>
        <AppText variant="title" fit>
          {foodGreeting(new Date().getHours(), name)}
        </AppText>
        <AppText variant="callout" color="secondary" numberOfLines={1}>
          What sounds good today?
        </AppText>
      </View>

      <AgentTestId
        testID={AgentUiIds.food.home.suggestionsSection}
        label="AI suggestions">
        <FoodHomeHero
          recipes={suggestions}
          onOpenRecipe={(recipeId) =>
            router.push(`/(tabs)/food/recipes/${recipeId}` as never)
          }
          onAskAi={openAiIdeas}
        />
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.food.home.todaySection}
        label="Today's meals"
        style={{ gap: spacing.sm }}>
        <SectionHeader
          flush
          title="Today's Meals"
          actionLabel="Add"
          actionTestID={AgentUiIds.food.home.todayAdd}
          onAction={addMeal}
        />
        <FoodHomeTodayCard
          meals={todayMeals}
          onOpenMeal={(activityId) => router.push(`/detail/food/${activityId}` as never)}
        />
      </AgentTestId>

      <CollapsibleSection
        title="More in Food"
        description="Recipes, pantry, leftovers, and friends."
        testID={AgentUiIds.food.home.more}
      >
        <View style={{ gap: spacing.xl }}>
          <FoodHomeQuickActions />

          <AgentTestId
            testID={AgentUiIds.food.home.pantrySection}
            label="Use soon"
            style={{ gap: spacing.sm }}>
            <SectionHeader flush title="Use Soon" />
            <FoodHomePantryCard
              items={useSoon}
              onScan={() => router.push('/(tabs)/food/scan' as never)}
            />
          </AgentTestId>

          <FoodHomeLeftoverCard onPress={openAiIdeas} />

          <AgentTestId
            testID={AgentUiIds.food.home.nutritionSection}
            label="Nutrition today"
            style={{ gap: spacing.sm }}>
            <SectionHeader flush title="Nutrition Today" />
            <FoodHomeNutrition totals={totals} />
          </AgentTestId>

          <AgentTestId
            testID={AgentUiIds.food.home.communitySection}
            label="Friends"
            style={{ gap: spacing.sm }}>
            <SectionHeader flush title="Friends" />
            <FoodHomeCommunity people={friendPeople} loading={friendsLoading} />
          </AgentTestId>
        </View>
      </CollapsibleSection>
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
