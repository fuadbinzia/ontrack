import {
  createWorkoutDayDraft,
  createWorkoutDayDraftFromScheduled,
  workoutDayDraftToPayload,
  type WorkoutDayDraft,
} from '@/features/workouts/workout-day-planner-model';
import type { Activity, Workout } from '@/types/models';

function validDraft(): WorkoutDayDraft {
  return {
    title: 'Upper Body',
    type: 'strength',
    startMinutes: 17 * 60 + 30,
    durationHours: '1',
    durationMinutes: '15',
    exercises: [
      {
        id: 'exercise-1',
        name: 'Bench Press',
        icon: 'gym',
        restSeconds: '90',
        sets: [
          { id: 'set-1', reps: '8', weight: '60', done: false },
          { id: 'set-2', reps: '10', weight: '55.5', done: false },
        ],
      },
    ],
  };
}

describe('workoutDayDraftToPayload', () => {
  it('saves the selected date, full gym span, workout type, exercises, reps, and weight', () => {
    const result = workoutDayDraftToPayload(validDraft(), '2026-08-18', 'gym');

    expect(result).toEqual({
      ok: true,
      payload: {
        detailKind: 'gym',
        activity: {
          date: '2026-08-18',
          title: 'Upper Body',
          categoryId: 'gym',
          startMinutes: 1050,
          durationMinutes: 75,
          status: 'upcoming',
          summary: '1 exercise · 75 min',
        },
        workout: {
          activityId: 'draft',
          type: 'strength',
          name: 'Upper Body',
          exercises: [
            {
              id: 'exercise-1',
              name: 'Bench Press',
              icon: 'gym',
              restSeconds: 90,
              sets: [
                { id: 'set-1', reps: 8, weightKg: 60, done: false },
                { id: 'set-2', reps: 10, weightKg: 55.5, done: false },
              ],
            },
          ],
        },
      },
    });
  });

  it('rejects missing duration, exercises, names, sets, reps, and invalid weights', () => {
    const noDuration = validDraft();
    noDuration.durationHours = '0';
    noDuration.durationMinutes = '0';
    expect(workoutDayDraftToPayload(noDuration, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Enter how long you plan to be at the gym.',
    });

    const noExercises = validDraft();
    noExercises.exercises = [];
    expect(workoutDayDraftToPayload(noExercises, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Add at least one exercise.',
    });

    const unnamed = validDraft();
    unnamed.exercises[0].name = ' ';
    expect(workoutDayDraftToPayload(unnamed, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Name exercise 1.',
    });

    const noSets = validDraft();
    noSets.exercises[0].sets = [];
    expect(workoutDayDraftToPayload(noSets, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Add at least one set for Bench Press.',
    });

    const noReps = validDraft();
    noReps.exercises[0].sets[0].reps = '';
    expect(workoutDayDraftToPayload(noReps, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Enter reps for Bench Press, set 1.',
    });

    const invalidWeight = validDraft();
    invalidWeight.exercises[0].sets[0].weight = '-1';
    expect(workoutDayDraftToPayload(invalidWeight, '2026-08-18', 'gym')).toMatchObject({
      ok: false,
      error: 'Enter a valid weight for Bench Press, set 1.',
    });
  });

  it('converts pound-region input to kilograms before persistence', () => {
    const draft = validDraft();
    draft.exercises[0].sets = [
      { id: 'set-lb', reps: '8', weight: '135', done: false },
    ];

    const result = workoutDayDraftToPayload(draft, '2026-08-18', 'gym', 'lb');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.workout?.exercises[0].sets[0].weightKg).toBeCloseTo(61.23497, 4);
  });
});

describe('scheduled workout editing', () => {
  const activity: Activity = {
    id: 'activity-edit',
    date: '2026-08-18',
    title: 'Upper Body',
    categoryId: 'gym',
    startMinutes: 1050,
    durationMinutes: 75,
    status: 'completed',
    notes: 'Original activity note',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
  };
  const workout: Workout = {
    activityId: activity.id,
    type: 'strength',
    name: activity.title,
    notes: 'Keep the tempo steady',
    exercises: [
      {
        id: 'exercise-edit',
        name: 'Bench Press',
        icon: 'gym',
        restSeconds: 90,
        note: 'Pause at the chest',
        previousBest: '130 lb × 8',
        sets: [
          {
            id: 'set-edit',
            reps: 8,
            weightKg: 61.23496995,
            done: true,
          },
        ],
      },
    ],
  };

  it('prefills the editor from the tapped workout using the regional unit', () => {
    expect(createWorkoutDayDraftFromScheduled(activity, workout, 'lb')).toEqual({
      title: 'Upper Body',
      type: 'strength',
      startMinutes: 1050,
      durationHours: '1',
      durationMinutes: '15',
      exercises: [
        {
          id: 'exercise-edit',
          name: 'Bench Press',
          icon: 'gym',
          restSeconds: '90',
          note: 'Pause at the chest',
          previousBest: '130 lb × 8',
          sets: [{ id: 'set-edit', reps: '8', weight: '135', done: true }],
        },
      ],
    });
  });

  it('updates the original activity without losing workout progress or metadata', () => {
    const draft = createWorkoutDayDraftFromScheduled(activity, workout, 'lb');
    draft.title = 'Updated Upper Body';

    const result = workoutDayDraftToPayload(
      draft,
      activity.date,
      activity.categoryId,
      'lb',
      { activity, workout },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      id: activity.id,
      activity: {
        title: 'Updated Upper Body',
        status: 'completed',
        notes: 'Original activity note',
      },
      workout: {
        activityId: activity.id,
        name: 'Updated Upper Body',
        notes: 'Keep the tempo steady',
        exercises: [
          {
            id: 'exercise-edit',
            icon: 'gym',
            note: 'Pause at the chest',
            previousBest: '130 lb × 8',
            sets: [{ id: 'set-edit', reps: 8, done: true }],
          },
        ],
      },
    });
    expect(result.payload.workout?.exercises[0].sets[0].weightKg).toBeCloseTo(
      61.23496995,
      6,
    );
  });
});

describe('createWorkoutDayDraft', () => {
  it('starts future days with a one-hour strength plan and editable working sets', () => {
    const draft = createWorkoutDayDraft('2099-01-01', 18 * 60);

    expect(draft).toMatchObject({
      title: 'Gym Session',
      type: 'strength',
      startMinutes: 1080,
      durationHours: '1',
      durationMinutes: '0',
    });
    expect(draft.exercises).toHaveLength(1);
    expect(draft.exercises[0].sets).toHaveLength(3);
  });
});
