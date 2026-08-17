import { sortChecklistTasks } from '@/features/todos/todo-sort';
import type { ChecklistTask } from '@/store/todos';

function task(
  id: string,
  overrides: Partial<ChecklistTask> = {},
): ChecklistTask {
  return {
    id,
    listId: 'list',
    title: id,
    completed: false,
    important: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    version: 0,
    ...overrides,
  };
}

describe('sortChecklistTasks', () => {
  it('smart sort puts important tasks first, then newest', () => {
    const chores = task('chores', { createdAt: '2026-08-03T00:00:00.000Z' });
    const passport = task('passport', {
      important: true,
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    const milk = task('milk', { createdAt: '2026-08-02T00:00:00.000Z' });

    expect(
      sortChecklistTasks([chores, milk, passport], 'smart', 'open').map(
        (item) => item.id,
      ),
    ).toEqual(['passport', 'chores', 'milk']);
  });

  it('smart sort orders the completed filter by most recently completed', () => {
    const first = task('first', {
      completed: true,
      completedAt: '2026-08-10T00:00:00.000Z',
    });
    const latest = task('latest', {
      completed: true,
      completedAt: '2026-08-12T00:00:00.000Z',
    });
    const never = task('never', { completed: true });

    expect(
      sortChecklistTasks([never, first, latest], 'smart', 'completed').map(
        (item) => item.id,
      ),
    ).toEqual(['latest', 'first', 'never']);
  });

  it('manual sort follows saved positions and keeps unpositioned tasks last', () => {
    const second = task('second', { position: 2 });
    const first = task('first', { position: 1 });
    const unplaced = task('unplaced', {
      createdAt: '2026-08-05T00:00:00.000Z',
    });

    expect(
      sortChecklistTasks([unplaced, second, first], 'manual', 'open').map(
        (item) => item.id,
      ),
    ).toEqual(['first', 'second', 'unplaced']);
  });

  it('newest and oldest sorts mirror each other by creation time', () => {
    const early = task('early', { createdAt: '2026-08-01T00:00:00.000Z' });
    const late = task('late', { createdAt: '2026-08-09T00:00:00.000Z' });

    expect(
      sortChecklistTasks([early, late], 'newest', 'open').map((item) => item.id),
    ).toEqual(['late', 'early']);
    expect(
      sortChecklistTasks([early, late], 'oldest', 'open').map((item) => item.id),
    ).toEqual(['early', 'late']);
  });

  it('alphabetical sort ignores case', () => {
    const apples = task('a', { title: 'apples' });
    const bread = task('b', { title: 'Bread' });
    const cheese = task('c', { title: 'CHEESE' });

    expect(
      sortChecklistTasks([cheese, apples, bread], 'alphabetical', 'open').map(
        (item) => item.title,
      ),
    ).toEqual(['apples', 'Bread', 'CHEESE']);
  });

  it('does not mutate the input array', () => {
    const tasks = [task('b'), task('a')];
    const copy = [...tasks];
    sortChecklistTasks(tasks, 'alphabetical', 'open');
    expect(tasks).toEqual(copy);
  });
});
