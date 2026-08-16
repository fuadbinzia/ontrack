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

  it('puts the last opened checklist first even when it was edited earlier', () => {
    const features = list('features', 'Features', '2026-08-10T00:00:00.000Z');
    const iceland = list('iceland', 'Iceland Checklist', '2026-08-12T18:00:00.000Z');
    const ideas = list('ideas', 'Ideas', '2026-08-11T00:00:00.000Z');

    expect(
      sortTodoListsByRecent([features, iceland, ideas], {
        features: '2026-08-14T09:00:00.000Z',
      }).map((item) => item.name),
    ).toEqual(['Features', 'Iceland Checklist', 'Ideas']);
  });

  it('keeps a newer edit above a stale open', () => {
    const features = list('features', 'Features', '2026-08-10T00:00:00.000Z');
    const ideas = list('ideas', 'Ideas', '2026-08-14T12:00:00.000Z');

    expect(
      sortTodoListsByRecent([features, ideas], {
        features: '2026-08-13T00:00:00.000Z',
      }).map((item) => item.name),
    ).toEqual(['Ideas', 'Features']);
  });

  it('returns the same array when lists are already in recency order', () => {
    const lists = [
      list('todo', 'To Do', '2026-08-12T18:00:00.000Z'),
      list('features', 'Features', '2026-08-10T00:00:00.000Z'),
    ];
    expect(sortTodoListsByRecent(lists)).toBe(lists);
  });
});
