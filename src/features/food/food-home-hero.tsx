import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  EmptyState,
  FOOD_IMAGE_OVERLAY_INK,
  FOOD_IMAGE_OVERLAY_INK_SOFT,
  FoodImage,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { Recipe } from '@/types/food';
import { recipeMetaCaption } from '@/features/food/recipe-filters';
import { recipeImageSource } from '@/features/food/food-image-source';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

const MAX_PAGES = 5;
const SETTLE_MS = 220;

type FoodHomeHeroProps = {
  /** Safety-filtered suggestions (severe allergens already excluded). */
  recipes: readonly Recipe[];
  onOpenRecipe: (recipeId: string) => void;
  onAskAi: () => void;
};

/**
 * AI suggestion hero: paged 4:3 photo cards with scrim-backed titles and
 * scroll-driven progress ticks (continuous, per smooth-transitions).
 */
export function FoodHomeHero({ recipes, onOpenRecipe, onAskAi }: FoodHomeHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { gutter, spacing } = useResponsive();
  const pages = recipes.slice(0, MAX_PAGES);
  const pageWidth = Math.max(1, windowWidth - insets.left - insets.right - gutter * 2);
  const [index, setIndex] = useState(0);
  const scrollProgress = useSharedValue(0);

  useEffect(() => {
    // Suggestion set changed (profile/recipes edits): snap state, ease ticks.
    setIndex(0);
    scrollProgress.value = withTiming(0, { duration: SETTLE_MS });
  }, [pages.length, scrollProgress]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (pageWidth <= 0) return;
      scrollProgress.value = event.contentOffset.x / pageWidth;
    },
  });

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.max(0, Math.min(pages.length - 1, next)));
  };

  if (pages.length === 0) {
    return (
      <EmptyState
        icon="ai-chef"
        title="Nothing on the menu yet"
        message="Save a recipe or ask AI for ideas that fit your profile."
        actionLabel="Ask AI"
        actionTestID={AgentUiIds.food.home.suggestionsAskAi}
        onAction={onAskAi}
      />
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        accessibilityRole="adjustable"
        accessibilityLabel="AI recipe suggestions"
        accessibilityValue={{
          min: 1,
          max: pages.length,
          now: index + 1,
          text: `Suggestion ${index + 1} of ${pages.length}`,
        }}
        style={{ width: pageWidth }}>
        {pages.map((recipe, pageIndex) => (
          <HeroPage
            key={recipe.id}
            recipe={recipe}
            width={pageWidth}
            position={`${pageIndex + 1} of ${pages.length}`}
            onPress={() => onOpenRecipe(recipe.id)}
          />
        ))}
      </Animated.ScrollView>
      {pages.length > 1 ? (
        <HeroTicks count={pages.length} progress={scrollProgress} />
      ) : null}
    </View>
  );
}

function HeroPage({
  recipe,
  width,
  position,
  onPress,
}: {
  recipe: Recipe;
  width: number;
  position: string;
  onPress: () => void;
}) {
  const { spacing } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onPress();
  };
  const agent = useAgentUiTarget(AgentUiIds.food.home.heroCard(recipe.id), {
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
      accessibilityLabel={`${recipe.title}, suggestion ${position}`}
      onPress={handlePress}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.9 : 1 }]}>
      <FoodImage
        source={recipeImageSource(recipe)}
        aspectRatio={4 / 3}
        radius="xl"
        placeholderIcon="recipe"
        overlayGradient>
        <View
          pointerEvents="none"
          style={[styles.overlayCopy, { padding: spacing.lg, gap: spacing.xxs }]}>
          <AppText
            variant="overline"
            fit
            style={{ color: FOOD_IMAGE_OVERLAY_INK_SOFT }}>
            AI pick
          </AppText>
          <AppText
            variant="heading"
            numberOfLines={2}
            style={[styles.shrinkText, { color: FOOD_IMAGE_OVERLAY_INK }]}>
            {recipe.title}
          </AppText>
          {meta ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: FOOD_IMAGE_OVERLAY_INK_SOFT }}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </FoodImage>
    </Pressable>
  );
}

/** Theme-inked progress ticks below the hero — track gesture, ease jumps. */
function HeroTicks({
  count,
  progress,
}: {
  count: number;
  progress: SharedValue<number>;
}) {
  const { s } = useResponsive();
  const tickWidth = Math.max(9, s(10));
  const tickHeight = Math.max(2, s(2.5));
  const gap = Math.max(4, s(4.5));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ticksRow, { gap }]}>
      {Array.from({ length: count }, (_, slot) => (
        <HeroTick
          key={slot}
          index={slot}
          progress={progress}
          width={tickWidth}
          height={tickHeight}
        />
      ))}
    </View>
  );
}

function HeroTick({
  index,
  progress,
  width,
  height,
}: {
  index: number;
  progress: SharedValue<number>;
  width: number;
  height: number;
}) {
  const theme = useTheme();
  const activeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Static separator fill under an animated accent fill so ticks render
  // before the first scroll event.
  return (
    <View
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: theme.separator,
        overflow: 'hidden',
      }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.accentPrimary, borderRadius: height / 2 },
          activeStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlayCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
  ticksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
