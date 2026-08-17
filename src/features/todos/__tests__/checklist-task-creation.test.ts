import { createChecklistTaskAndOpenDetails } from '@/features/todos/checklist-task-creation';
import type { ChecklistTask } from '@/store/todos';

const task: ChecklistTask = {
  id: 'task-new',
  listId: 'list-checklist',
  title: 'Pack rain jacket',
  completed: false,
  important: false,
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  version: 0,
};

describe('createChecklistTaskAndOpenDetails', () => {
  it('opens the item details sheet for a newly created checklist task', () => {
    const addTask = jest.fn(() => task);
    const openDetails = jest.fn();

    expect(
      createChecklistTaskAndOpenDetails({
        addTask,
        listId: task.listId,
        openDetails,
        title: task.title,
      }),
    ).toBe(task);
    expect(addTask).toHaveBeenCalledWith(task.listId, task.title, undefined);
    expect(openDetails).toHaveBeenCalledWith(task.id);
  });

  it('keeps the details sheet closed when task creation is rejected', () => {
    const openDetails = jest.fn();

    expect(
      createChecklistTaskAndOpenDetails({
        addTask: jest.fn(() => undefined),
        listId: task.listId,
        openDetails,
        title: '   ',
      }),
    ).toBeUndefined();
    expect(openDetails).not.toHaveBeenCalled();
  });

  it('preserves the selected category before opening item details', () => {
    const addTask = jest.fn(() => ({
      ...task,
      categoryId: 'category-clothing',
    }));
    const openDetails = jest.fn();

    createChecklistTaskAndOpenDetails({
      addTask,
      categoryId: 'category-clothing',
      listId: task.listId,
      openDetails,
      title: task.title,
    });

    expect(addTask).toHaveBeenCalledWith(
      task.listId,
      task.title,
      'category-clothing',
    );
    expect(openDetails).toHaveBeenCalledWith(task.id);
  });
});
