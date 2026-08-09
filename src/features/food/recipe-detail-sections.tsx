import { StyleSheet, View } from 'react-native';

import { AppText, Card, GlassIconWell, Symbol } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { NutritionStat } from '@/features/food/components';
import { ingredientAllergyConflict } from '@/services/food/safety';
import type { AllergyEntry, Recipe, RecipeIngredient } from '@/types/food';

export type RecipeDetailSection = 'overview' | 'ingredients' | 'steps' | 'nutrition';

export const RECIPE_DETAIL_SECTIONS: readonly {
  value: RecipeDetailSection;
  label: string;
}[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'steps', label: 'Steps' },
  { value: 'nutrition', label: 'Nutrition' },
];

const SOURCE_KIND_LABEL: Record<NonNullable<Recipe['source']>['kind'], string> = {
  user: 'Your recipe',
  ai: 'AI recipe idea',
  import: 'Imported',
  community: 'From the community',
};

/** Summary, cuisine, and provenance. */
export function RecipeOverview({ recipe }: { recipe: Recipe }) {
  const { spacing } = useResponsive();
  const sourceLabel = recipe.source
    ? [SOURCE_KIND_LABEL[recipe.source.kind], recipe.source.attribution ?? recipe.source.title]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <View style={{ gap: spacing.md }}>
      {recipe.summary ? <AppText variant="body">{recipe.summary}</AppText> : null}
      {recipe.cuisine ? (
        <AppText variant="callout" color="secondary">
          {`${recipe.cuisine} cuisine`}
        </AppText>
      ) : null}
      {sourceLabel ? (
        <AppText variant="caption" color="tertiary">
          {sourceLabel}
        </AppText>
      ) : null}
      {!recipe.summary && !recipe.cuisine && !sourceLabel ? (
        <AppText variant="callout" color="secondary">
          No notes for this recipe yet.
        </AppText>
      ) : null}
    </View>
  );
}

function ingredientQuantity(ingredient: RecipeIngredient): string {
  if (ingredient.quantityText) return ingredient.quantityText;
  if (ingredient.quantityValue == null) return '';
  return [String(ingredient.quantityValue), ingredient.unit].filter(Boolean).join(' ');
}

function IngredientRow({
  ingredient,
  conflict,
}: {
  ingredient: RecipeIngredient;
  conflict: AllergyEntry | undefined;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const quantity = ingredientQuantity(ingredient);
  const detail = [
    ingredient.preparation,
    ingredient.optional ? 'optional' : undefined,
    ingredient.substitutes?.length ? `swap: ${ingredient.substitutes.join(', ')}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const a11y = [
    quantity,
    ingredient.name,
    detail,
    conflict ? `matches your ${conflict.allergen} allergy, ${conflict.severity}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[styles.ingredientRow, { gap: spacing.md, paddingVertical: spacing.xs }]}>
      <AppText variant="caption" color="secondary" style={{ minWidth: s(64) }} numberOfLines={1}>
        {quantity || '—'}
      </AppText>
      <View style={[styles.grow, { gap: spacing.xxs }]}>
        <AppText variant="body" numberOfLines={2} style={styles.shrinkText}>
          {ingredient.name}
        </AppText>
        {detail ? (
          <AppText variant="caption" color="tertiary" numberOfLines={2}>
            {detail}
          </AppText>
        ) : null}
        {conflict ? (
          // Never color-only: warning glyph + explicit allergy text.
          <View style={[styles.conflictRow, { gap: spacing.xs }]}>
            <Symbol name="warning" size="sm" color={theme.danger} />
            <AppText
              variant="caption"
              style={[styles.shrinkText, { color: theme.danger }]}>
              {`${conflict.allergen} allergy — ${conflict.severity}`}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Ingredient list with per-row allergy conflict markers. */
export function RecipeIngredients({
  recipe,
  allergies,
}: {
  recipe: Recipe;
  allergies: readonly AllergyEntry[];
}) {
  const { spacing } = useResponsive();

  if (recipe.ingredients.length === 0) {
    return (
      <AppText variant="callout" color="secondary">
        No ingredients listed for this recipe.
      </AppText>
    );
  }

  return (
    <Card style={{ gap: spacing.xs }}>
      <AppText variant="caption" color="tertiary">
        {`For ${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`}
      </AppText>
      {recipe.ingredients.map((ingredient, index) => (
        <IngredientRow
          key={`${ingredient.name}-${index}`}
          ingredient={ingredient}
          conflict={ingredientAllergyConflict(ingredient, allergies)}
        />
      ))}
    </Card>
  );
}

/** Numbered instruction rows with optional per-step timing. */
export function RecipeSteps({ recipe }: { recipe: Recipe }) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();

  if (recipe.steps.length === 0) {
    return (
      <AppText variant="callout" color="secondary">
        No steps written for this recipe yet.
      </AppText>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {recipe.steps.map((step, index) => (
        <View key={step.index} style={[styles.stepRow, { gap: spacing.md }]}>
          <GlassIconWell size={Math.max(32, s(34))}>
            <AppText variant="callout" color="accent" fit>
              {`${index + 1}`}
            </AppText>
          </GlassIconWell>
          <View style={[styles.grow, { gap: spacing.xxs }]}>
            <AppText variant="body" style={styles.shrinkText}>
              {step.instruction}
            </AppText>
            {step.durationMinutes ? (
              <View style={[styles.conflictRow, { gap: spacing.xs }]}>
                <Symbol name="clock" size="sm" color={theme.textTertiary} />
                <AppText variant="caption" color="tertiary">
                  {`About ${step.durationMinutes} min`}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Per-serving macro tiles. */
export function RecipeNutritionPanel({ recipe }: { recipe: Recipe }) {
  const { spacing } = useResponsive();
  const nutrition = recipe.nutrition;

  if (!nutrition || nutrition.calories == null) {
    return (
      <AppText variant="callout" color="secondary">
        No nutrition details for this recipe yet.
      </AppText>
    );
  }

  const tiles: { value: string; label: string }[] = [
    { value: `${Math.round(nutrition.calories)}`, label: 'Calories' },
    ...(nutrition.proteinG != null
      ? [{ value: `${Math.round(nutrition.proteinG)}g`, label: 'Protein' }]
      : []),
    ...(nutrition.carbsG != null
      ? [{ value: `${Math.round(nutrition.carbsG)}g`, label: 'Carbs' }]
      : []),
    ...(nutrition.fatG != null
      ? [{ value: `${Math.round(nutrition.fatG)}g`, label: 'Fat' }]
      : []),
    ...(nutrition.fiberG != null
      ? [{ value: `${Math.round(nutrition.fiberG)}g`, label: 'Fiber' }]
      : []),
    ...(nutrition.sodiumMg != null
      ? [{ value: `${Math.round(nutrition.sodiumMg)}mg`, label: 'Sodium' }]
      : []),
  ];

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" color="tertiary">
        Per serving
      </AppText>
      <View style={[styles.nutritionGrid, { gap: spacing.sm }]}>
        {tiles.map((tile) => (
          <NutritionStat
            key={tile.label}
            value={tile.value}
            label={tile.label}
            style={styles.nutritionTile}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Icon-well rows stay vertically centered (field-icon-centering rule).
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conflictRow: {
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
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nutritionTile: {
    flexGrow: 1,
    flexBasis: '30%',
  },
});
