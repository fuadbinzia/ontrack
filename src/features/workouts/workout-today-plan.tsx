import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
    AppText,
    Button,
    Card,
    GlassIconWell,
    GlassPlate,
    SectionHeader,
    Symbol,
} from '@/components/primitives';
import { fadeEntering, layout, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, Workout } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { activityTimingLabel } from '@/utils/activity-time';
import { formatCount } from '@/utils/grammar';

export function WorkoutTodayPlan({
  todaysWorkouts,
  gymColors,
  savedMessage,
  onOpenCustomPlanner,
}: {
  todaysWorkouts: { activity: Activity; workout: Workout }[];
  gymColors: { main: string; tint: string };
  savedMessage?: string;
  onOpenCustomPlanner: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={styles.pagePadding}>
      <SectionHeader title="Today’s Plan" detail={`${todaysWorkouts.length} Scheduled`} />
      {todaysWorkouts.length === 0 ? (
        <Card variant="sunken" style={styles.emptyPlan}>
          <GlassIconWell size={40} borderRadius={radii.md}>
            <Symbol name="calendar.badge.plus" size="md" color={gymColors.main} />
          </GlassIconWell>
          <View style={styles.flex}>
            <AppText variant="subheading">Your training window is open</AppText>
            <AppText variant="caption" color="secondary">
              Select movements above or use the custom planner.
            </AppText>
          </View>
          <Symbol name="arrow.up" size="sm" color={theme.textTertiary} />
        </Card>
      ) : (
        <View style={styles.planList}>
          {todaysWorkouts.map(({ activity, workout }) => (
            <Card
              key={activity.id}
              testID={AgentUiIds.workouts.todayPlan(activity.id)}
              onPress={() =>
                router.push({ pathname: '/detail/gym/[id]', params: { id: activity.id } })
              }
              accessibilityLabel={`Open ${activity.title}`}>
              <View style={styles.planRow}>
                <GlassIconWell size={40} borderRadius={radii.md}>
                  <Symbol name="dumbbell.fill" size="md" color={gymColors.main} />
                </GlassIconWell>
                <View style={styles.flex}>
                  <AppText variant="subheading" numberOfLines={1}>{activity.title}</AppText>
                  <AppText variant="caption" color="secondary">
                    {activityTimingLabel(activity)} · {formatCount(workout.exercises.length, 'exercise')}
                  </AppText>
                </View>
                <Symbol name="chevron.right" size="sm" color={theme.textTertiary} />
              </View>
            </Card>
          ))}
        </View>
      )}

      {savedMessage ? (
        <Animated.View entering={fadeEntering()}>
          <GlassPlate
            mist
            accessible
            accessibilityRole="alert"
            style={styles.savedMessage}>
            <Symbol name="checkmark.circle.fill" size="md" color={theme.success} />
            <AppText variant="callout" color="success">
              {savedMessage}
            </AppText>
          </GlassPlate>
        </Animated.View>
      ) : null}

      <Button
        variant="secondary"
        icon="filter"
        testID={AgentUiIds.workouts.planFromScratch}
        onPress={onOpenCustomPlanner}
        accessibilityLabel="Open the custom workout editor">
        Plan from scratch
      </Button>

      <AppText variant="caption" color="tertiary" align="center" style={styles.disclaimer}>
        Exercise ideas are general education, not medical advice. Stop if a movement causes pain.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pagePadding: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  emptyPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planList: { gap: spacing.sm },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  savedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  disclaimer: {
    paddingHorizontal: spacing.md,
  },
});
