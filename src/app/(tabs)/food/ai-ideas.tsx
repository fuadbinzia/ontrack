import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  ErrorMessage,
  GlassPlate,
  GlassPrimaryAction,
  Input,
  LoadingBlock,
  ScreenHeader,
  SectionHeader,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { RecipeIdeaCard } from '@/features/food/components';
import { buildFoodFixtureRecipeIdeas } from '@/features/food/fixtures';
import { FoodHeaderBackButton } from '@/features/food/food-header-back-button';
import { FoodScreen } from '@/features/food/food-screen';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  requestRecipeIdeas,
  shouldFallBackToFixtures,
} from '@/services/food/client';
import { FOOD_MEAL_TYPE_OPTIONS } from '@/services/food/labels';
import {
  exclusionSummary,
  filterUnsafeRecipeIdeas,
  profileHasSafetySignals,
} from '@/services/food/safety';
import type {
  RecipeIdeaSuggestion,
  RecipeIdeaTimeframe,
} from '@/services/food/types';
import { usePantry } from '@/store/food-pantry';
import { useFoodProfile } from '@/store/food-profile';
import { useRecipes } from '@/store/food-recipes';
import type { MealType } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

const MEAL_TYPES = FOOD_MEAL_TYPE_OPTIONS.map((option) => ({
  id: option.value,
  label: option.label,
}));

const TIMEFRAMES: readonly { id: RecipeIdeaTimeframe; label: string }[] = [
  { id: 'quick', label: 'Quick (<25 min)' },
  { id: 'standard', label: 'Weeknight' },
  { id: 'relaxed', label: 'No rush' },
];

const MAX_INGREDIENT_CHIPS = 10;

type Phase = 'idle' | 'loading' | 'results' | 'error';

/** AI recipe ideas — profile exclusions always visible and always applied. */
export default function FoodAiIdeasScreen() {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);
  const pantryItems = usePantry((state) => state.items);
  const recipes = useRecipes((state) => state.recipes);
  const saveGeneratedRecipe = useRecipes((state) => state.saveGeneratedRecipe);

  const [ingredientsText, setIngredientsText] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [mealType, setMealType] = useState<MealType | undefined>();
  const [timeframe, setTimeframe] = useState<RecipeIdeaTimeframe | undefined>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [suggestions, setSuggestions] = useState<RecipeIdeaSuggestion[]>([]);
  const [offlineSample, setOfflineSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Pantry first, then recent recipe ingredients to fill the row.
  const ingredientChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: { key: string; label: string }[] = [];
    const push = (key: string, label: string) => {
      if (!key || seen.has(key) || chips.length >= MAX_INGREDIENT_CHIPS) return;
      seen.add(key);
      chips.push({ key, label });
    };
    for (const item of pantryItems) push(item.canonicalKey, item.displayLabel);
    const recent = [...recipes].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    for (const recipe of recent) {
      for (const ingredient of recipe.ingredients) {
        push(
          ingredient.canonicalKey ??
            ingredient.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          ingredient.name,
        );
      }
    }
    return chips;
  }, [pantryItems, recipes]);

  const summary = exclusionSummary(profile);
  const profileIncomplete = !profileHasSafetySignals(profile);
  const hasInput = ingredientsText.trim().length > 0 || selectedChips.length > 0;

  const toggleChip = (key: string) =>
    setSelectedChips((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const generate = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('loading');
    setOfflineSample(false);
    try {
      const response = await requestRecipeIdeas(
        {
          ingredientsText: ingredientsText.trim(),
          pantryIngredients: ingredientChips
            .filter((chip) => selectedChips.includes(chip.key))
            .map((chip) => chip.label),
          mealType,
          timeframe,
        },
        profile,
        controller.signal,
      );
      setSuggestions(response.suggestions);
      setPhase('results');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (shouldFallBackToFixtures(error)) {
        // Deterministic offline fallback — still hard-filtered for safety.
        setSuggestions(
          filterUnsafeRecipeIdeas(buildFoodFixtureRecipeIdeas(), profile.allergies),
        );
        setOfflineSample(true);
        setPhase('results');
        return;
      }
      setErrorMessage(
        error instanceof Error ? error.message : 'Recipe ideas are unavailable right now.',
      );
      setPhase('error');
    }
  };

  const saveSuggestion = (suggestion: RecipeIdeaSuggestion) => {
    if (savedIds[suggestion.id]) return;
    const recipeId = saveGeneratedRecipe({
      title: suggestion.title,
      summary: suggestion.whyItFits,
      servings: suggestion.servings,
      totalMinutes: suggestion.totalMinutes,
      ingredients: suggestion.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantityText: ingredient.quantityText,
      })),
      steps: suggestion.steps.map((instruction, index) => ({ index, instruction })),
      dietaryTags: [],
      allergenTags: [],
    });
    setSavedIds((current) => ({ ...current, [suggestion.id]: recipeId }));
  };

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="AI Recipe Ideas"
        leading={<FoodHeaderBackButton />}
      />

      <Input
        icon="ai-chef"
        multiline
        placeholder="What ingredients do you have?"
        value={ingredientsText}
        onChangeText={setIngredientsText}
        style={{ minHeight: s(72) }}
        testID={AgentUiIds.food.aiIdeas.input}
        accessibilityLabel="Ingredients you have"
      />

      {ingredientChips.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader flush title="From your pantry" />
          <View style={[styles.chipRow, { gap: spacing.sm }]}>
            {ingredientChips.map((chip) => (
              <ActionChip
                key={chip.key}
                label={chip.label}
                selected={selectedChips.includes(chip.key)}
                testID={AgentUiIds.food.aiIdeas.chip(chip.key)}
                onPress={() => toggleChip(chip.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.chipRow, { gap: spacing.sm }]}>
        {MEAL_TYPES.map((entry) => (
          <ActionChip
            key={entry.id}
            label={entry.label}
            selected={mealType === entry.id}
            testID={AgentUiIds.food.aiIdeas.mealType(entry.id)}
            onPress={() =>
              setMealType((current) => (current === entry.id ? undefined : entry.id))
            }
          />
        ))}
      </View>
      <View style={[styles.chipRow, { gap: spacing.sm }]}>
        {TIMEFRAMES.map((entry) => (
          <ActionChip
            key={entry.id}
            label={entry.label}
            icon="timer"
            selected={timeframe === entry.id}
            testID={AgentUiIds.food.aiIdeas.timeframe(entry.id)}
            onPress={() =>
              setTimeframe((current) => (current === entry.id ? undefined : entry.id))
            }
          />
        ))}
      </View>

      <GlassPrimaryAction
        label="Generate ideas"
        icon="ai-chef"
        onPress={generate}
        disabled={!hasInput || phase === 'loading'}
        testID={AgentUiIds.food.aiIdeas.generate}
      />

      <AgentTestId
        testID={AgentUiIds.food.aiIdeas.exclusionsSection}
        label="Active exclusions">
        <GlassPlate
          mist
          style={[
            styles.exclusionsPlate,
            {
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}>
          <Symbol
            name="shield"
            size="sm"
            color={profileIncomplete ? theme.warning : theme.success}
          />
          <AppText
            variant="caption"
            color="secondary"
            style={styles.shrinkText}>
            {summary
              ? `Avoiding: ${summary}`
              : 'No dietary or allergy profile yet — ideas cannot be checked for safety.'}
          </AppText>
        </GlassPlate>
      </AgentTestId>

      {phase === 'loading' ? (
        <LoadingBlock label="Thinking through your kitchen…" />
      ) : null}

      {phase === 'error' ? (
        <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
          <ErrorMessage message={errorMessage} />
          <ActionChip
            label="Try again"
            icon="undo"
            testID={AgentUiIds.food.aiIdeas.retry}
            onPress={generate}
          />
        </View>
      ) : null}

      {phase === 'results' ? (
        <AgentTestId
          testID={AgentUiIds.food.aiIdeas.resultsSection}
          label="Recipe ideas"
          style={{ gap: spacing.sm }}>
          <SectionHeader
            flush
            title={offlineSample ? 'Sample ideas (offline)' : 'Ideas for you'}
          />
          {offlineSample ? (
            <AppText variant="caption" color="tertiary">
              The AI service is unreachable — these are deterministic sample ideas
              built from your pantry.
            </AppText>
          ) : null}
          {profileIncomplete ? (
            <AppText variant="caption" color="tertiary">
              Your profile has no allergies or preferences saved, so these ideas
              are not checked against personal restrictions.
            </AppText>
          ) : null}
          {suggestions.length === 0 ? (
            <AppText variant="callout" color="secondary">
              No ideas cleared your safety filters. Try different ingredients.
            </AppText>
          ) : (
            suggestions.map((suggestion) => (
              <RecipeIdeaCard
                key={suggestion.id}
                suggestion={suggestion}
                saved={Boolean(savedIds[suggestion.id])}
                onSave={() => saveSuggestion(suggestion)}
              />
            ))
          )}
        </AgentTestId>
      ) : null}

      {phase === 'idle' ? (
        <AppText variant="caption" color="tertiary" align="center">
          Type what you have, tap pantry items to include them, then generate.
        </AppText>
      ) : null}
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exclusionsPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
