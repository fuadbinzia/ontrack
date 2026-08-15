import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('workout day planner bottom-sheet contract', () => {
  const planner = readFileSync(
    join(process.cwd(), 'src/features/workouts/workout-day-planner.tsx'),
    'utf8',
  );
  const navigator = readFileSync(
    join(process.cwd(), 'src/features/workouts/workout-calendar.tsx'),
    'utf8',
  );

  it('opens Add Workout in the shared glass bottom sheet instead of inline', () => {
    expect(planner).toContain('<SheetScaffold');
    expect(planner).toContain('visible={visible}');
    expect(planner).not.toContain('<Animated.View');
    expect(navigator.indexOf('</GlassPlate>')).toBeLessThan(
      navigator.indexOf('<WorkoutDayPlanner'),
    );
  });

  it('supports close, backdrop dismissal, and saving from the sheet', () => {
    expect(planner).toContain('closeTestID={AgentUiIds.workouts.dayPlanner.close}');
    expect(planner).toContain('backdropTestID={AgentUiIds.workouts.dayPlanner.backdrop}');
    expect(planner).toContain('testID={AgentUiIds.workouts.dayPlanner.save}');
    expect(planner).toContain('footer={(');
  });

  it('resets the draft for each visible selected-day session', () => {
    expect(planner).toContain('if (!visible) return;');
    expect(planner).toContain('createWorkoutDayDraftFromScheduled(');
    expect(planner).toContain(': createWorkoutDayDraft(dateKey)');
    expect(planner).toContain('[dateKey, scheduledWorkout, visible, weightUnit]');
    expect(planner).toContain("scheduledWorkout?.activity.id ?? 'new'");
  });

  it('uses the same sheet in edit mode with a clear save action', () => {
    expect(planner).toContain("scheduledWorkout ? 'Edit Workout' : 'Add Workout'");
    expect(planner).toContain("scheduledWorkout ? 'Save Changes' : 'Save Workout'");
    expect(planner).toContain('scheduledWorkout,');
  });

  it('keeps the sheet compact without removing workout controls', () => {
    expect(planner).toContain('eyebrow={`${formatWeekday(dateKey)} · ${formatDateKeyMedium(dateKey)}`}');
    expect(planner).not.toContain('subtitle="Map the time');
    expect(planner).toContain('stackedLabel="Session Name"');
    expect(planner).toContain("widthClass === 'compact' ? 'column' : 'row'");
    expect(planner).not.toContain('\n          wrap\n');
    expect(planner).toContain('stackedLabel="Exercise"');
    expect(planner).toContain('stackedLabel="Rest (Sec)"');
    expect(planner).not.toContain('Workout Breakdown');
    expect(planner).toContain('testID={AgentUiIds.workouts.dayPlanner.addExercise}');
    expect(planner).toContain('testID={AgentUiIds.workouts.dayPlanner.addSet(exercise.id)}');
  });
});
