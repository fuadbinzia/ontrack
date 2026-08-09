import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Card, FoodImage, IconButton } from '@/components/primitives';
import { recipeImageSource } from '@/features/food/food-image-source';
import { recipeMetaCaption } from '@/features/food/recipe-filters';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { Recipe } from '@/types/food';
import { AgentUiIds } from '@/utils/agent-ui';

export type RecipeCardLayout = 'list' | 'grid';

export interface RecipeCardProps {
  recipe: Recipe;
  layout: RecipeCardLayout;
  onPress: () => void;
  /** Renders the favorite heart (44pt hit target) when provided. */
  onToggleFavorite?: () => void;
  testID?: string;
  favoriteTestID?: string;
  style?: StyleProp<ViewStyle>;
}

function FavoriteButton({
  recipe,
  onToggleFavorite,
  testID,
  size,
}: {
  recipe: Recipe;
  onToggleFavorite: () => void;
  testID: string;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <IconButton
      icon={recipe.isFavorite ? 'favorite-filled' : 'favorite'}
      color={recipe.isFavorite ? theme.danger : theme.textSecondary}
      size={size}
      onPress={onToggleFavorite}
      accessibilityLabel={
        recipe.isFavorite ? 'Remove from favorites' : 'Save to favorites'
      }
      testID={testID}
    />
  );
}

/**
 * Recipe surface in two forms:
 * - `list`: min-92 row — square image, two-line title, meta caption, heart.
 * - `grid`: 4:3 image on top of the card, padded text area below.
 */
export function RecipeCard({
  recipe,
  layout,
  onPress,
  onToggleFavorite,
  testID,
  favoriteTestID,
  style,
}: RecipeCardProps) {
  const { spacing, s } = useResponsive();
  const cardTestID = testID ?? AgentUiIds.food.recipes.card(recipe.id);
  const heartTestID =
    favoriteTestID ?? AgentUiIds.food.recipes.favorite(recipe.id);
  const source = recipeImageSource(recipe);
  const meta = recipeMetaCaption(recipe);

  if (layout === 'grid') {
    return (
      <Card
        padded={false}
        onPress={onPress}
        accessibilityLabel={recipe.title}
        testID={cardTestID}
        style={style}>
        <FoodImage
          source={source}
          aspectRatio={4 / 3}
          radius="lg"
          placeholderIcon="recipe"
          accessibilityLabel={recipe.title}
          style={styles.gridImage}
        />
        <View
          style={[
            styles.gridBody,
            { padding: spacing.md, gap: spacing.xs },
          ]}>
          <View style={[styles.titleRow, { gap: spacing.sm }]}>
            <AppText
              variant="subheading"
              numberOfLines={2}
              style={styles.shrinkText}>
              {recipe.title}
            </AppText>
            {onToggleFavorite ? (
              <FavoriteButton
                recipe={recipe}
                onToggleFavorite={onToggleFavorite}
                testID={heartTestID}
                size={Math.max(36, s(36))}
              />
            ) : null}
          </View>
          {meta ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </Card>
    );
  }

  // Spec: image 72–80 square regardless of window scale.
  const imageSize = Math.max(72, Math.min(80, s(76)));

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={recipe.title}
      testID={cardTestID}
      style={style}>
      <View
        style={[
          styles.listRow,
          { minHeight: s(92), padding: spacing.sm, gap: spacing.md },
        ]}>
        <FoodImage
          source={source}
          aspectRatio={1}
          radius="md"
          placeholderIcon="recipe"
          accessibilityLabel={recipe.title}
          style={{ width: imageSize, height: imageSize }}
        />
        <View style={[styles.listBody, { gap: spacing.xxs }]}>
          <AppText variant="subheading" numberOfLines={2}>
            {recipe.title}
          </AppText>
          {meta ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {meta}
            </AppText>
          ) : null}
        </View>
        {onToggleFavorite ? (
          <FavoriteButton
            recipe={recipe}
            onToggleFavorite={onToggleFavorite}
            testID={heartTestID}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listBody: {
    flex: 1,
    minWidth: 0,
  },
  gridImage: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  gridBody: {
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
