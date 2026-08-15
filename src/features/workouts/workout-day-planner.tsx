import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AgentTestId,
  AgentUiIds,
} from '@/utils/agent-ui';
import {
  AppText,
  Button,
  DurationField,
  ErrorMessage,
  GlassPlate,
  IconButton,
  Input,
  SegmentedControl,
  SheetScaffold,
  TimeField,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import {
  createWorkoutDayDraft,
  createWorkoutDayDraftFromScheduled,
  createWorkoutDayExerciseDraft,
  createWorkoutDaySetDraft,
  workoutDayDraftToPayload,
  type WorkoutDayDraft,
  type WorkoutDayExerciseDraft,
} from '@/features/workouts/workout-day-planner-model';
import type { ScheduledWorkout } from '@/features/workouts/workout-calendar-model';
import { useResponsive } from '@/hooks/use-responsive';
import type { EventSavePayload } from '@/store/schedule';
import type { WorkoutType } from '@/types/models';
import { formatDateKeyMedium, formatWeekday } from '@/utils/date';
import {
  deviceWorkoutWeightUnit,
  workoutWeightLabel,
} from '@/features/workouts/weight-unit';

const WORKOUT_TYPES: readonly { value: WorkoutType; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'custom', label: 'Custom' },
];

function WorkoutDayExerciseEditor({
  exercise,
  index,
  canRemove,
  onChange,
  onRemove,
  weightUnit,
}: {
  exercise: WorkoutDayExerciseDraft;
  index: number;
  canRemove: boolean;
  onChange: (next: WorkoutDayExerciseDraft) => void;
  onRemove: () => void;
  weightUnit: ReturnType<typeof deviceWorkoutWeightUnit>;
}) {
  const weightLabel = workoutWeightLabel(weightUnit);
  return (
    <GlassPlate airy style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <AppText variant="overline" color="accent" fit>
          Exercise {index + 1}
        </AppText>
        {canRemove ? (
          <IconButton
            icon="delete"
            testID={AgentUiIds.workouts.dayPlanner.removeExercise(exercise.id)}
            accessibilityLabel={`Remove exercise ${index + 1}`}
            onPress={onRemove}
          />
        ) : null}
      </View>

      <View style={styles.exerciseIdentityRow}>
        <Input
          stackedLabel="Exercise"
          value={exercise.name}
          onChangeText={(name) => onChange({ ...exercise, name })}
          placeholder="Bench press"
          autoCapitalize="words"
          containerStyle={styles.exerciseNameField}
          testID={AgentUiIds.workouts.dayPlanner.exerciseName(exercise.id)}
        />
        <Input
          stackedLabel="Rest (Sec)"
          stackedAlign="center"
          value={exercise.restSeconds}
          onChangeText={(restSeconds) => onChange({ ...exercise, restSeconds })}
          keyboardType="number-pad"
          selectTextOnFocus
          containerStyle={styles.restField}
          testID={AgentUiIds.workouts.dayPlanner.exerciseRest(exercise.id)}
        />
      </View>

      <View style={styles.setHeader}>
        <AppText variant="overline" color="tertiary" fit>Sets</AppText>
        <AppText variant="caption" color="secondary" fit>
          Reps · {weightLabel}
        </AppText>
      </View>

      <View style={styles.setList}>
        {exercise.sets.map((set, setIndex) => (
          <View key={set.id} style={styles.setRow}>
            <View style={styles.setNumber}>
              <AppText variant="caption" color="secondary" fit>
                {setIndex + 1}
              </AppText>
            </View>
            <Input
              stackedLabel="Reps"
              stackedAlign="center"
              value={set.reps}
              onChangeText={(reps) =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.map((item) =>
                    item.id === set.id ? { ...item, reps } : item,
                  ),
                })
              }
              keyboardType="number-pad"
              selectTextOnFocus
              containerStyle={styles.setInput}
              testID={AgentUiIds.workouts.dayPlanner.setReps(set.id)}
            />
            <Input
              stackedLabel={weightLabel}
              stackedAlign="center"
              value={set.weight}
              onChangeText={(weight) =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.map((item) =>
                    item.id === set.id ? { ...item, weight } : item,
                  ),
                })
              }
              keyboardType="decimal-pad"
              placeholder="0"
              selectTextOnFocus
              containerStyle={styles.setInput}
              testID={AgentUiIds.workouts.dayPlanner.setWeight(set.id)}
            />
            <IconButton
              icon="delete"
              disabled={exercise.sets.length === 1}
              testID={AgentUiIds.workouts.dayPlanner.removeSet(set.id)}
              accessibilityLabel={`Remove set ${setIndex + 1}`}
              onPress={() =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.filter((item) => item.id !== set.id),
                })
              }
            />
          </View>
        ))}
      </View>

      <Button
        variant="secondary"
        size="sm"
        icon="add"
        testID={AgentUiIds.workouts.dayPlanner.addSet(exercise.id)}
        accessibilityLabel={`Add a set to ${exercise.name || `exercise ${index + 1}`}`}
        onPress={() =>
          onChange({ ...exercise, sets: [...exercise.sets, createWorkoutDaySetDraft()] })
        }>
        Add Set
      </Button>
    </GlassPlate>
  );
}

export function WorkoutDayPlanner({
  visible,
  dateKey,
  gymCategoryId,
  scheduledWorkout,
  onCancel,
  onSave,
}: {
  visible: boolean;
  dateKey: string;
  gymCategoryId: string;
  scheduledWorkout?: ScheduledWorkout;
  onCancel: () => void;
  onSave: (payload: EventSavePayload) => void;
}) {
  const [draft, setDraft] = useState<WorkoutDayDraft>(() => createWorkoutDayDraft(dateKey));
  const [error, setError] = useState<string>();
  const weightUnit = deviceWorkoutWeightUnit();
  const { spacing: responsiveSpacing, widthClass } = useResponsive();

  useEffect(() => {
    if (!visible) return;
    setDraft(
      scheduledWorkout
        ? createWorkoutDayDraftFromScheduled(
            scheduledWorkout.activity,
            scheduledWorkout.workout,
            weightUnit,
          )
        : createWorkoutDayDraft(dateKey),
    );
    setError(undefined);
  }, [dateKey, scheduledWorkout, visible, weightUnit]);

  const patchDraft = (patch: Partial<WorkoutDayDraft>) => {
    setError(undefined);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateExercise = (id: string, next: WorkoutDayExerciseDraft) => {
    setError(undefined);
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => (exercise.id === id ? next : exercise)),
    }));
  };

  const save = () => {
    const result = workoutDayDraftToPayload(
      draft,
      dateKey,
      gymCategoryId,
      weightUnit,
      scheduledWorkout,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.payload);
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow={`${formatWeekday(dateKey)} · ${formatDateKeyMedium(dateKey)}`}
      title={scheduledWorkout ? 'Edit Workout' : 'Add Workout'}
      onClose={onCancel}
      closeAccessibilityLabel="Close workout planner"
      closeTestID={AgentUiIds.workouts.dayPlanner.close}
      backdropTestID={AgentUiIds.workouts.dayPlanner.backdrop}
      scrollKey={`${scheduledWorkout?.activity.id ?? 'new'}-${dateKey}-${visible ? 'open' : 'closed'}`}
      contentContainerStyle={styles.sheetContent}
      footer={(
        <Button
          size="lg"
          icon="calendar-add"
          testID={AgentUiIds.workouts.dayPlanner.save}
          onPress={save}>
          {scheduledWorkout ? 'Save Changes' : 'Save Workout'}
        </Button>
      )}>
      <AgentTestId
        testID={AgentUiIds.workouts.dayPlanner.section}
        label="Selected day workout planner"
        style={styles.planner}>
        <Input
          stackedLabel="Session Name"
          value={draft.title}
          onChangeText={(title) => patchDraft({ title })}
          autoCapitalize="words"
          testID={AgentUiIds.workouts.dayPlanner.title}
        />

        <View
          style={[
            styles.scheduleFields,
            {
              flexDirection: widthClass === 'compact' ? 'column' : 'row',
              gap: responsiveSpacing.sm,
            },
          ]}>
          <View style={styles.scheduleField}>
            <TimeField
              label="Start Time"
              value={draft.startMinutes}
              onChange={(startMinutes) => patchDraft({ startMinutes })}
              testID={AgentUiIds.workouts.dayPlanner.startTime}
            />
          </View>
          <View style={styles.scheduleField}>
            <DurationField
              label="Time at Gym"
              hours={draft.durationHours}
              onHoursChange={(durationHours) => patchDraft({ durationHours })}
              minutes={draft.durationMinutes}
              onMinutesChange={(durationMinutes) => patchDraft({ durationMinutes })}
              hoursTestID={AgentUiIds.workouts.dayPlanner.durationHours}
              minutesTestID={AgentUiIds.workouts.dayPlanner.durationMinutes}
            />
          </View>
        </View>

        <SegmentedControl
          label="Workout Type"
          value={draft.type}
          options={WORKOUT_TYPES.map((option) => ({
            ...option,
            testID: AgentUiIds.workouts.dayPlanner.type(option.value),
          }))}
          onChange={(type) => patchDraft({ type })}
        />

        <View style={styles.exerciseList}>
          {draft.exercises.map((exercise, index) => (
            <WorkoutDayExerciseEditor
              key={exercise.id}
              exercise={exercise}
              index={index}
              canRemove={draft.exercises.length > 1}
              weightUnit={weightUnit}
              onChange={(next) => updateExercise(exercise.id, next)}
              onRemove={() =>
                patchDraft({
                  exercises: draft.exercises.filter((item) => item.id !== exercise.id),
                })
              }
            />
          ))}
        </View>

        <Button
          variant="secondary"
          size="sm"
          icon="add"
          testID={AgentUiIds.workouts.dayPlanner.addExercise}
          onPress={() =>
            patchDraft({ exercises: [...draft.exercises, createWorkoutDayExerciseDraft()] })
          }>
          Add Exercise
        </Button>

        {error ? <ErrorMessage message={error} /> : null}
      </AgentTestId>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  sheetContent: { gap: spacing.md },
  planner: { gap: spacing.md },
  scheduleFields: { width: '100%' },
  scheduleField: { flex: 1, minWidth: 0 },
  exerciseList: { gap: spacing.sm },
  exerciseCard: { borderRadius: radii.lg, padding: spacing.sm, gap: spacing.sm },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exerciseIdentityRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  exerciseNameField: { flex: 1, minWidth: 0 },
  restField: { width: 108, flexShrink: 0 },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  setList: { gap: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setNumber: { width: 22, alignItems: 'center' },
  setInput: { flex: 1, minWidth: 0 },
});
