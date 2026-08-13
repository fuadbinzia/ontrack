import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, Card, IconButton } from '@/components/primitives';
import { borders, categoryColors, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityCategory } from '@/types/models';
import { activityTimingLabel } from '@/utils/activity-time';
import { haptics } from '@/utils/haptics';
import { CategoryIcon } from './category-badge';

interface ActivityCardProps {
  activity: Activity;
  category: ActivityCategory;
  /** Whether this is the activity happening right now */
  isCurrent?: boolean;
  onPress: () => void;
  onToggleComplete: () => void;
  onLongPress?: () => void;
  index?: number;
  testID?: string;
  toggleTestID?: string;
}

export function ActivityCard({
  activity,
  category,
  isCurrent,
  onPress,
  onToggleComplete,
  onLongPress,
  index = 0,
  testID,
  toggleTestID,
}: ActivityCardProps) {
  const theme = useTheme();
  const colors = categoryColors(theme, category.colorKey);
  const completed = activity.status === 'completed';
  const skipped = activity.status === 'skipped';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)}>
      <Card
        onPress={onPress}
        onLongPress={onLongPress}
        padded={false}
        testID={testID}
        accessibilityLabel={`${activity.title}, ${activityTimingLabel(activity)}, ${activity.status}`}
        style={{
          ...styles.card,
          ...(isCurrent
            ? { borderColor: theme.accentPrimary, borderWidth: borders.thin }
            : null),
          opacity: skipped ? 0.55 : 1,
        }}>
        <View style={styles.row}>
          <CategoryIcon category={category} />
          <View style={styles.body}>
            <AppText
              variant="bodyMedium"
              style={skipped ? styles.strike : undefined}
              numberOfLines={1}>
              {activity.title}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {activityTimingLabel(activity)}
              {activity.summary ? ` · ${activity.summary}` : ''}
            </AppText>
            {isCurrent ? (
              <AppText variant="caption" color="accent">
                Happening now
              </AppText>
            ) : null}
          </View>
          {activity.photo ? (
            <Image
              source={activity.photo}
              cachePolicy="memory-disk"
              style={styles.thumb}
              contentFit={activity.photoProcessingVersion ? 'contain' : 'cover'}
              transition={160}
            />
          ) : null}
          <IconButton
            icon={completed ? 'status-completed' : skipped ? 'status-skipped' : 'status-upcoming'}
            color={completed ? colors.main : skipped ? theme.warning : theme.textTertiary}
            background="transparent"
            testID={toggleTestID}
            accessibilityLabel={
              completed ? 'Mark Incomplete' : skipped ? 'Unskip Activity' : 'Mark Complete'
            }
            onPress={() => {
              if (!completed && !skipped) haptics.success();
              onToggleComplete();
            }}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
});
