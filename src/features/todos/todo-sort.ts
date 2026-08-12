import type { TodoList, TodoTask } from '@/store/todos';

export type TodoFilter = 'open' | 'completed';
export type TodoSort = 'manual' | 'smart' | 'newest' | 'oldest' | 'alphabetical';

function byPriorityAndRecency(a: TodoTask, b: TodoTask) {
  if (a.important !== b.important) return a.important ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

export function sortTodoTasks(
  tasks: TodoTask[],
  sort: TodoSort,
  filter: TodoFilter,
) {
  return [...tasks].sort((a, b) => {
    if (sort === 'manual') {
      return (
        (a.position ?? Number.MAX_SAFE_INTEGER) -
          (b.position ?? Number.MAX_SAFE_INTEGER) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id)
      );
    }
    if (sort === 'newest') {
      return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    }
    if (sort === 'oldest') {
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    }
    if (sort === 'alphabetical') {
      return (
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id)
      );
    }
    if (filter === 'completed') {
      return (
        (b.completedAt ?? '').localeCompare(a.completedAt ?? '') ||
        a.id.localeCompare(b.id)
      );
    }
    return byPriorityAndRecency(a, b) || a.id.localeCompare(b.id);
  });
}

export function sortTodoListsByRecent(lists: TodoList[]): TodoList[] {
  if (lists.length < 2) return lists;
  const sorted = [...lists].sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return sorted.every((list, index) => list === lists[index]) ? lists : sorted;
}
