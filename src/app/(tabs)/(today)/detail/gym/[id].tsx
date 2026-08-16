import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, SectionHeader } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { useDismissCalendarDetail } from '@/features/daily-tracking/dismiss-calendar-detail';
import { aiProvider } from '@/services/ai';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import type { WorkoutRecommendation } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { activityTimingLabel } from '@/utils/activity-time';
import { formatCount } from '@/utils/grammar';

export default function GymDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id;

  const activity = useSchedule((s) => s.activities.find((a) => a.id === activityId));
  const workout = useSchedule((s) => s.workouts.find((w) => w.activityId === activityId));
  const close = useDismissCalendarDetail(!activity);
  const categories = useSchedule((s) => s.categories);
  const goal = usePreferences((s) => s.goal);
  const aiEnabled = usePreferences((s) => s.aiEnabled);

  const [recommendation, setRecommendation] = useState<WorkoutRecommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(aiEnabled);

  useEffect(() => {
    if (!aiEnabled) return;
    let cancelled = false;
    aiProvider
      .recommendWorkout({ goal, recentWorkoutNames: [workout?.name ?? ''] })
      .then((rec) => {
        if (!cancelled) setRecommendation(rec);
      })
      .finally(() => {
        if (!cancelled) setLoadingRec(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aiEnabled, goal, workout?.name]);

  if (!activity) return null;

  const category = findCategory(categories, activity.categoryId);

  return (
    <CalendarDetailSheet
      kind="gym"
      eyebrow={category.name}
      title={workout?.name ?? activity.title}
      subtitle={activityTimingLabel(activity)}
      subtitleIcon="clock"
      onClose={close}>
      <AppText variant="body" color="secondary">
        {formatCount(workout?.exercises.length ?? 0, 'exercise')} planned
      </AppText>
      <Button
        variant="secondary"
        icon="edit"
        testID={AgentUiIds.workouts.gym.edit}
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
        onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}
        accessibilityLabel="Edit workout">
        Edit workout
      </Button>

      <SectionHeader title="Exercises" />
      {(workout?.exercises ?? []).map((exercise) => (
        <View key={exercise.id} style={styles.exerciseRow}>
          <AppText variant="callout">{exercise.name}</AppText>
          <AppText variant="caption" color="secondary">
            {formatCount(exercise.sets.length, 'set')} · {exercise.restSeconds}s rest
          </AppText>
        </View>
      ))}

      {aiEnabled ? (
        <>
          <SectionHeader title="AI Recommendation" />
          {loadingRec ? (
            <AppText variant="callout" color="secondary">
              Generating a sample recommendation…
            </AppText>
          ) : recommendation ? (
            <View style={styles.recBox}>
              <AppText variant="subheading">{recommendation.name}</AppText>
              <AppText variant="body" color="secondary">
                {recommendation.reason}
              </AppText>
              <AppText variant="caption" color="tertiary">
                {recommendation.disclaimer}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}

      <Button
        testID={AgentUiIds.workouts.gym.start}
        onPress={() => router.push({ pathname: '/detail/gym-active/[id]', params: { id: activityId } })}
        accessibilityLabel="Start workout">
        Start workout
      </Button>
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  exerciseRow: {
    marginBottom: spacing.md,
    gap: spacing.xxs,
  },
  recBox: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
});
