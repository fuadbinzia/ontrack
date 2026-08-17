import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
    ActionChip,
    AppText,
    EmptyState,
    FOOD_IMAGE_OVERLAY_INK,
    FOOD_IMAGE_OVERLAY_INK_SOFT,
    FoodImage,
    Input,
    ScreenHeader,
    SectionHeader,
} from "@/components/primitives";
import { RecipeCard } from "@/features/food/components";
import { FoodHeaderBackButton } from "@/features/food/food-header-back-button";
import { recipeImageSource } from "@/features/food/food-image-source";
import { FoodScreen } from "@/features/food/food-screen";
import {
    applyRecipeFilter,
    cuisineKey,
    RECIPE_FILTERS,
    recipeCuisines,
    recipeMetaCaption,
    searchRecipes,
    type RecipeFilterId,
} from "@/features/food/recipe-filters";
import { useResponsive } from "@/hooks/use-responsive";
import { filterRecipesForSevereAllergies } from "@/services/food/safety";
import { useFoodProfile } from "@/store/food-profile";
import { useRecipes } from "@/store/food-recipes";
import type { Recipe } from "@/types/food";
import { AgentTestId, AgentUiIds, useAgentUiTarget } from "@/utils/agent-ui";
import { haptics } from "@/utils/haptics";

/** Recipes browse — search, filter chips, featured hero, cuisine categories, cards. */
export default function FoodRecipesScreen() {
  const router = useRouter();
  const { spacing, widthClass } = useResponsive();
  const recipes = useRecipes((state) => state.recipes);
  const toggleFavorite = useRecipes((state) => state.toggleFavorite);
  const allergies = useFoodProfile((state) => state.profile.allergies);

  const [query, setQuery] = useState("");
  const [filterId, setFilterId] = useState<RecipeFilterId>("all");
  const [cuisine, setCuisine] = useState<string | null>(null);

  const safeRecipes = useMemo(
    () => filterRecipesForSevereAllergies(recipes, allergies),
    [recipes, allergies],
  );
  const hiddenCount = recipes.length - safeRecipes.length;
  const cuisines = useMemo(() => recipeCuisines(safeRecipes), [safeRecipes]);
  const filtered = useMemo(() => {
    const byFilter = applyRecipeFilter(safeRecipes, filterId);
    const byCuisine = cuisine
      ? byFilter.filter((recipe) => recipe.cuisine === cuisine)
      : byFilter;
    return searchRecipes(byCuisine, query);
  }, [safeRecipes, filterId, cuisine, query]);

  const featured = filtered.find((recipe) => recipe.isFavorite) ?? filtered[0];
  const rest = filtered.filter((recipe) => recipe.id !== featured?.id);
  const hasActiveNarrowing =
    filterId !== "all" || cuisine != null || query.trim() !== "";

  const openRecipe = (recipeId: string) =>
    router.push(`/(tabs)/food/recipes/${recipeId}` as never);
  const clearNarrowing = () => {
    setQuery("");
    setFilterId("all");
    setCuisine(null);
  };

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="Recipes"
        leading={<FoodHeaderBackButton />}
      />

      <Input
        icon="search"
        placeholder="Search recipes or ingredients"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        testID={AgentUiIds.food.recipes.search}
        accessibilityLabel="Search recipes"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {RECIPE_FILTERS.map((filter) => (
          <ActionChip
            key={filter.id}
            label={filter.label}
            icon={filter.icon}
            selected={filterId === filter.id}
            testID={AgentUiIds.food.recipes.filter(filter.id)}
            onPress={() => setFilterId(filter.id)}
          />
        ))}
      </ScrollView>

      <AgentTestId
        testID={AgentUiIds.food.recipes.listSection}
        label="Recipe list"
        style={{ gap: spacing.xl }}
      >
        {recipes.length === 0 ? (
          <EmptyState
            icon="recipe"
            title="Your Recipe Box Is Empty"
            message="Save your favorites or ask AI for ideas that fit your profile."
            actionLabel="Ask AI"
            actionTestID={AgentUiIds.food.recipes.emptyAction}
            onAction={() => router.push("/(tabs)/food/ai-ideas" as never)}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing Fits That Mix"
            message="Try a different search, or clear the filters."
            actionLabel={hasActiveNarrowing ? "Clear filters" : undefined}
            actionTestID={
              hasActiveNarrowing
                ? AgentUiIds.food.recipes.emptyAction
                : undefined
            }
            onAction={hasActiveNarrowing ? clearNarrowing : undefined}
          />
        ) : (
          <>
            {featured ? (
              <View style={{ gap: spacing.sm }}>
                <SectionHeader flush title="Featured" />
                <FeaturedRecipeHero
                  recipe={featured}
                  onPress={() => openRecipe(featured.id)}
                />
              </View>
            ) : null}

            {cuisines.length > 1 ? (
              <View style={{ gap: spacing.sm }}>
                <SectionHeader flush title="Categories" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.sm }}
                >
                  {cuisines.map((item) => (
                    <ActionChip
                      key={item}
                      label={item}
                      selected={cuisine === item}
                      testID={AgentUiIds.food.recipes.category(
                        cuisineKey(item),
                      )}
                      onPress={() => setCuisine(cuisine === item ? null : item)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {rest.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SectionHeader flush title="Popular" />
                {widthClass === "large" ? (
                  <View style={[styles.grid, { gap: spacing.md }]}>
                    {rest.map((recipe) => (
                      <View key={recipe.id} style={styles.gridCard}>
                        <RecipeCard
                          recipe={recipe}
                          layout="grid"
                          onPress={() => openRecipe(recipe.id)}
                          onToggleFavorite={() => toggleFavorite(recipe.id)}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {rest.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        layout="list"
                        onPress={() => openRecipe(recipe.id)}
                        onToggleFavorite={() => toggleFavorite(recipe.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </AgentTestId>

      {hiddenCount > 0 ? (
        <AppText variant="caption" color="tertiary">
          {`${hiddenCount} ${hiddenCount === 1 ? "recipe" : "recipes"} hidden — severe-allergy conflicts never appear in suggestions.`}
        </AppText>
      ) : null}
    </FoodScreen>
  );
}

function FeaturedRecipeHero({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
  const { spacing } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onPress();
  };
  const agent = useAgentUiTarget(AgentUiIds.food.recipes.featured, {
    label: recipe.title,
    onPress: handlePress,
  });
  const meta = recipeMetaCaption(recipe);

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${recipe.title}`}
      onPress={handlePress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
    >
      <FoodImage
        source={recipeImageSource(recipe)}
        aspectRatio={4 / 3}
        radius="xl"
        placeholderIcon="recipe"
        overlayGradient
      >
        <View
          pointerEvents="none"
          style={[styles.heroCopy, { padding: spacing.lg, gap: spacing.xxs }]}
        >
          <AppText
            variant="heading"
            numberOfLines={2}
            style={[styles.shrinkText, { color: FOOD_IMAGE_OVERLAY_INK }]}
          >
            {recipe.title}
          </AppText>
          {meta ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: FOOD_IMAGE_OVERLAY_INK_SOFT }}
            >
              {meta}
            </AppText>
          ) : null}
        </View>
      </FoodImage>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridCard: {
    flexGrow: 1,
    flexBasis: "46%",
    maxWidth: "48.5%",
  },
  heroCopy: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
