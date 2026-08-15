import { useRouter } from 'expo-router';
import { lazy, Suspense, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CollapsibleSection, Screen } from '@/components/primitives';
import { categoryColors, layout, spacing } from '@/design-system';
import type { ExerciseLoadKind } from '@/features/workouts/exercise-load';
import { formatMuscleLabel } from '@/features/workouts/format-muscle-label';
import {
  EXERCISES_BY_ID,
  MUSCLE_GROUPS_BY_KEY,
  type ExerciseTemplate,
  type MuscleKey,
  type MuscleTarget,
} from '@/features/workouts/muscle-data';
import { MuscleExplorer } from '@/features/workouts/muscle-explorer';
import { MuscleFocusExercises } from '@/features/workouts/muscle-focus-exercises';
import { MuscleSummaryPanel } from '@/features/workouts/muscle-summary-panel';
import { useMuscleExplorerState } from '@/features/workouts/use-muscle-explorer-state';
import { WorkoutDayNavigator } from '@/features/workouts/workout-calendar';
import { workoutsByDate } from '@/features/workouts/workout-calendar-model';
import { WorkoutSessionBuilder } from '@/features/workouts/workout-session-builder';
import { WorkoutsScreenHeader } from '@/features/workouts/workouts-screen-header';
import { useTheme } from '@/hooks/use-theme';
import { newId, useSchedule } from '@/store/schedule';
import type { WorkoutExercise } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatWeekday, nowMinutes, todayKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';

const ExerciseAnatomyDemo = lazy(() =>
  import('@/features/workouts/exercise-anatomy-demo').then((mod) => ({
    default: mod.ExerciseAnatomyDemo,
  })),
);

interface ExerciseSource {
  targetId: string;
  targetLabel: string;
  groupLabel: string;
}

interface ExercisePreview {
  exercise: ExerciseTemplate;
  primaryGroup: MuscleKey;
  primaryTarget: MuscleTarget;
}

/** Primary carousel section for workout planning. */
export default function WorkoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [selectedExerciseSources, setSelectedExerciseSources] = useState<
    Record<string, ExerciseSource>
  >({});
  const [exerciseLoadKind, setExerciseLoadKind] = useState<ExerciseLoadKind>('weighted');
  const [exercisePreview, setExercisePreview] = useState<ExercisePreview>();
  const [savedMessage, setSavedMessage] = useState<string>();

  const explorer = useMuscleExplorerState(() => setSavedMessage(undefined));

  const activities = useSchedule((state) => state.activities);
  const workouts = useSchedule((state) => state.workouts);
  const categories = useSchedule((state) => state.categories);
  const saveEvent = useSchedule((state) => state.saveEvent);

  const gymCategory = categories.find((category) => category.detailKind === 'gym');
  const gymColors = categoryColors(theme, 'gym');

  const selectedExercises = selectedExerciseIds
    .map((id) => EXERCISES_BY_ID[id])
    .filter((exercise): exercise is ExerciseTemplate => Boolean(exercise));
  const selectedSetCount = selectedExercises.reduce((total, exercise) => total + exercise.sets, 0);
  const estimatedDuration = Math.max(20, selectedExercises.length * 8);

  const scheduledWorkouts = useMemo(
    () => workoutsByDate(activities, workouts),
    [activities, workouts],
  );
  const todaysCount = scheduledWorkouts.get(today)?.length ?? 0;

  const toggleExercise = (exerciseId: string, source?: ExerciseSource) => {
    haptics.select();
    setSavedMessage(undefined);
    const removing = selectedExerciseIds.includes(exerciseId);
    setSelectedExerciseIds((current) =>
      removing
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
    setSelectedExerciseSources((current) => {
      if (removing) {
        const remaining = { ...current };
        delete remaining[exerciseId];
        return remaining;
      }
      return {
        ...current,
        [exerciseId]: source ?? {
          targetId: explorer.atlasMuscle.id,
          targetLabel: explorer.atlasMuscle.name,
          groupLabel: explorer.atlasSelection.groupLabel,
        },
      };
    });
  };

  const openExercisePreview = (exercise: ExerciseTemplate) => {
    haptics.tap();
    setExercisePreview({
      exercise,
      primaryGroup: explorer.atlasSelection.groupKey ?? explorer.selectedMuscle,
      primaryTarget: explorer.atlasSelection.target ?? explorer.selectedTarget,
    });
  };

  const clearSelectedExercises = () => {
    setSelectedExerciseIds([]);
    setSelectedExerciseSources({});
  };

  const openCustomPlanner = () => {
    router.push({
      pathname: '/activity-form',
      params: { date: selectedDate, category: gymCategory?.id },
    });
  };

  const saveDayWorkout = (payload: Parameters<typeof saveEvent>[0]) => {
    const activity = saveEvent(payload);
    setSavedMessage(
      payload.id
        ? `${activity.title} was updated.`
        : `${activity.title} was added to ${formatWeekday(activity.date)}.`,
    );
    haptics.success();
  };

  const addWorkoutToSelectedDate = () => {
    if (!gymCategory || selectedExercises.length === 0) return;

    const muscleLabels = Array.from(
      new Set(
        selectedExerciseIds
          .map((exerciseId) => selectedExerciseSources[exerciseId]?.targetLabel)
          .filter((label): label is string => Boolean(label)),
      ),
    );
    const title =
      muscleLabels.length === 1
        ? `${muscleLabels[0]} workout`
        : muscleLabels.length === 2
          ? `${muscleLabels[0]} + ${muscleLabels[1]}`
          : 'Full-body workout';
    const workoutExercises: WorkoutExercise[] = selectedExercises.map((exercise) => ({
      id: newId('exercise'),
      name: exercise.name,
      icon: exercise.icon,
      restSeconds: exercise.restSeconds,
      sets: Array.from({ length: exercise.sets }, () => ({
        id: newId('set'),
        reps: exercise.reps,
        weightKg: 0,
        done: false,
      })),
    }));

    saveEvent({
      detailKind: 'gym',
      activity: {
        date: selectedDate,
        title,
        categoryId: gymCategory.id,
        startMinutes: selectedDate === today ? nowMinutes() : 18 * 60,
        durationMinutes: estimatedDuration,
        status: 'upcoming',
        summary: `${selectedExercises.length} exercise${selectedExercises.length === 1 ? '' : 's'} · ${estimatedDuration} min`,
      },
      workout: {
        activityId: 'draft',
        type: 'strength',
        name: title,
        exercises: workoutExercises,
      },
    });

    clearSelectedExercises();
    setSavedMessage(`${title} was added to ${formatWeekday(selectedDate)}.`);
    haptics.success();
  };

  return (
    <Screen padded={false} contentStyle={styles.content}>
      <View style={styles.pagePadding}>
        <WorkoutsScreenHeader
          todaysCount={todaysCount}
          gymColors={gymColors}
          onOpenCustomPlanner={openCustomPlanner}
        />
      </View>

      <WorkoutDayNavigator
        selectedDate={selectedDate}
        workoutsByDate={scheduledWorkouts}
        gymColors={gymColors}
        savedMessage={savedMessage}
        onSelectDate={(dateKey) => {
          setSelectedDate(dateKey);
          setSavedMessage(undefined);
        }}
        gymCategoryId={gymCategory?.id}
        onSaveWorkout={saveDayWorkout}
      />

      <View style={styles.pagePadding}>
        <CollapsibleSection
          title="Explore Muscles"
          description="Open the atlas when you want to build from anatomy."
          testID={AgentUiIds.workouts.exploreMuscles}
        >
          <View style={{ gap: spacing.xl }}>
            <MuscleExplorer
              anatomySex={explorer.anatomySex}
              bodyView={explorer.bodyView}
              selectedMuscle={explorer.selectedMuscle}
              selectedTarget={explorer.selectedTarget}
              atlasCategoryId={explorer.atlasCategoryId}
              atlasMuscle={explorer.atlasMuscle}
              atlasSelection={explorer.atlasSelection}
              visibleMuscles={explorer.visibleMuscles}
              gymColors={gymColors}
              onChangeAnatomySex={explorer.changeAnatomySex}
              onChangeBodyView={explorer.changeBodyView}
              onSelectMapHit={explorer.selectMapHit}
              onSelectMuscle={explorer.selectMuscle}
              onSelectAtlasCategory={explorer.selectAtlasCategory}
              onSelectAtlasMuscle={explorer.selectAtlasMuscle}
            />
            <MuscleSummaryPanel
              atlasMuscle={explorer.atlasMuscle}
              atlasSelection={explorer.atlasSelection}
              muscleTargets={explorer.muscleTargets}
              selectedTarget={explorer.selectedTarget}
              focusExercises={explorer.focusExercises}
              gymColors={gymColors}
              onSelectTarget={explorer.selectTarget}
            />
            <MuscleFocusExercises
              muscleLabel={formatMuscleLabel(explorer.atlasMuscle.name)}
              exercises={explorer.focusExercises}
              loadKind={exerciseLoadKind}
              selectedExerciseIds={selectedExerciseIds}
              accentTint={gymColors.tint}
              accentMain={gymColors.main}
              onChangeLoadKind={setExerciseLoadKind}
              onPreview={openExercisePreview}
              onToggle={(exerciseId) => toggleExercise(exerciseId)}
            />
          </View>
        </CollapsibleSection>
      </View>

      <WorkoutSessionBuilder
        selectedExercises={selectedExercises}
        selectedSetCount={selectedSetCount}
        estimatedDuration={estimatedDuration}
        onClear={clearSelectedExercises}
        targetDate={selectedDate}
        onAddToDate={addWorkoutToSelectedDate}
      />

      <Suspense fallback={null}>
        <ExerciseAnatomyDemo
          anatomySex={explorer.anatomySex}
          exercise={exercisePreview?.exercise}
          primaryGroup={exercisePreview?.primaryGroup ?? explorer.selectedMuscle}
          primaryTarget={exercisePreview?.primaryTarget ?? explorer.selectedTarget}
          selected={exercisePreview
            ? selectedExerciseIds.includes(exercisePreview.exercise.id)
            : false}
          visible={Boolean(exercisePreview)}
          onClose={() => setExercisePreview(undefined)}
          onToggleSelected={() => {
            if (!exercisePreview) return;
            toggleExercise(exercisePreview.exercise.id, {
              targetId: exercisePreview.primaryTarget.id,
              targetLabel: exercisePreview.primaryTarget.label,
              groupLabel: MUSCLE_GROUPS_BY_KEY[exercisePreview.primaryGroup].label,
            });
          }}
        />
      </Suspense>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  pagePadding: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
});
