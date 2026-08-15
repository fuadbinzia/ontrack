import type { Activity, Workout, WorkoutSet } from '@/types/models';
import {
  kilogramsToWorkoutWeight,
  type WorkoutWeightUnit,
} from '@/features/workouts/weight-unit';

export interface ScheduledWorkout {
  activity: Activity;
  workout: Workout;
}

/** Join schedule activities to workout detail records, grouped by local date key. */
export function workoutsByDate(
  activities: readonly Activity[],
  workouts: readonly Workout[],
): Map<string, ScheduledWorkout[]> {
  const workoutByActivityId = new Map(
    workouts.map((workout) => [workout.activityId, workout]),
  );
  const grouped = new Map<string, ScheduledWorkout[]>();

  activities.forEach((activity) => {
    const workout = workoutByActivityId.get(activity.id);
    if (!workout) return;
    const dateWorkouts = grouped.get(activity.date) ?? [];
    dateWorkouts.push({ activity, workout });
    grouped.set(activity.date, dateWorkouts);
  });

  grouped.forEach((dateWorkouts) => {
    dateWorkouts.sort((a, b) => a.activity.startMinutes - b.activity.startMinutes);
  });
  return grouped;
}

function numberRange(values: readonly number[]): string {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
}

/** Compact set breakdown for the selected-day calendar card. */
export function workoutSetSummary(
  sets: readonly WorkoutSet[],
  weightUnit: WorkoutWeightUnit = 'kg',
): string {
  if (sets.length === 0) return 'No sets yet';
  const setLabel = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  const repsLabel = `${numberRange(sets.map((set) => set.reps))} reps`;
  const weights = sets.map((set) => kilogramsToWorkoutWeight(set.weightKg, weightUnit));
  const weightLabel = weights.every((weight) => weight === 0)
    ? 'Bodyweight'
    : `${numberRange(weights.map((weight) => Math.round(weight * 100) / 100))} ${weightUnit}`;
  return `${setLabel} · ${repsLabel} · ${weightLabel}`;
}
