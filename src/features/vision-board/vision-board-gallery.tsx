import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
    ReduceMotion,
    SharedTransition,
} from 'react-native-reanimated';

import { AppText, EmptyState } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';

import { splitMasonryColumns } from './selectors';
import type { VisionBoardCategory, VisionBoardItem } from './types';
import { VisionBoardItemCard } from './vision-board-item-card';

const sharedTransition = SharedTransition.springify()
  .damping(18)
  .reduceMotion(ReduceMotion.System);

export function VisionBoardGallery({
  category,
  items,
}: {
  category: VisionBoardCategory;
  items: VisionBoardItem[];
}) {
  const { allowsSharedElement } = usePerformanceTier();
  if (items.length === 0) {
    return (
      <EmptyState
        icon="gallery"
        title="Your gallery is waiting"
        message="Switch back to Edit Board to add an image, affirmation, or goal."
      />
    );
  }

  const columns = splitMasonryColumns(items);
  return (
    <View>
      <View style={styles.heading}>
        <AppText variant="overline" color="tertiary">
          {category.name} gallery
        </AppText>
        <AppText variant="caption" color="secondary">
          Read-only view
        </AppText>
      </View>
      <View style={styles.columns}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={styles.column}>
            {column.map((item) => (
              <Animated.View
                key={item.id}
                {...(Platform.OS === 'web' || !allowsSharedElement
                  ? {}
                  : {
                      sharedTransitionTag: `vision-item-${item.id}`,
                      sharedTransitionStyle: sharedTransition,
                    })}
                style={[
                  styles.card,
                  item.kind === 'image'
                    ? { aspectRatio: Math.min(1.5, Math.max(0.68, item.aspectRatio)) }
                    : item.kind === 'affirmation'
                      ? styles.affirmation
                      : styles.goal,
                ]}>
                <VisionBoardItemCard item={item} category={category} gallery />
              </Animated.View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
  card: {
    overflow: 'hidden',
    minHeight: 150,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    boxShadow: '0 5px 18px rgba(40, 31, 22, 0.12)',
  },
  affirmation: { minHeight: 210 },
  goal: { minHeight: 180 },
});
