import { render, screen } from '@testing-library/react-native';

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
        expanded={false}
        isActive={false}
        listOwner
        members={[]}
        onCollapseTitle={jest.fn()}
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onCycleAssignee={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleExpanded={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
        testID="ontrack.checklists.detail.task.task-test-copy"
      />,
    );

    expect(screen.getByText(task.title)).toHaveProp('selectable', true);
  });
});
