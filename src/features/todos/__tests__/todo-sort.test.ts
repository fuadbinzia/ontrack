import { sortTodoListsByRecent } from '@/features/todos/todo-sort';
import type { TodoList } from '@/store/todos';

const createdAt = '2026-08-01T00:00:00.000Z';

function list(
  id: string,
  name: string,
  updatedAt: string,
): TodoList {
  return {
    id,
    name,
    kind: 'checklist',
    mode: 'private',
    role: 'owner',
    createdAt,
    updatedAt,
  };
}

describe('sortTodoListsByRecent', () => {
  it('puts the most recently edited checklist first', () => {
    const features = list('features', 'Features', '2026-08-10T00:00:00.000Z');
    const todo = list('todo', 'To Do', '2026-08-12T18:00:00.000Z');
    const groceries = list('groceries', 'Groceries', '2026-08-11T00:00:00.000Z');

    expect(
      sortTodoListsByRecent([features, groceries, todo]).map((item) => item.name),
    ).toEqual(['To Do', 'Groceries', 'Features']);
  });

  it('returns the same array when lists are already in recency order', () => {
    const lists = [
      list('todo', 'To Do', '2026-08-12T18:00:00.000Z'),
      list('features', 'Features', '2026-08-10T00:00:00.000Z'),
    ];
    expect(sortTodoListsByRecent(lists)).toBe(lists);
  });
});
