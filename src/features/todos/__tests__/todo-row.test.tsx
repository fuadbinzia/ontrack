import { fireEvent, render, screen } from '@testing-library/react-native';

import { TodoRow } from '@/features/todos/todo-row';
import type { TodoTask } from '@/store/todos';

const task: TodoTask = {
  id: 'task-test-copy',
  listId: 'list-test-checklist',
  title: 'Copy this checklist item',
  completed: false,
  important: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
};

describe('TodoRow', () => {
  it('allows the checklist item title to use the native copy menu', () => {
    render(
      <TodoRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory={false}
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
        testID="ontrack.checklists.detail.task.task-test-copy"
      />,
    );

    expect(screen.getByText(task.title)).toHaveProp('selectable', true);
  });

  it('renders one metadata line and opens item details from the row', () => {
    const onOpenDetails = jest.fn();
    render(
      <TodoRow
        task={{ ...task, assigneeUserId: 'member' }}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[
          {
            listId: task.listId,
            userId: 'owner',
            displayName: 'Owner',
            role: 'owner',
            joinedAt: task.createdAt,
          },
          {
            listId: task.listId,
            userId: 'member',
            displayName: 'Member',
            role: 'member',
            joinedAt: task.createdAt,
          },
        ]}
        showCategory
        categoryName="Finance"
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={onOpenDetails}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Assigned to Member')).toBeTruthy();
    expect(screen.queryByText('Member')).toBeNull();
    expect(screen.getByText('Finance')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Open details for ${task.title}`));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('omits uncategorized metadata and its separator', () => {
    render(
      <TodoRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[
          {
            listId: task.listId,
            userId: 'owner',
            displayName: 'Owner',
            role: 'owner',
            joinedAt: task.createdAt,
          },
          {
            listId: task.listId,
            userId: 'member',
            displayName: 'Member',
            role: 'member',
            joinedAt: task.createdAt,
          },
        ]}
        showCategory
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Anyone|Uncategorized/)).toBeNull();
  });

  it('shows a category without an Anyone placeholder', () => {
    render(
      <TodoRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory
        categoryName="Travel"
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText('Travel')).toBeTruthy();
    expect(screen.queryByText(/Anyone/)).toBeNull();
  });
});
