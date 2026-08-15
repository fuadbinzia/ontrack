import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  AppText,
  Button,
  Card,
  GlassPlate,
  IconButton,
  Symbol,
} from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import {
  type ScheduledWorkout,
  workoutSetSummary,
} from '@/features/workouts/workout-calendar-model';
import { WorkoutDayPlanner } from '@/features/workouts/workout-day-planner';
import { deviceWorkoutWeightUnit } from '@/features/workouts/weight-unit';
import { useTheme } from '@/hooks/use-theme';
import type { EventSavePayload } from '@/store/schedule';
import { activityTimingLabel } from '@/utils/activity-time';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { addDays, formatDateKeyMedium, formatWeekday } from '@/utils/date';
import { formatCount } from '@/utils/grammar';

export function WorkoutDayNavigator({
  selectedDate,
  workoutsByDate,
  gymColors,
  savedMessage,
  onSelectDate,
  gymCategoryId,
  onSaveWorkout,
}: {
  selectedDate: string;
  workoutsByDate: ReadonlyMap<string, ScheduledWorkout[]>;
  gymColors: { main: string; tint: string };
  savedMessage?: string;
  onSelectDate: (dateKey: string) => void;
  gymCategoryId?: string;
  onSaveWorkout: (payload: EventSavePayload) => void;
}) {
  const theme = useTheme();
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<ScheduledWorkout>();
  const weightUnit = deviceWorkoutWeightUnit();
  const selectedWorkouts = workoutsByDate.get(selectedDate) ?? [];
  const selectedLabel = `${formatWeekday(selectedDate)} · ${formatDateKeyMedium(selectedDate)}`;

  const shiftDay = (delta: -1 | 1) => {
    setPlannerOpen(false);
    setEditingWorkout(undefined);
    onSelectDate(addDays(selectedDate, delta));
  };

  return (
    <AgentTestId testID={AgentUiIds.workouts.selectedDaySection} style={styles.pagePadding}>
      <GlassPlate airy style={styles.selectedDayPanel}>
        <View style={styles.selectedDayHeader}>
          <View style={styles.flex}>
            <AppText variant="overline" color="accent">Selected Day</AppText>
            <AppText variant="subheading" fit>{selectedLabel}</AppText>
          </View>
          <View style={styles.dayActions}>
            <IconButton
              icon="chevron-left"
              testID={AgentUiIds.workouts.selectedDayPrevious}
              accessibilityLabel={`Previous day, ${formatWeekday(addDays(selectedDate, -1))}, ${formatDateKeyMedium(addDays(selectedDate, -1))}`}
              onPress={() => shiftDay(-1)}
            />
            <IconButton
              icon="chevron-right"
              testID={AgentUiIds.workouts.selectedDayNext}
              accessibilityLabel={`Next day, ${formatWeekday(addDays(selectedDate, 1))}, ${formatDateKeyMedium(addDays(selectedDate, 1))}`}
              onPress={() => shiftDay(1)}
            />
          </View>
        </View>

        {selectedWorkouts.length ? (
          <View style={styles.workoutList}>
            {selectedWorkouts.map(({ activity, workout }) => (
              <Card
                key={activity.id}
                variant="sunken"
                testID={AgentUiIds.workouts.selectedDayEditWorkout(activity.id)}
                onPress={() => {
                  setEditingWorkout({ activity, workout });
                  setPlannerOpen(true);
                }}
                accessibilityLabel={`Edit ${activity.title}`}>
                <View style={styles.workoutRow}>
                  <View style={[styles.timelineMark, { backgroundColor: gymColors.main }]} />
                  <View style={styles.flex}>
                    <AppText variant="subheading" numberOfLines={1}>{activity.title}</AppText>
                    <AppText variant="caption" color="secondary">
                      {activityTimingLabel(activity)} ·{' '}
                      {workout.type[0].toUpperCase() + workout.type.slice(1)} ·{' '}
                      {formatCount(workout.exercises.length, 'exercise')}
                    </AppText>
                  </View>
                  <Symbol name="edit" size="sm" color={theme.textTertiary} />
                </View>
                {workout.exercises.length ? (
                  <View style={[styles.exerciseBreakdown, { borderTopColor: theme.separator }]}>
                    {workout.exercises.map((exercise) => (
                      <View key={exercise.id} style={styles.exerciseBreakdownRow}>
                        <AppText variant="caption" numberOfLines={1} style={styles.flex}>
                          {exercise.name}
                        </AppText>
                        <AppText variant="caption" color="secondary" fit>
                          {workoutSetSummary(exercise.sets, weightUnit)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.openDay}>
            <AppText variant="subheading">Recovery day—or room for something new.</AppText>
            <AppText variant="caption" color="secondary">
              Choose a focus below, or open the planner for cardio, mobility, and custom sessions.
            </AppText>
          </View>
        )}

        <Button
          variant="secondary"
          icon="calendar-add"
          testID={AgentUiIds.workouts.selectedDayPlan}
          disabled={!gymCategoryId}
          onPress={() => {
            setEditingWorkout(undefined);
            setPlannerOpen(true);
          }}
          accessibilityLabel={`Plan a workout for ${selectedLabel}`}>
          {selectedWorkouts.length ? 'Add Another Workout' : 'Plan This Day'}
        </Button>
      </GlassPlate>

      {gymCategoryId ? (
        <WorkoutDayPlanner
          visible={plannerOpen}
          dateKey={selectedDate}
          gymCategoryId={gymCategoryId}
          scheduledWorkout={editingWorkout}
          onCancel={() => {
            setPlannerOpen(false);
            setEditingWorkout(undefined);
          }}
          onSave={(payload) => {
            onSaveWorkout(payload);
            setPlannerOpen(false);
            setEditingWorkout(undefined);
          }}
        />
      ) : null}

      {savedMessage ? (
        <Animated.View entering={FadeInDown.duration(220)}>
          <GlassPlate mist accessible accessibilityRole="alert" style={styles.savedMessage}>
            <Symbol name="checkmark.circle.fill" size="md" color={theme.success} />
            <AppText variant="callout" color="success" style={styles.flex}>
              {savedMessage}
            </AppText>
          </GlassPlate>
        </Animated.View>
      ) : null}
    </AgentTestId>
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
  selectedDayPanel: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  selectedDayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayActions: { flexDirection: 'row', flexShrink: 0, gap: spacing.xs },
  workoutList: { gap: spacing.sm },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exerciseBreakdown: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timelineMark: { width: 4, alignSelf: 'stretch', borderRadius: radii.pill },
  openDay: { gap: spacing.xs, paddingVertical: spacing.xs },
  savedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  flex: { flex: 1, minWidth: 0 },
});
