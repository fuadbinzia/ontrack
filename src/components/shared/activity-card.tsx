import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, Card, GlassIconWell, IconButton } from '@/components/primitives';
import { borders, categoryColors, listEntering, listExiting, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityCategory } from '@/types/models';
import { activityTimingLabel } from '@/utils/activity-time';
import { haptics } from '@/utils/haptics';
import { CategoryIcon } from './category-badge';

type ActivityArtwork = {
  uri: string;
  contentFit: 'contain' | 'cover';
  accessibilityLabel: string;
};

function ActivityLeadingArtwork({
  artwork,
  category,
}: {
  artwork?: ActivityArtwork;
  category: ActivityCategory;
}) {
  const { s } = useResponsive();
  const [failedUri, setFailedUri] = useState<string>();

  useEffect(() => {
    setFailedUri(undefined);
  }, [artwork?.uri]);

  if (!artwork || artwork.uri === failedUri) return <CategoryIcon category={category} />;
  return (
    <GlassIconWell size={s(44)} borderRadius={s(14)}>
      <Image
        accessibilityLabel={artwork.accessibilityLabel}
        source={artwork.uri}
        cachePolicy="memory-disk"
        style={artwork.contentFit === 'contain' ? styles.logo : styles.artwork}
        contentFit={artwork.contentFit}
        transition={160}
        onError={() => setFailedUri(artwork.uri)}
      />
    </GlassIconWell>
  );
}

interface ActivityCardProps {
  activity: Activity;
  category: ActivityCategory;
  /** Whether this is the activity happening right now */
  isCurrent?: boolean;
  onPress: () => void;
  onToggleComplete: () => void;
  onLongPress?: () => void;
  index?: number;
  /** True only for a just-added row — page open stays at rest. */
  enter?: boolean;
  testID?: string;
  toggleTestID?: string;
  /** Logo-first identity artwork; falls back to the category glyph if unavailable. */
  leadingArtwork?: ActivityArtwork;
}

export function ActivityCard({
  activity,
  category,
  isCurrent,
  onPress,
  onToggleComplete,
  onLongPress,
  index = 0,
  enter = false,
  testID,
  toggleTestID,
  leadingArtwork,
}: ActivityCardProps) {
  const theme = useTheme();
  const colors = categoryColors(theme, category.colorKey);
  const completed = activity.status === 'completed';
  const skipped = activity.status === 'skipped';

  return (
    <Animated.View
      entering={enter ? listEntering(index) : undefined}
      exiting={listExiting()}
    >
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
          <ActivityLeadingArtwork artwork={leadingArtwork} category={category} />
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
  logo: {
    width: '78%',
    height: '78%',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
});
