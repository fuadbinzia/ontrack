import {
  workoutsByDate,
  workoutSetSummary,
} from '@/features/workouts/workout-calendar-model';
import type { Activity, Workout } from '@/types/models';

function activity(id: string, date: string, startMinutes: number): Activity {
  return {
    id,
    date,
    startMinutes,
    durationMinutes: 45,
    title: id,
    categoryId: 'gym',
    status: 'upcoming',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
  };
}

function workout(activityId: string): Workout {
  return { activityId, type: 'strength', name: activityId, exercises: [] };
}

describe('workoutsByDate', () => {
  it('groups workout-backed activities by day and orders each day by start time', () => {
    const grouped = workoutsByDate(
      [
        activity('evening', '2026-08-17', 1080),
        activity('morning', '2026-08-17', 420),
        activity('cardio', '2026-08-18', 480),
      ],
      [workout('morning'), workout('evening'), workout('cardio')],
    );

    expect(grouped.get('2026-08-17')?.map(({ activity: item }) => item.id)).toEqual([
      'morning',
      'evening',
    ]);
    expect(grouped.get('2026-08-18')?.[0].workout.type).toBe('strength');
  });

  it('does not show ordinary schedule activities as workouts', () => {
    const grouped = workoutsByDate(
      [activity('gym', '2026-08-17', 420), activity('meeting', '2026-08-17', 540)],
      [workout('gym')],
    );

    expect(grouped.get('2026-08-17')?.map(({ activity: item }) => item.id)).toEqual(['gym']);
  });

  it('ignores orphaned workout details whose activity no longer exists', () => {
    expect(workoutsByDate([], [workout('removed')]).size).toBe(0);
  });
});

describe('workoutSetSummary', () => {
  it('shows a compact uniform weighted-set breakdown', () => {
    expect(workoutSetSummary([
      { id: 'set-1', reps: 8, weightKg: 60, done: false },
      { id: 'set-2', reps: 8, weightKg: 60, done: false },
      { id: 'set-3', reps: 8, weightKg: 60, done: false },
    ])).toBe('3 sets · 8 reps · 60 kg');
  });

  it('shows ranges and bodyweight sets without hiding variation', () => {
    expect(workoutSetSummary([
      { id: 'set-1', reps: 8, weightKg: 40, done: false },
      { id: 'set-2', reps: 12, weightKg: 55, done: false },
    ])).toBe('2 sets · 8–12 reps · 40–55 kg');
    expect(workoutSetSummary([
      { id: 'set-1', reps: 12, weightKg: 0, done: false },
    ])).toBe('1 set · 12 reps · Bodyweight');
    expect(workoutSetSummary([])).toBe('No sets yet');
  });

  it('renders stored kilograms as pounds for pound-region calendars', () => {
    expect(workoutSetSummary([
      { id: 'set-1', reps: 8, weightKg: 61.23496995, done: false },
    ], 'lb')).toBe('1 set · 8 reps · 135 lb');
  });
});
