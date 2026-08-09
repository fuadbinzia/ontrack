import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  FOOD_IMAGE_OVERLAY_INK,
  FoodImage,
  GlassMetaChip,
  HeaderBackButton,
  IconButton,
  ScreenHeader,
  SegmentedControl,
  Symbol,
  fieldTitleCase,
} from '@/components/primitives';
import { recipeImageSource } from '@/features/food/food-image-source';
import { FoodScreen } from '@/features/food/food-screen';
import {
  RECIPE_DETAIL_SECTIONS,
  RecipeIngredients,
  RecipeNutritionPanel,
  RecipeOverview,
  RecipeSteps,
  type RecipeDetailSection,
} from '@/features/food/recipe-detail-sections';
import {
  AddToPlanSheet,
  CookingSheet,
  ShareRecipeSheet,
} from '@/features/food/recipe-detail-sheets';
import { recipeDifficulty, recipeTotalMinutes } from '@/features/food/recipe-filters';
import { buildRecipeShareMessage } from '@/services/food/community';
import { recipeAllergyConflicts } from '@/services/food/safety';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { selectRecipeById, useRecipes } from '@/store/food-recipes';
import { useFoodProfile } from '@/store/food-profile';
import { AgentUiIds } from '@/utils/agent-ui';

/** Recipe detail — hero, meta, tags, sectioned content, plan + cook sheets. */
export default function RecipeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const theme = useTheme();
  const { spacing, widthClass } = useResponsive();
  const recipes = useRecipes((state) => state.recipes);
  const toggleFavorite = useRecipes((state) => state.toggleFavorite);
  const allergies = useFoodProfile((state) => state.profile.allergies);

  const recipe = useMemo(() => selectRecipeById(recipes, recipeId), [recipes, recipeId]);
  const conflicts = useMemo(
    () => (recipe ? recipeAllergyConflicts(recipe, allergies) : []),
    [recipe, allergies],
  );

  const [section, setSection] = useState<RecipeDetailSection>('overview');
  const [planVisible, setPlanVisible] = useState(false);
  const [cookingVisible, setCookingVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  if (!recipe) {
    return (
      <FoodScreen>
        <ScreenHeader eyebrow="Food" title="Recipe" leading={<HeaderBackButton compact />} />
        <ErrorMessage
          message="This recipe is no longer available."
          style={{ marginTop: spacing.xl }}
        />
        <EmptyState
          icon="recipe"
          title="Recipe not found"
          message="It may have been removed. Browse your recipes instead."
          actionLabel="Browse Recipes"
          actionTestID={AgentUiIds.food.recipes.emptyAction}
          onAction={() => router.push('/(tabs)/food/recipes' as never)}
        />
      </FoodScreen>
    );
  }

  const minutes = recipeTotalMinutes(recipe);

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <View>
        <FoodImage
          source={recipeImageSource(recipe)}
          aspectRatio={4 / 3}
          radius="xl"
          placeholderIcon="recipe"
          accessibilityLabel={recipe.title}
          overlayGradient>
          <View pointerEvents="none" style={[styles.heroTitle, { padding: spacing.lg }]}>
            <AppText
              variant="title"
              numberOfLines={2}
              style={[styles.shrinkText, { color: FOOD_IMAGE_OVERLAY_INK }]}>
              {recipe.title}
            </AppText>
          </View>
        </FoodImage>
        <View style={[styles.heroControls, { top: spacing.md, left: spacing.md, right: spacing.md }]}>
          <IconButton
            icon="back"
            accessibilityLabel="Go back"
            testID={AgentUiIds.food.recipeDetail.back}
            onPress={() => router.back()}
          />
          <View style={[styles.heroControlsRight, { gap: spacing.sm }]}>
            <IconButton
              icon={recipe.isFavorite ? 'favorite-filled' : 'favorite'}
              color={recipe.isFavorite ? theme.danger : undefined}
              accessibilityLabel={
                recipe.isFavorite ? 'Remove from favorites' : 'Save to favorites'
              }
              testID={AgentUiIds.food.recipeDetail.favorite}
              onPress={() => toggleFavorite(recipe.id)}
            />
            <IconButton
              icon="share"
              accessibilityLabel="Share recipe"
              testID={AgentUiIds.food.recipeDetail.share}
              onPress={() => setShareVisible(true)}
            />
          </View>
        </View>
      </View>

      <View style={[styles.chipRow, { gap: spacing.sm }]}>
        {minutes ? (
          <MetaChip icon="clock" label={`${minutes} min`} />
        ) : null}
        <MetaChip icon="tip" label={recipeDifficulty(recipe)} />
        <MetaChip icon="people" label={`Serves ${recipe.servings}`} />
      </View>

      {recipe.dietaryTags.length > 0 ? (
        <View style={[styles.chipRow, { gap: spacing.sm }]}>
          {recipe.dietaryTags.map((tag) => (
            <GlassMetaChip key={tag} accessibilityLabel={tag}>
              <AppText variant="caption" color="secondary" fit>
                {fieldTitleCase(tag)}
              </AppText>
            </GlassMetaChip>
          ))}
        </View>
      ) : null}

      {conflicts.length > 0 ? (
        <Card style={[styles.conflictCard, { gap: spacing.md }]}>
          <Symbol name="warning" size="sm" color={theme.danger} />
          <AppText
            variant="callout"
            style={[styles.shrinkText, styles.grow, { color: theme.danger }]}>
            {`Matches your ${conflicts
              .map((entry) => `${entry.allergen.toLowerCase()} allergy (${entry.severity})`)
              .join(', ')} — check the ingredients below.`}
          </AppText>
        </Card>
      ) : null}

      {(() => {
        // Compact phones stack the two CTAs; wider phones share one row.
        const stacked = widthClass === 'compact';
        return (
          <View style={stacked ? { gap: spacing.sm } : [styles.actionRow, { gap: spacing.sm }]}>
            <Button
              icon="calendar-add"
              style={stacked ? undefined : styles.grow}
              testID={AgentUiIds.food.recipeDetail.addToPlan}
              accessibilityLabel="Add to meal plan"
              onPress={() => setPlanVisible(true)}>
              Add to Meal Plan
            </Button>
            <Button
              variant="secondary"
              icon="play"
              style={stacked ? undefined : styles.grow}
              testID={AgentUiIds.food.recipeDetail.startCooking}
              accessibilityLabel="Start cooking"
              onPress={() => setCookingVisible(true)}>
              Start Cooking
            </Button>
          </View>
        );
      })()}

      {/* Segments keep the hero + actions stable and each pane shallow —
          a long single scroll buries Steps under every ingredient row. */}
      <SegmentedControl
        value={section}
        onChange={setSection}
        options={RECIPE_DETAIL_SECTIONS.map((item) => ({
          ...item,
          testID: AgentUiIds.food.recipeDetail.section(item.value),
        }))}
      />

      {section === 'overview' ? <RecipeOverview recipe={recipe} /> : null}
      {section === 'ingredients' ? (
        <RecipeIngredients recipe={recipe} allergies={allergies} />
      ) : null}
      {section === 'steps' ? <RecipeSteps recipe={recipe} /> : null}
      {section === 'nutrition' ? <RecipeNutritionPanel recipe={recipe} /> : null}

      <AddToPlanSheet
        visible={planVisible}
        recipe={recipe}
        onClose={() => setPlanVisible(false)}
      />
      <CookingSheet
        visible={cookingVisible}
        recipe={recipe}
        onClose={() => setCookingVisible(false)}
      />
      <ShareRecipeSheet
        visible={shareVisible}
        recipe={recipe}
        onShareToCommunity={() => {
          setShareVisible(false);
          router.push(`/(tabs)/food/community?compose=${recipe.id}` as never);
        }}
        onShareExternal={() => {
          setShareVisible(false);
          void Share.share({ message: buildRecipeShareMessage(recipe) });
        }}
        onClose={() => setShareVisible(false)}
      />
    </FoodScreen>
  );
}

function MetaChip({ icon, label }: { icon: 'clock' | 'tip' | 'people'; label: string }) {
  const theme = useTheme();
  return (
    <GlassMetaChip accessibilityLabel={label}>
      <Symbol name={icon} size="sm" color={theme.textSecondary} />
      <AppText variant="caption" color="secondary" fit>
        {label}
      </AppText>
    </GlassMetaChip>
  );
}

const styles = StyleSheet.create({
  heroTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroControls: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
