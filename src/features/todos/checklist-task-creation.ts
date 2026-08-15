import type { TodoTask } from '@/store/todos';

type AddChecklistTask = (
  listId: string,
  title: string,
  categoryId?: string,
) => TodoTask | undefined;

export function createChecklistTaskAndOpenDetails({
  addTask,
  categoryId,
  listId,
  openDetails,
  title,
}: {
  addTask: AddChecklistTask;
  categoryId?: string;
  listId: string;
  openDetails: (taskId: string) => void;
  title: string;
}): TodoTask | undefined {
  const task = addTask(listId, title, categoryId);
  if (!task) return undefined;

  openDetails(task.id);
  return task;
}
