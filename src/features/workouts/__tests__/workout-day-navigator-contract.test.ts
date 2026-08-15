import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('workout selected-day navigator contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/workouts/workout-calendar.tsx'),
    'utf8',
  );

  it('removes the month calendar and its disclosure chrome', () => {
    expect(source).not.toContain('<CollapsibleSection');
    expect(source).not.toContain('monthGrid');
    expect(source).not.toContain('formatMonthTitle');
    expect(source).not.toContain('WorkoutCalendarDay');
  });

  it('moves backward and forward one day from the selected-day header', () => {
    expect(source).toContain('testID={AgentUiIds.workouts.selectedDayPrevious}');
    expect(source).toContain('onPress={() => shiftDay(-1)}');
    expect(source).toContain('testID={AgentUiIds.workouts.selectedDayNext}');
    expect(source).toContain('onPress={() => shiftDay(1)}');
    expect(source).toContain('onSelectDate(addDays(selectedDate, delta));');
  });

  it('keeps workout details and planning attached to the selected date', () => {
    expect(source).toContain('workoutsByDate.get(selectedDate)');
    expect(source).toContain('dateKey={selectedDate}');
    expect(source).toContain('visible={plannerOpen}');
    expect(source).toContain('setEditingWorkout(undefined);');
    expect(source).toContain('setPlannerOpen(true);');
  });

  it('edits a tapped workout in place without routing away from Fitness', () => {
    expect(source).not.toContain('useRouter');
    expect(source).not.toContain('/detail/gym/');
    expect(source).toContain('setEditingWorkout({ activity, workout });');
    expect(source).toContain('scheduledWorkout={editingWorkout}');
    expect(source).toContain('accessibilityLabel={`Edit ${activity.title}`}');
  });
});
