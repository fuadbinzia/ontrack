import type { EventSavePayload } from '@/store/schedule';
import type {
  Activity,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutType,
} from '@/types/models';
import { isToday, nowMinutes } from '@/utils/date';
import { durationPartsToMinutes, splitDurationMinutes } from '@/utils/duration';
import { newId } from '@/utils/id';
import { parseFiniteNumber } from '@/utils/parse';
import {
  workoutWeightInputValue,
  workoutWeightToKilograms,
  type WorkoutWeightUnit,
} from '@/features/workouts/weight-unit';

export interface WorkoutDaySetDraft {
  id: string;
  reps: string;
  weight: string;
  done: boolean;
}

export interface WorkoutDayExerciseDraft {
  id: string;
  name: string;
  icon: string;
  restSeconds: string;
  note?: string;
  previousBest?: string;
  sets: WorkoutDaySetDraft[];
}

export interface WorkoutDayDraft {
  title: string;
  type: WorkoutType;
  startMinutes: number;
  durationHours: string;
  durationMinutes: string;
  exercises: WorkoutDayExerciseDraft[];
}

export function createWorkoutDaySetDraft(): WorkoutDaySetDraft {
  return { id: newId('set'), reps: '8', weight: '', done: false };
}

export function createWorkoutDayExerciseDraft(): WorkoutDayExerciseDraft {
  return {
    id: newId('exercise'),
    name: '',
    icon: 'gym',
    restSeconds: '60',
    sets: Array.from({ length: 3 }, createWorkoutDaySetDraft),
  };
}

export function createWorkoutDayDraftFromScheduled(
  activity: Activity,
  workout: Workout,
  weightUnit: WorkoutWeightUnit = 'kg',
): WorkoutDayDraft {
  const duration = splitDurationMinutes(activity.durationMinutes);
  return {
    title: activity.title,
    type: workout.type,
    startMinutes: activity.startMinutes,
    durationHours: String(duration.hours),
    durationMinutes: String(duration.minutes),
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      icon: exercise.icon,
      restSeconds: String(exercise.restSeconds),
      note: exercise.note,
      previousBest: exercise.previousBest,
      sets: exercise.sets.map((set) => ({
        id: set.id,
        reps: String(set.reps),
        weight: workoutWeightInputValue(set.weightKg, weightUnit),
        done: set.done,
      })),
    })),
  };
}

export function createWorkoutDayDraft(
  dateKey: string,
  initialStartMinutes = isToday(dateKey) ? nowMinutes() : 18 * 60,
): WorkoutDayDraft {
  return {
    title: 'Gym Session',
    type: 'strength',
    startMinutes: initialStartMinutes,
    durationHours: '1',
    durationMinutes: '0',
    exercises: [createWorkoutDayExerciseDraft()],
  };
}

type WorkoutDayPayloadResult =
  | { ok: true; payload: EventSavePayload }
  | { ok: false; error: string };

/** Validate a Fitness sheet draft and translate it into schedule-backed workout data. */
export function workoutDayDraftToPayload(
  draft: WorkoutDayDraft,
  dateKey: string,
  gymCategoryId: string,
  weightUnit: WorkoutWeightUnit = 'kg',
  existing?: { activity: Activity; workout: Workout },
): WorkoutDayPayloadResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'Give this workout a name.' };

  const durationMinutes = durationPartsToMinutes(
    draft.durationHours || '0',
    draft.durationMinutes || '0',
  );
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: 'Enter how long you plan to be at the gym.' };
  }

  if (draft.exercises.length === 0) {
    return { ok: false, error: 'Add at least one exercise.' };
  }

  const exercises: WorkoutExercise[] = [];
  for (const [exerciseIndex, exercise] of draft.exercises.entries()) {
    const name = exercise.name.trim();
    if (!name) {
      return { ok: false, error: `Name exercise ${exerciseIndex + 1}.` };
    }
    if (exercise.sets.length === 0) {
      return { ok: false, error: `Add at least one set for ${name}.` };
    }

    const restSeconds = parseFiniteNumber(exercise.restSeconds || '0');
    if (restSeconds === undefined || restSeconds < 0) {
      return { ok: false, error: `Enter a valid rest time for ${name}.` };
    }

    const sets: WorkoutSet[] = [];
    for (const [setIndex, set] of exercise.sets.entries()) {
      const reps = parseFiniteNumber(set.reps);
      const weight = parseFiniteNumber(set.weight || '0');
      if (reps === undefined || reps <= 0) {
        return { ok: false, error: `Enter reps for ${name}, set ${setIndex + 1}.` };
      }
      if (weight === undefined || weight < 0) {
        return { ok: false, error: `Enter a valid weight for ${name}, set ${setIndex + 1}.` };
      }
      sets.push({
        id: set.id,
        reps,
        weightKg: workoutWeightToKilograms(weight, weightUnit),
        done: set.done,
      });
    }

    exercises.push({
      id: exercise.id,
      name,
      icon: exercise.icon,
      restSeconds,
      ...(exercise.note !== undefined ? { note: exercise.note } : {}),
      ...(exercise.previousBest !== undefined
        ? { previousBest: exercise.previousBest }
        : {}),
      sets,
    });
  }

  return {
    ok: true,
    payload: {
      ...(existing ? { id: existing.activity.id } : {}),
      detailKind: 'gym',
      activity: {
        date: dateKey,
        title,
        categoryId: gymCategoryId,
        startMinutes: draft.startMinutes,
        durationMinutes,
        status: existing?.activity.status ?? 'upcoming',
        ...(existing
          ? {
              allDay: existing.activity.allDay,
              notes: existing.activity.notes,
              attendeeEmails: existing.activity.attendeeEmails,
              travelPlanId: existing.activity.travelPlanId,
              travelItemId: existing.activity.travelItemId,
              photo: existing.activity.photo,
              photoProcessingVersion: existing.activity.photoProcessingVersion,
            }
          : {}),
        summary: `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${durationMinutes} min`,
      },
      workout: {
        ...existing?.workout,
        activityId: existing?.activity.id ?? 'draft',
        type: draft.type,
        name: title,
        exercises,
      },
    },
  };
}
